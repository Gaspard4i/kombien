-- =============================================================================
-- 0002_player_counters.sql — Compteurs cumulés de profil
-- =============================================================================
-- Le seed documente players(id, pseudo, xp, created_at). Certaines conditions de
-- badges portent sur des cumuls cross-parties non dérivables simplement des
-- réponses individuelles (qui ne sont pas persistées) :
--   - duel_master : duels_won >= 10  -> compteur incrémental
--   - first_game  : games_played >= 1
-- On matérialise ces compteurs sur players pour éviter de persister chaque
-- réponse. Ils sont incrémentés à l'enregistrement d'une partie (POST /games).
-- polyglot (fr ET en) reste dérivé de games.lang via game_scores (pas de colonne).
-- =============================================================================

ALTER TABLE players ADD COLUMN IF NOT EXISTS games_played INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS duels_won INTEGER NOT NULL DEFAULT 0;
