# API_CONTRACT — Kombien

Contrat REST réel exposé par `apps/api` (Fastify). Base : `/api` derrière nginx (proxy), ou `http://localhost:3000` en dev direct. Toutes les durées sont en **secondes**. Unités valides (slugs) : `second`, `minute`, `hour`, `day`, `week`, `month`, `year`.

## Lecture

### `GET /health`
`{ status: "ok" }`

### `GET /categories`
`[{ id, slug, name_fr, name_en, threshold_seconds }]` (triées par name_fr)

### `GET /categories/:slug/questions?count=5`
`[{ id, category_id, text_fr, text_en, duration_seconds }]` — aléatoires, status approved. 404 `category_not_found` si slug inconnu. count 1..50 (défaut 5).

v2 : plus de persistance de profil/partie (GAME_DESIGN_V2.md §0) — `GET /leaderboard`
et `GET /players/:pseudo` sont **supprimés**. Le seul classement qui existe est
celui de la session de jeu en cours, dérivé côté client à partir de la réponse
de `POST /games`.

## Écriture

### `POST /questions` (contribution → pending)
Body : `{ text_fr (req), text_en?, duration (req, >0), unit (req, slug), category_slug (req), category_name_fr?, category_name_en? }`.
- Si `category_slug` inconnu : `category_name_fr` + `category_name_en` requis pour créer la catégorie, sinon 400 `unknown_category_needs_names`.
- 400 `invalid_unit` si unité hors liste.
- 201 → `{ id, category_id, text_fr, text_en, duration_seconds, status: "pending" }`.

### `POST /questions/:id/report`
201/200 → `{ id, report_count }`. 404 `question_not_found`.

### `POST /games` (scoring serveur-autoritatif d'une partie — ne persiste RIEN)
v2 : l'endpoint reste au cœur de l'anti-triche mais n'écrit plus en base (pas de
`players`/`games`/`game_scores` — tables supprimées, GAME_DESIGN_V2.md §0). Il
reçoit les réponses brutes d'une partie terminée, recalcule score/streak/exploits
de session, et renvoie le résultat sans rien stocker.

Body :
```
{
  mode: "binaire" | "ordre_de_grandeur" | "duel",
  lang: "fr" | "en",
  end_condition?: "points" | "manual",
  target_score?: int,
  rounds_played?: int,
  players: [  // 2 à 8 joueurs (v2 lot 1 : N-joueurs pass-and-play, GAME_DESIGN_V2.md §1.3)
    { pseudo, answers: [RawAnswer, ...] },
    ...
  ]
}
```
`RawAnswer` (champs selon le mode) :
```
{
  mode, questionId, roundIndex, responseTimeMs, durationSeconds,   // requis
  // binaire :
  binaryAnswer?: "yes" | "no", thresholdSeconds?,
  // ordre de grandeur :
  chosenUnit?,
  // duel :
  estValue?, estUnit?, opponentEstValue?, opponentEstUnit?
}
```
`questionId` est **requis** (v2, ajout par rapport à v1) : le serveur recharge
`duration_seconds` (et `threshold_seconds` de la catégorie, en mode binaire)
depuis la table `questions` par cet id, et ignore les valeurs envoyées par le
client dans `durationSeconds`/`thresholdSeconds` — anti-triche renforcé, on ne
fait plus confiance à la vérité terrain déclarée par le client.

Duel à N joueurs (lot 1) : le client envoie toujours `estValue`/`estUnit` (sa
propre estimation) par réponse ; `opponentEstValue`/`opponentEstUnit` (un seul
adversaire, contrat v1) restent acceptés mais ne sont **jamais lus** dès que la
partie compte plus de 2 joueurs. Le serveur reconstruit lui-même, pour chaque
`questionId`, la liste des estimations de **tous** les autres joueurs de la
partie à partir de leurs `estValue`/`estUnit` réels (jamais depuis les champs
`opponentEst*` déclarés par le client — anti-triche), puis applique le barème
(GAME_DESIGN_V2.md §1.3) : **seul le groupe de tête** (le ou les joueurs au
plus petit écart absolu) marque des points, en se partageant un pool fixe de 2
points (`floor(2 / k)`, k = nombre d'ex-æquo en tête) ; tous les autres joueurs
marquent 0. Se réduit exactement au barème Duel v1 pour 2 joueurs (k=1 -> 2/0,
k=2 en cas d'égalité -> 1/1).

Réponse 201 :
```
{
  is_draw,       // true ssi TOUS les joueurs sont à égalité (match nul général)
  players: [
    { pseudo, score, accuracy, best_streak, is_winner, session_exploits: [slug,...] }
  ]
}
```
`is_winner` : true pour le(s) joueur(s) au score le plus élevé. En Multi, une
égalité de tête entre certains joueurs seulement (pas tous) produit des
**co-vainqueurs** (`is_winner: true` pour chacun, `is_draw: false`) — ce n'est
un match nul général (`is_draw: true`, tous `is_winner: false`) que si tous les
joueurs de la partie sont à égalité.

`session_exploits` (remplace `new_badges` v1) : sous-ensemble de `speedrunner`,
`bullseye`, `perfect_round`, `on_fire`, `sharpshooter`, `centurion`, calculés
sur cette seule partie, jamais persistés. Plus de `game_id`, `xp_gained`,
`xp_total`, `level` (XP/niveaux supprimés).

IMPORTANT : le client envoie les réponses BRUTES ; le backend recharge la
vérité terrain par `questionId` et calcule points/streaks/exploits (anti-triche).
Le front peut afficher un score provisoire mais la vérité vient de la réponse
`/games`.

## Admin (header `x-admin-secret: <ADMIN_SECRET>`)
- `GET /admin/questions?status=pending` → liste.
- `POST /admin/questions/:id/approve` / `POST /admin/questions/:id/reject`.
401 si secret absent/incorrect.

### Import en masse (Lot 6)

Template générique unique (mêmes colonnes que `POST /questions`) : `text_fr`,
`text_en?`, `duration`, `unit`, `category_slug`, `category_name_fr?`,
`category_name_en?`. 3 formats supportés (détectés par extension du fichier
uploadé) : CSV, xlsx, Markdown (tableau pipe-delimited). Une ligne commençant
par `#` (colonne `text_fr`) est ignorée par le parseur — sert à documenter une
ligne d'exemple dans le template téléchargé.

#### `GET /admin/questions/import/template?format=csv|xlsx|md`
Télécharge un template vide (en-têtes + 1 ligne d'exemple commentée). Défaut
`csv`. Réponse : fichier binaire/texte avec `Content-Disposition: attachment`.

#### `POST /admin/questions/import` (multipart, champ `file`)
Parse le fichier en streaming, valide **ligne à ligne** (mêmes invariants que
`POST /questions` : `text_fr` requis, `duration` > 0, `unit` valide,
`category_slug` requis, noms fr/en requis si la catégorie n'existe pas encore).
Une ligne invalide ne bloque pas les autres. Les catégories manquantes sont
créées à la volée (mêmes règles que `POST /questions` : `threshold_seconds`
initialisé à la durée de la première question qui la crée). Chaque ligne
valide est insérée en statut `pending` (repasse par la modération existante).

Limites anti-DoS : 5 Mo max par fichier (`@fastify/multipart`, `app.ts`), 1
seul fichier par requête. 413 `file_too_large` si dépassée, 400
`unsupported_format` si l'extension n'est ni `.csv`, `.xlsx`, `.md`/`.markdown`.

Réponse 201 :
```
{
  total: number,     // lignes du fichier (hors en-tête / lignes commentées)
  imported: number,  // lignes valides insérées en pending
  rejected: [{ line: number, errors: [code, ...] }]  // 1-based
}
```
Codes d'erreur par ligne : `text_fr_required`, `duration_invalid`,
`invalid_unit`, `category_slug_required`, `unknown_category_needs_names`.

Chaque import est tracé dans `import_batches` (fichier, format, compteurs,
date) — table de journalisation, pas de contenu de fichier stocké.
