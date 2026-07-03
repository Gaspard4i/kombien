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
  players: [  // exactement 2 (v2 lot 0 ; N-joueurs = lot 1)
    { pseudo, answers: [RawAnswer, ...] },
    { pseudo, answers: [RawAnswer, ...] }
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

Réponse 201 :
```
{
  is_draw,
  players: [
    { pseudo, score, accuracy, best_streak, is_winner, session_exploits: [slug,...] }
  ]
}
```
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
