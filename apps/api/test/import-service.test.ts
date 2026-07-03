import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importQuestions, type QueryExecutor } from '../src/services/import-service.ts';
import type { RawImportRow } from '../src/domain/import.ts';

// DB en mémoire : catégories pré-existantes + questions/import_batches insérées
// au fil de l'appel. Dispatch par motif dans le SQL (même pattern que
// game-service.test.ts).
function fakeDb() {
  const categories = new Map<string, number>([['sport', 1]]);
  let nextCategoryId = 2;
  const insertedQuestions: { category_id: number; text_fr: string; text_en: string; duration_seconds: number }[] = [];
  const batches: { filename: string; format: string; total_rows: number; imported_rows: number; rejected_rows: number }[] = [];

  const db: QueryExecutor = {
    async query(text: string, values?: unknown[]) {
      if (text.includes('SELECT slug FROM categories')) {
        return { rows: [...categories.keys()].map((slug) => ({ slug })) };
      }
      if (text.includes('SELECT id FROM categories WHERE slug')) {
        const slug = values![0] as string;
        const id = categories.get(slug);
        return { rows: id === undefined ? [] : [{ id }] };
      }
      if (text.includes('INSERT INTO categories')) {
        const [slug] = values as [string, string, string, number];
        const id = nextCategoryId++;
        categories.set(slug, id);
        return { rows: [{ id }] };
      }
      if (text.includes('INSERT INTO questions')) {
        const [category_id, text_fr, text_en, duration_seconds] = values as [number, string, string, number];
        insertedQuestions.push({ category_id, text_fr, text_en, duration_seconds });
        return { rows: [] };
      }
      if (text.includes('INSERT INTO import_batches')) {
        const [filename, format, total_rows, imported_rows, rejected_rows] = values as [
          string,
          string,
          number,
          number,
          number,
        ];
        batches.push({ filename, format, total_rows, imported_rows, rejected_rows });
        return { rows: [] };
      }
      throw new Error(`requête non mockée : ${text}`);
    },
  };

  return { db, insertedQuestions, batches, categories };
}

test('importQuestions : insère les lignes valides en pending, rejette les invalides', async () => {
  const { db, insertedQuestions } = fakeDb();
  const rows: RawImportRow[] = [
    { text_fr: 'Q1', duration: '2', unit: 'hour', category_slug: 'sport' },
    { text_fr: '', duration: '2', unit: 'hour', category_slug: 'sport' }, // invalide
  ];

  const report = await importQuestions(db, 'test.csv', 'csv', rows);

  assert.equal(report.total, 2);
  assert.equal(report.imported, 1);
  assert.equal(report.rejected.length, 1);
  assert.equal(report.rejected[0]!.line, 2);
  assert.equal(insertedQuestions.length, 1);
  assert.equal(insertedQuestions[0]!.category_id, 1);
});

test('importQuestions : crée une catégorie manquante avec les noms fournis', async () => {
  const { db, insertedQuestions, categories } = fakeDb();
  const rows: RawImportRow[] = [
    {
      text_fr: 'Q1',
      duration: '2',
      unit: 'hour',
      category_slug: 'cuisine',
      category_name_fr: 'Cuisine',
      category_name_en: 'Cooking',
    },
  ];

  const report = await importQuestions(db, 'test.csv', 'csv', rows);

  assert.equal(report.imported, 1);
  assert.ok(categories.has('cuisine'));
  assert.equal(insertedQuestions[0]!.category_id, categories.get('cuisine'));
});

test('importQuestions : deux lignes de la même nouvelle catégorie ne la créent qu une fois', async () => {
  const { db, insertedQuestions, categories } = fakeDb();
  const initialSize = categories.size;
  const rows: RawImportRow[] = [
    {
      text_fr: 'Q1',
      duration: '2',
      unit: 'hour',
      category_slug: 'cuisine',
      category_name_fr: 'Cuisine',
      category_name_en: 'Cooking',
    },
    { text_fr: 'Q2', duration: '10', unit: 'minute', category_slug: 'cuisine' },
  ];

  const report = await importQuestions(db, 'test.csv', 'csv', rows);

  assert.equal(report.imported, 2);
  assert.equal(categories.size, initialSize + 1);
  assert.equal(insertedQuestions[0]!.category_id, insertedQuestions[1]!.category_id);
});

test('importQuestions : trace le lot dans import_batches', async () => {
  const { db, batches } = fakeDb();
  const rows: RawImportRow[] = [
    { text_fr: 'Q1', duration: '2', unit: 'hour', category_slug: 'sport' },
    { text_fr: '', duration: '2', unit: 'hour', category_slug: 'sport' },
  ];

  await importQuestions(db, 'mon-fichier.xlsx', 'xlsx', rows);

  assert.equal(batches.length, 1);
  assert.deepEqual(batches[0], {
    filename: 'mon-fichier.xlsx',
    format: 'xlsx',
    total_rows: 2,
    imported_rows: 1,
    rejected_rows: 1,
  });
});

test('importQuestions : fichier vide -> rapport à zéro, pas d insertion', async () => {
  const { db, insertedQuestions, batches } = fakeDb();
  const report = await importQuestions(db, 'vide.csv', 'csv', []);

  assert.deepEqual(report, { total: 0, imported: 0, rejected: [] });
  assert.equal(insertedQuestions.length, 0);
  assert.equal(batches[0]!.total_rows, 0);
});
