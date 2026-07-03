-- =============================================================================
-- 0005_calibration.sql — Pool dédié à la calibration du mode Binaire (Lot 4 v2)
-- =============================================================================
-- GAME_DESIGN_V2.md §3.2 : les questions de calibration doivent être HORS des
-- catégories de jeu, pour ne pas biaiser le pool de jeu ni consommer son stock.
-- Choix de modélisation (tension §5 de GAME_DESIGN_V2.md, tranchée ici) : une
-- catégorie spéciale flaggée `is_calibration`, plutôt qu'une table dédiée — on
-- réutilise categories/questions telles quelles (mêmes colonnes, même statut
-- 'approved'), et l'exclusion du tirage normal se fait par un simple filtre
-- `NOT c.is_calibration` dans les requêtes de tirage de jeu.
--
-- Le contenu (catégorie + 8 questions, spectre large de magnitudes) est seedé
-- directement ici plutôt que dans db/seed/, car seul 0001_seed.sql est rejoué
-- automatiquement (uniquement si `categories` est vide, cf. src/db/migrate.ts)
-- — une migration versionnée s'applique elle sur toute base, neuve ou existante.
-- =============================================================================

ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_calibration BOOLEAN NOT NULL DEFAULT false;

-- Exclut le pool de calibration des tirages de jeu existants sans les modifier :
-- une seule catégorie flaggée is_calibration ne peut jamais matcher un slug de
-- jeu, mais on protège aussi le tirage par catégorie explicite au cas où.
CREATE INDEX IF NOT EXISTS idx_categories_is_calibration ON categories (is_calibration);

INSERT INTO categories (slug, name_fr, name_en, threshold_seconds, is_calibration) VALUES
  ('_calibration', 'Calibration', 'Calibration', 3600, true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Envoyer un SMS', 'Send a text message', 20, 'approved'
FROM categories WHERE slug = '_calibration';

INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Faire bouillir de l''eau pour un thé', 'Boil water for tea', 180, 'approved'
FROM categories WHERE slug = '_calibration';

INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Regarder un épisode de série', 'Watch a TV show episode', 2700, 'approved'
FROM categories WHERE slug = '_calibration';

INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Faire une randonnée en montagne', 'Go on a mountain hike', 21600, 'approved'
FROM categories WHERE slug = '_calibration';

INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Faire pousser des radis', 'Grow radishes', 259200, 'approved'
FROM categories WHERE slug = '_calibration';

INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Apprendre les bases d''une nouvelle langue', 'Learn the basics of a new language', 1814400, 'approved'
FROM categories WHERE slug = '_calibration';

INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Construire une maison', 'Build a house', 15768000, 'approved'
FROM categories WHERE slug = '_calibration';

INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Faire pousser un chêne adulte', 'Grow a mature oak tree', 1892160000, 'approved'
FROM categories WHERE slug = '_calibration';
