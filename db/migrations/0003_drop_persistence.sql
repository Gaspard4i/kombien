-- =============================================================================
-- 0003_drop_persistence.sql — Suppression de la persistance profils/parties
-- =============================================================================
-- Décision v2 (docs/GAME_DESIGN_V2.md §0, docs/PLAN_V2.md) : plus de profils,
-- XP, niveaux, badges cumulés, classement global. Une partie est éphémère,
-- scorée serveur (POST /games) mais jamais écrite en base. On garde categories
-- et questions (contenu persistant), on droppe tout le reste.
-- =============================================================================

DROP TABLE IF EXISTS player_badges, badges, game_scores, games, players CASCADE;
