-- =============================================================================
-- 0004_import_batches.sql — Traçabilité des imports en masse (Lot 6)
-- =============================================================================
-- Une ligne par fichier importé via POST /admin/questions/import. Ne stocke pas
-- le contenu du fichier, seulement les compteurs et le statut, pour audit.
-- =============================================================================

CREATE TABLE IF NOT EXISTS import_batches (
  id            SERIAL PRIMARY KEY,
  filename      TEXT NOT NULL,
  format        TEXT NOT NULL,          -- 'csv' | 'xlsx' | 'md'
  total_rows    INTEGER NOT NULL,
  imported_rows INTEGER NOT NULL,
  rejected_rows INTEGER NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
