# API_CONTRACT — Kombien

Contrat REST réel exposé par `apps/api` (Fastify). Base : `/api` derrière nginx (proxy), ou `http://localhost:3000` en dev direct. Toutes les durées sont en **secondes**. Unités valides (slugs) : `second`, `minute`, `hour`, `day`, `week`, `month`, `year`.

## Lecture

### `GET /health`
`{ status: "ok" }`

### `GET /categories`
`[{ id, slug, name_fr, name_en, threshold_seconds }]` (triées par name_fr)

### `GET /categories/:slug/questions?count=5`
`[{ id, category_id, text_fr, text_en, duration_seconds }]` — aléatoires, status approved. 404 `category_not_found` si slug inconnu. count 1..50 (défaut 5).

### `GET /leaderboard?category=<slug>&limit=20`
- Sans `category` : `[{ pseudo, xp, level }]` (top par XP).
- Avec `category` : `[{ pseudo, total_score }]`. 404 si catégorie inconnue.

### `GET /players/:pseudo`
`{ pseudo, xp, level, games_played, duels_won, created_at, badges: [{ slug, name_fr, name_en, description_fr, description_en, unlocked_at }], stats: { games, total_score, best_streak, avg_accuracy, wins } }`. 404 `player_not_found`.

## Écriture

### `POST /questions` (contribution → pending)
Body : `{ text_fr (req), text_en?, duration (req, >0), unit (req, slug), category_slug (req), category_name_fr?, category_name_en? }`.
- Si `category_slug` inconnu : `category_name_fr` + `category_name_en` requis pour créer la catégorie, sinon 400 `unknown_category_needs_names`.
- 400 `invalid_unit` si unité hors liste.
- 201 → `{ id, category_id, text_fr, text_en, duration_seconds, status: "pending" }`.

### `POST /questions/:id/report`
201/200 → `{ id, report_count }`. 404 `question_not_found`.

### `POST /games` (enregistre une partie terminée — le serveur RECALCULE score/xp/badges)
Body :
```
{
  mode: "binaire" | "ordre_de_grandeur" | "duel",
  lang: "fr" | "en",
  end_condition?: "points" | "manual",
  target_score?: int,
  rounds_played?: int,
  players: [  // exactement 2
    { pseudo, answers: [RawAnswer, ...] },
    { pseudo, answers: [RawAnswer, ...] }
  ]
}
```
`RawAnswer` (champs selon le mode) :
```
{
  mode, roundIndex, responseTimeMs, durationSeconds,   // requis
  // binaire :
  binaryAnswer?: "yes" | "no", thresholdSeconds?,
  // ordre de grandeur :
  chosenUnit?,
  // duel :
  estValue?, estUnit?, opponentEstValue?, opponentEstUnit?
}
```
Réponse 201 :
```
{
  game_id, is_draw,
  players: [
    { pseudo, score, accuracy, best_streak, is_winner, xp_gained, xp_total, level, new_badges: [slug,...] }
  ]
}
```
IMPORTANT : le client envoie les réponses BRUTES ; le backend calcule les points, streaks, XP et badges (anti-triche). Le front peut afficher un score provisoire mais la vérité vient de la réponse `/games`.

## Admin (header `x-admin-secret: <ADMIN_SECRET>`)
- `GET /admin/questions?status=pending` → liste.
- `POST /admin/questions/:id/approve` / `POST /admin/questions/:id/reject`.
401 si secret absent/incorrect.
