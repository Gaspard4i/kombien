-- =============================================================================
-- 0001_seed.sql — Données de seed Kombien (catégories, questions)
-- =============================================================================
--
-- SCHÉMA ASSUMÉ (le backend n'est pas encore écrit ; ces colonnes sont
-- normatives pour la migration correspondante). Toutes les durées sont EN
-- SECONDES. Cohérent avec CLAUDE.md et docs/GAME_DESIGN.md.
--
--   categories(
--     id                SERIAL PRIMARY KEY,
--     slug              TEXT UNIQUE NOT NULL,
--     name_fr           TEXT NOT NULL,
--     name_en           TEXT NOT NULL,
--     threshold_seconds BIGINT NOT NULL   -- seuil "longtemps" du mode Binaire
--   )
--
--   questions(
--     id               SERIAL PRIMARY KEY,
--     category_id      INTEGER NOT NULL REFERENCES categories(id),
--     text_fr          TEXT NOT NULL,
--     text_en          TEXT NOT NULL,
--     duration_seconds BIGINT NOT NULL,   -- vérité terrain, en secondes
--     status           TEXT NOT NULL DEFAULT 'approved',  -- approved|pending|rejected
--     report_count     INTEGER NOT NULL DEFAULT 0
--   )
--
-- Les questions référencent leur catégorie via
--   INSERT ... SELECT id FROM categories WHERE slug = '...'
-- pour ne pas dépendre d'IDs en dur. Idempotence best-effort via
-- ON CONFLICT (slug) DO NOTHING sur categories.
--
-- v2 : plus de table badges (persistance supprimée, cf. 0003_drop_persistence.sql).
-- Les exploits de session sont calculés à la volée, jamais seedés.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Catégories (5) — threshold_seconds = seuil réaliste "ça prend longtemps"
-- -----------------------------------------------------------------------------
INSERT INTO categories (slug, name_fr, name_en, threshold_seconds) VALUES
  ('dev-web',   'Développement web',    'Web development',        3600),      -- 1 h
  ('cuisine',   'Cuisine',              'Cooking',                1800),      -- 30 min
  ('admin',     'Tâches administratives','Administrative tasks',  604800),    -- 1 semaine
  ('bricolage', 'Bricolage / Maison',   'DIY / Home',             7200),      -- 2 h
  ('voyage',    'Voyage / Transport',   'Travel / Transport',     3600)       -- 1 h
ON CONFLICT (slug) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Questions — Développement web (durées imposées + crédibles)
-- -----------------------------------------------------------------------------
INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Centrer une div en CSS', 'Center a div in CSS', 120, 'approved'
FROM categories WHERE slug = 'dev-web';

INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Mettre en place une CI/CD complète', 'Set up a full CI/CD pipeline', 259200, 'approved'
FROM categories WHERE slug = 'dev-web';

INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Migrer un projet vers un autre framework', 'Migrate a project to another framework', 1209600, 'approved'
FROM categories WHERE slug = 'dev-web';

INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Corriger une typo dans le texte', 'Fix a typo in the copy', 60, 'approved'
FROM categories WHERE slug = 'dev-web';

INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Écrire un test unitaire simple', 'Write a simple unit test', 600, 'approved'
FROM categories WHERE slug = 'dev-web';

INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Débugger une erreur CORS', 'Debug a CORS error', 3600, 'approved'
FROM categories WHERE slug = 'dev-web';

INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Configurer un nom de domaine et le HTTPS', 'Set up a domain name and HTTPS', 7200, 'approved'
FROM categories WHERE slug = 'dev-web';

INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Faire une revue de code (PR moyenne)', 'Review a medium-sized pull request', 1800, 'approved'
FROM categories WHERE slug = 'dev-web';

INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Mettre à jour les dépendances d''un projet', 'Update a project''s dependencies', 5400, 'approved'
FROM categories WHERE slug = 'dev-web';

INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Développer une page de connexion complète', 'Build a full login page', 28800, 'approved'
FROM categories WHERE slug = 'dev-web';

INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Refondre entièrement la charte graphique', 'Fully redesign the visual identity', 604800, 'approved'
FROM categories WHERE slug = 'dev-web';

INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Rédiger la documentation d''une API', 'Write the documentation for an API', 14400, 'approved'
FROM categories WHERE slug = 'dev-web';

INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Résoudre un conflit de merge Git', 'Resolve a Git merge conflict', 900, 'approved'
FROM categories WHERE slug = 'dev-web';

-- -----------------------------------------------------------------------------
-- Questions — Cuisine
-- -----------------------------------------------------------------------------
INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Faire cuire un œuf à la coque', 'Boil a soft-boiled egg', 180, 'approved'
FROM categories WHERE slug = 'cuisine';

INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Préparer un café filtre', 'Brew a filter coffee', 300, 'approved'
FROM categories WHERE slug = 'cuisine';

INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Cuire des pâtes al dente', 'Cook pasta al dente', 600, 'approved'
FROM categories WHERE slug = 'cuisine';

INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Préparer un risotto', 'Make a risotto', 1500, 'approved'
FROM categories WHERE slug = 'cuisine';

INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Cuire un poulet rôti au four', 'Roast a whole chicken', 5400, 'approved'
FROM categories WHERE slug = 'cuisine';

INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Laisser lever une pâte à pain', 'Let bread dough rise', 7200, 'approved'
FROM categories WHERE slug = 'cuisine';

INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Mijoter un bœuf bourguignon', 'Slow-cook a beef bourguignon', 10800, 'approved'
FROM categories WHERE slug = 'cuisine';

INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Faire mariner une viande une nuit', 'Marinate meat overnight', 43200, 'approved'
FROM categories WHERE slug = 'cuisine';

INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Toaster une tranche de pain', 'Toast a slice of bread', 90, 'approved'
FROM categories WHERE slug = 'cuisine';

-- -----------------------------------------------------------------------------
-- Questions — Tâches administratives
-- -----------------------------------------------------------------------------
INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Remplir une déclaration d''impôts en ligne', 'File a tax return online', 5400, 'approved'
FROM categories WHERE slug = 'admin';

INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Renouveler une carte d''identité (délai total)', 'Renew an ID card (total wait)', 2592000, 'approved'
FROM categories WHERE slug = 'admin';

INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Obtenir un passeport (délai total)', 'Get a passport (total wait)', 3888000, 'approved'
FROM categories WHERE slug = 'admin';

INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Ouvrir un compte bancaire en ligne', 'Open a bank account online', 1800, 'approved'
FROM categories WHERE slug = 'admin';

INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Résilier un abonnement par courrier', 'Cancel a subscription by mail (total)', 1209600, 'approved'
FROM categories WHERE slug = 'admin';

INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Signer un bail de location', 'Sign a rental lease', 3600, 'approved'
FROM categories WHERE slug = 'admin';

INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Attendre au téléphone un service client', 'Wait on hold with customer support', 1500, 'approved'
FROM categories WHERE slug = 'admin';

INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Recevoir le remboursement d''une assurance', 'Receive an insurance reimbursement', 1814400, 'approved'
FROM categories WHERE slug = 'admin';

INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Scanner et envoyer un document', 'Scan and send a document', 300, 'approved'
FROM categories WHERE slug = 'admin';

-- -----------------------------------------------------------------------------
-- Questions — Bricolage / Maison
-- -----------------------------------------------------------------------------
INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Changer une ampoule', 'Change a light bulb', 120, 'approved'
FROM categories WHERE slug = 'bricolage';

INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Monter un meuble en kit', 'Assemble a flat-pack furniture', 5400, 'approved'
FROM categories WHERE slug = 'bricolage';

INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Repeindre une pièce', 'Repaint a room', 28800, 'approved'
FROM categories WHERE slug = 'bricolage';

INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Percer et fixer une étagère', 'Drill and mount a shelf', 1800, 'approved'
FROM categories WHERE slug = 'bricolage';

INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Déboucher un évier', 'Unclog a sink', 900, 'approved'
FROM categories WHERE slug = 'bricolage';

INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Poser du carrelage dans une salle de bain', 'Tile a bathroom', 172800, 'approved'
FROM categories WHERE slug = 'bricolage';

INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Tondre une pelouse', 'Mow a lawn', 2700, 'approved'
FROM categories WHERE slug = 'bricolage';

INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Rénover entièrement une cuisine', 'Fully renovate a kitchen', 1209600, 'approved'
FROM categories WHERE slug = 'bricolage';

-- -----------------------------------------------------------------------------
-- Questions — Voyage / Transport
-- -----------------------------------------------------------------------------
INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Faire ses valises pour un week-end', 'Pack for a weekend trip', 1800, 'approved'
FROM categories WHERE slug = 'voyage';

INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Passer la sécurité à l''aéroport', 'Get through airport security', 1200, 'approved'
FROM categories WHERE slug = 'voyage';

INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Trajet Paris-Lyon en TGV', 'Paris to Lyon by high-speed train', 7200, 'approved'
FROM categories WHERE slug = 'voyage';

INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Vol Paris-New York', 'Flight from Paris to New York', 28800, 'approved'
FROM categories WHERE slug = 'voyage';

INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Attendre un bus en ville', 'Wait for a city bus', 600, 'approved'
FROM categories WHERE slug = 'voyage';

INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Traverser l''Atlantique en cargo', 'Cross the Atlantic on a cargo ship', 864000, 'approved'
FROM categories WHERE slug = 'voyage';

INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Faire le plein d''essence', 'Fill up the gas tank', 300, 'approved'
FROM categories WHERE slug = 'voyage';

INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
SELECT id, 'Road trip côtier d''une semaine', 'A week-long coastal road trip', 604800, 'approved'
FROM categories WHERE slug = 'voyage';

COMMIT;
