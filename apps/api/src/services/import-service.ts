// Service d'orchestration de l'import en masse (Lot 6) : charge les catégories
// connues, délègue la validation ligne à ligne au domaine pur (domain/import.ts),
// crée les catégories manquantes et insère les lignes valides en 'pending',
// puis trace le lot dans import_batches. Les erreurs de lignes n'interrompent
// jamais l'import des autres (rapport complet retourné à l'appelant).

import { validateImportRows, type ImportRowError, type ValidImportRow } from '../domain/import.ts';
import type { RawImportRow } from '../domain/import.ts';
import type { ImportFileFormat } from './import-file-parser.ts';

export interface QueryExecutor {
  query(text: string, values?: unknown[]): Promise<{ rows: any[] }>;
}

export interface ImportReport {
  total: number;
  imported: number;
  rejected: ImportRowError[];
}

async function loadKnownCategorySlugs(db: QueryExecutor): Promise<Set<string>> {
  const { rows } = await db.query('SELECT slug FROM categories');
  return new Set(rows.map((r) => r.slug as string));
}

// threshold_seconds de départ pour une catégorie créée depuis un import : même
// règle que POST /questions (routes/questions.ts) — la durée de la première
// question qui la crée sert de seuil neutre, ajustable ensuite par un admin.
async function resolveCategoryId(
  db: QueryExecutor,
  row: ValidImportRow,
  createdSlugs: Map<string, number>,
): Promise<number> {
  if (createdSlugs.has(row.category_slug)) {
    return createdSlugs.get(row.category_slug)!;
  }

  const existing = await db.query('SELECT id FROM categories WHERE slug = $1', [row.category_slug]);
  if (existing.rows.length > 0) {
    const id = existing.rows[0].id as number;
    createdSlugs.set(row.category_slug, id);
    return id;
  }

  const created = await db.query(
    `INSERT INTO categories (slug, name_fr, name_en, threshold_seconds)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [row.category_slug, row.category_name_fr, row.category_name_en, row.duration_seconds],
  );
  const id = created.rows[0].id as number;
  createdSlugs.set(row.category_slug, id);
  return id;
}

async function insertQuestion(db: QueryExecutor, categoryId: number, row: ValidImportRow): Promise<void> {
  await db.query(
    `INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
     VALUES ($1, $2, $3, $4, 'pending')`,
    [categoryId, row.text_fr, row.text_en, row.duration_seconds],
  );
}

async function recordBatch(
  db: QueryExecutor,
  filename: string,
  format: ImportFileFormat,
  report: ImportReport,
): Promise<void> {
  await db.query(
    `INSERT INTO import_batches (filename, format, total_rows, imported_rows, rejected_rows)
     VALUES ($1, $2, $3, $4, $5)`,
    [filename, format, report.total, report.imported, report.rejected.length],
  );
}

export async function importQuestions(
  db: QueryExecutor,
  filename: string,
  format: ImportFileFormat,
  rows: RawImportRow[],
): Promise<ImportReport> {
  const knownSlugs = await loadKnownCategorySlugs(db);
  const { total, valid, rejected } = validateImportRows(rows, knownSlugs);

  const createdSlugs = new Map<string, number>();
  for (const row of valid) {
    const categoryId = await resolveCategoryId(db, row, createdSlugs);
    await insertQuestion(db, categoryId, row);
  }

  const report: ImportReport = { total, imported: valid.length, rejected };
  await recordBatch(db, filename, format, report);
  return report;
}
