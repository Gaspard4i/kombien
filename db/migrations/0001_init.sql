-- =============================================================================
-- 0001_init.sql — Schéma initial Kombien
-- =============================================================================
-- Toutes les durées sont EN SECONDES (BIGINT). Respecte exactement le schéma
-- assumé documenté en tête de db/seed/0001_seed.sql. Ne pas renommer de colonne
-- sans mettre à jour le seed.
-- =============================================================================

CREATE TABLE IF NOT EXISTS categories (
  id                SERIAL PRIMARY KEY,
  slug              TEXT UNIQUE NOT NULL,
  name_fr           TEXT NOT NULL,
  name_en           TEXT NOT NULL,
  threshold_seconds BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS questions (
  id               SERIAL PRIMARY KEY,
  category_id      INTEGER NOT NULL REFERENCES categories(id),
  text_fr          TEXT NOT NULL,
  text_en          TEXT NOT NULL,
  duration_seconds BIGINT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'approved',
  report_count     INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_questions_status ON questions (status);
CREATE INDEX IF NOT EXISTS idx_questions_category_id ON questions (category_id);

CREATE TABLE IF NOT EXISTS players (
  id         SERIAL PRIMARY KEY,
  pseudo     TEXT UNIQUE NOT NULL,
  xp         BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_players_pseudo ON players (pseudo);

-- Une partie terminée. mode: binaire|ordre_de_grandeur|duel ; lang: fr|en.
-- Le seed documente games/game_scores de façon lâche ("..."), on fige ici des
-- colonnes cohérentes avec le déroulement (§9) et l'écran de fin.
CREATE TABLE IF NOT EXISTS games (
  id            SERIAL PRIMARY KEY,
  mode          TEXT NOT NULL,
  lang          TEXT NOT NULL,
  end_condition TEXT,          -- 'points' | 'manual'
  target_score  INTEGER,       -- cible si end_condition = 'points'
  rounds_played INTEGER,
  ended_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Score d'un joueur dans une partie. On garde à la fois player_id (FK) et le
-- pseudo (dénormalisé) pour lisibilité des classements sans jointure.
CREATE TABLE IF NOT EXISTS game_scores (
  id          SERIAL PRIMARY KEY,
  game_id     INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id   INTEGER NOT NULL REFERENCES players(id),
  pseudo      TEXT NOT NULL,
  score       INTEGER NOT NULL DEFAULT 0,
  accuracy    REAL NOT NULL DEFAULT 0,       -- bonnes_réponses / total_réponses (0..1)
  best_streak INTEGER NOT NULL DEFAULT 0,
  is_winner   BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_game_scores_game_id ON game_scores (game_id);
CREATE INDEX IF NOT EXISTS idx_game_scores_player_id ON game_scores (player_id);

CREATE TABLE IF NOT EXISTS badges (
  id             SERIAL PRIMARY KEY,
  slug           TEXT UNIQUE NOT NULL,
  name_fr        TEXT NOT NULL,
  name_en        TEXT NOT NULL,
  description_fr TEXT NOT NULL,
  description_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS player_badges (
  id          SERIAL PRIMARY KEY,
  player_id   INTEGER NOT NULL REFERENCES players(id),
  badge_id    INTEGER NOT NULL REFERENCES badges(id),
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (player_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_player_badges_player_id ON player_badges (player_id);
