# API_CONTRACT — Kombien

Contrat REST réel exposé par `apps/api` (Fastify). Base : `/api` derrière nginx (proxy), ou `http://localhost:3000` en dev direct. Toutes les durées sont en **secondes**. Unités valides (slugs) : `second`, `minute`, `hour`, `day`, `week`, `month`, `year`.

## Lecture

### `GET /health`
`{ status: "ok" }`

### `GET /categories`
`[{ id, slug, name_fr, name_en, threshold_seconds }]` (triées par name_fr)

### `GET /categories/:slug/questions?count=5`
`[{ id, category_id, text_fr, text_en, duration_seconds }]` — aléatoires, status approved. 404 `category_not_found` si slug inconnu. count 1..50 (défaut 5).

### `GET /questions?categories=slug1,slug2&count=5`
Tirage multi-catégories (Lot 2 v2, GAME_DESIGN_V2.md §2.3-2.4) : mêmes règles que
ci-dessus, mais dans l'**union** des questions approuvées de tous les slugs donnés
(mélange aléatoire du pool fusionné). Utilisé par les modes de sélection de thème
"multi-thèmes" et "par joueur" ; les modes croisement/global/vote continuent
d'utiliser `/categories/:slug/questions` (une seule catégorie active à la fois).
`categories` requis, slugs séparés par des virgules, dédoublonnés côté serveur.
404 `category_not_found` si au moins un slug est inconnu. count 1..50 (défaut 5).

v2 : plus de persistance de profil/partie (GAME_DESIGN_V2.md §0) — `GET /leaderboard`
et `GET /players/:pseudo` sont **supprimés**. Le seul classement qui existe est
celui de la session de jeu en cours, dérivé côté client à partir de la réponse
de `POST /games`.

`GET /categories` exclut la catégorie spéciale de calibration (`_calibration`,
`is_calibration = true`) : jamais un thème jouable, seulement servie via
`GET /calibration/questions` ci-dessous (Lot 4 v2).

### `GET /calibration/questions?count=5`

Calibration du mode Binaire (Lot 4 v2, GAME_DESIGN_V2.md §3) : sert les questions
du pool dédié, **hors des catégories de jeu** (catégorie `_calibration` flaggée
`is_calibration`, migration `0005_calibration.sql`), aléatoires, `status='approved'`.
`count` 1..50 (défaut **5**, cf. GAME_DESIGN_V2.md §3.1). Réponse :
`[{ id, text_fr, text_en, duration_seconds }]` — pas de `category_id` (un seul
pool, pas de croisement possible avec le jeu).

Chaque joueur passe la calibration indépendamment (Solo n/a, 5 questions par
joueur en Multi/Duo, jamais mutualisées) : pour chaque question, répondre
"longtemps"/"pas longtemps" **sans connaître la vraie durée** ni le seuil, comme
en jeu normal. Aucun scoring, aucun streak, aucun exploit sur cette phase (pure
étalonnage). Le calcul du seuil individuel (moyenne géométrique des bornes
basse/haute observées, replis sur les cas extrêmes/incohérents — GAME_DESIGN_V2.md
§3.3-3.4) est fait **côté client** (port TypeScript de
`domain/calibration.ts::deriveThreshold`, jamais recalculé serveur) ; le
résultat n'est communiqué au serveur qu'au moment du scoring de la partie via
`thresholdSeconds` dans chaque `RawAnswer` binaire de `POST /games` (voir
ci-dessous).

### `GET /questions/distinct?categories=slug1,slug2&count=5&players=3`
Tirage en sous-ensembles **disjoints**, un par joueur (Lot 3 v2, GAME_DESIGN_V2.md
§5.2) : option "questions différenciées" — chaque joueur reçoit `count` questions
qui lui sont propres, tirées de l'union des catégories données. Réponse :
`Question[][]`, un tableau par joueur, **même ordre que le tableau `players` envoyé
à `POST /games`**.

Tirage **applicatif** (fetch de tout le pool approuvé, mélangé côté SQL, puis
partition en mémoire) — jamais un `ORDER BY random()` par joueur, qui ne
garantirait pas la disjonction. Priorité de dégradation si le pool est trop petit
pour tout garantir (GAME_DESIGN_V2.md §5.2) :
1. **Non-répétition intra-joueur** (jamais sacrifiée tant que `pool.length >=
   count`) : un joueur ne revoit jamais deux fois la même question dans ce tirage.
2. **Non-répétition inter-joueurs** (relâchée en premier) : au-delà de la portion
   du pool qui peut être répartie en tranches totalement disjointes, les joueurs
   suivants repiochent dans le pool complet (tranches décalées entre joueurs pour
   rester équitable), pouvant recouper un autre joueur mais jamais eux-mêmes.

Si `pool.length < count` (catégorie trop restreinte même pour un seul joueur), la
réponse contient moins de `count` questions pour ce joueur — répétition intra-joueur
en dernier recours, cf. v1 §2.6.
`players` requis, 2 à 8 (aligné sur `POST /games`). `categories` requis, mêmes
règles que `GET /questions` (dédoublonnage, 404 `category_not_found` si un slug est
inconnu). `count` 1..50 (défaut 5).

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
  // duel : opponentEstimates (liste, N joueurs) est la source de vérité dès que présente ;
  // opponentEstValue/opponentEstUnit (un seul adversaire, contrat v1) reste accepté en alias
  // pour compatibilité mais ignoré au-delà de 2 joueurs (cf. plus bas).
  estValue?, estUnit?, opponentEstValue?, opponentEstUnit?, opponentEstimates?: [{ value, unit, durationSeconds?, noAnswer? }, ...],
  // timer de réponse expiré (pass-and-play v2.1 ou multi-écrans v2.2, GAME_DESIGN_V2.md §5bis/§6.2) :
  noAnswer?: boolean,
}
```
`noAnswer` (timer de réponse expiré, pass-and-play v2.1) : le joueur n'a pas répondu dans le
délai imparti. En Binaire/Ordre de grandeur, le front envoie directement une réponse "mauvaise"
(0 pt). En Duel, `noAnswer: true` fait ignorer `estValue`/`estUnit` de ce joueur au scoring —
son écart est traité comme infini (jamais dans le groupe de tête), quelle que soit la valeur
envoyée (non exploitable, cf. `domain/scoring.ts::scoreDuelRanked`).
`questionId` est **requis** (v2, ajout par rapport à v1) : le serveur recharge
`duration_seconds` depuis la table `questions` par cet id, et ignore la valeur
envoyée par le client dans `durationSeconds` — anti-triche renforcé, on ne fait
plus confiance à la vérité terrain déclarée par le client.

`thresholdSeconds` (mode binaire) : **cas différent de `durationSeconds`**
(Lot 4 v2, calibration, GAME_DESIGN_V2.md §3.5). Ce n'est pas une vérité terrain
falsifiable, c'est une **préférence de joueur** dérivée de sa propre calibration
côté client (5 questions, cf. `GET /calibration/questions` ci-dessus) : le
serveur l'accepte **tel quel** depuis le client, sans le recharger depuis
`threshold_seconds` de la catégorie. Mentir sur ce seuil ne fait que changer
l'interprétation binaire de sa propre estimation, jamais la vérité
(`duration_seconds`) contre laquelle elle est jugée — rien à falsifier. Si le
client omet `thresholdSeconds` (partie sans calibration, contrat v1), le
serveur retombe sur `threshold_seconds` de la catégorie de la question
(comportement v1 inchangé).

Duel à N joueurs (lot 1) : le client envoie toujours `estValue`/`estUnit` (sa
propre estimation) par réponse ; `opponentEstValue`/`opponentEstUnit` (un seul
adversaire, contrat v1) restent acceptés mais ne sont **jamais lus** dès que la
partie compte plus de 2 joueurs. Le serveur reconstruit lui-même, pour chaque
**`roundIndex`** (pas `questionId`, cf. questions différenciées ci-dessous), la
liste des estimations de **tous** les autres joueurs de la partie à partir de
leurs `estValue`/`estUnit` réels (jamais depuis les champs `opponentEst*`
déclarés par le client — anti-triche), puis applique le barème
(GAME_DESIGN_V2.md §1.3) : **seul le groupe de tête** (le ou les joueurs au
plus petit écart) marque des points, en se partageant un pool fixe de 2
points (`floor(2 / k)`, k = nombre d'ex-æquo en tête) ; tous les autres joueurs
marquent 0. Se réduit exactement au barème Duel v1 pour 2 joueurs (k=1 -> 2/0,
k=2 en cas d'égalité -> 1/1).

Duel + questions différenciées (Lot 3 v2, GAME_DESIGN_V2.md §5.3) : chaque
joueur a son propre `questionId` sur un même `roundIndex` (tiré via `GET
/questions/distinct`), donc sa propre `duration_seconds` serveur. Le classement
bascule alors sur l'**écart relatif** (`|estimation - durée| / durée`) plutôt que
l'écart absolu, pour rester comparable entre des questions de durées différentes
— sinon un joueur tombé sur une longue durée serait mécaniquement avantagé (60s
d'écart est énorme sur 2 minutes, négligeable sur un an). En mode "questions
communes" (toutes les réponses d'un round partagent le même `questionId`/durée),
diviser tous les écarts absolus par la même constante ne change ni l'ordre ni les
égalités : le classement est rigoureusement identique à l'écart absolu v1, zéro
régression.

Fin de partie assouplie (Lot 5 v2, GAME_DESIGN_V2.md §4) : le client peut arrêter la partie
à tout moment (`end_condition: "points"` ou `"manual"`, indifféremment). **Manche/round
complet** : tous les joueurs de la partie ont répondu au même nombre de questions pour un
`roundIndex` donné (le serveur ne connaît pas `questionsPerRound`, seule l'égalité entre
joueurs actifs — au moins une réponse dans la partie — importe). Le client n'envoie **que**
les réponses des manches complètes (troncature faite côté client avant l'appel, cf.
`gameStore.svelte.ts`), mais le serveur reste **robuste par sécurité** : il retronque
lui-même au dernier round complet avant tout scoring si le payload contient malgré tout une
manche incomplète (`truncateToLastCompleteRound`, `domain/game.ts`) — les points/streaks de
la manche incomplète ne comptent pour aucun joueur, y compris ceux qui avaient déjà répondu.

Si l'arrêt survient pendant la toute première manche (aucun round n'est jamais complet) :
réponse `{ is_draw: false, cancelled: true, players: [] }` — **partie annulée**, aucun
résultat classé (pas de faux "0-0"). Le front doit alors revenir à l'accueil avec un message
explicite plutôt qu'afficher un écran de fin.

Réponse 201 (partie normalement terminée) :
```
{
  is_draw,       // true ssi TOUS les joueurs sont à égalité (match nul général)
  cancelled: false,
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
