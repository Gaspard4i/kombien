import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawQuestionsForCategories, UnknownCategoriesError, type QueryExecutor } from '../src/services/questions-service.ts';

// DB en mémoire : catégories + questions pré-existantes. Dispatch par motif dans le
// SQL (même pattern que import-service.test.ts / game-service.test.ts).
function fakeDb(
  categories: { id: number; slug: string }[],
  questions: { id: number; category_id: number; text_fr: string; text_en: string; duration_seconds: number }[],
) {
  const db: QueryExecutor = {
    async query(text: string, values?: unknown[]) {
      if (text.includes('SELECT id, slug FROM categories')) {
        const slugs = values![0] as string[];
        return { rows: categories.filter((c) => slugs.includes(c.slug)) };
      }
      if (text.includes('FROM questions')) {
        const categoryIds = values![0] as number[];
        const limit = values![1] as number;
        const pool = questions.filter((q) => categoryIds.includes(q.category_id));
        return { rows: pool.slice(0, limit) };
      }
      throw new Error(`requête non mockée : ${text}`);
    },
  };
  return db;
}

test('drawQuestionsForCategories : tire dans une seule catégorie (cas trivial)', async () => {
  const db = fakeDb(
    [{ id: 1, slug: 'sport' }],
    [{ id: 10, category_id: 1, text_fr: 'Q1', text_en: 'Q1', duration_seconds: 60 }],
  );
  const rows = await drawQuestionsForCategories(db, ['sport'], 5);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.category_id, 1);
});

test('drawQuestionsForCategories : tire dans UNION de plusieurs catégories', async () => {
  const db = fakeDb(
    [{ id: 1, slug: 'sport' }, { id: 2, slug: 'cuisine' }],
    [
      { id: 10, category_id: 1, text_fr: 'Q1', text_en: 'Q1', duration_seconds: 60 },
      { id: 11, category_id: 2, text_fr: 'Q2', text_en: 'Q2', duration_seconds: 120 },
    ],
  );
  const rows = await drawQuestionsForCategories(db, ['sport', 'cuisine'], 5);
  assert.equal(rows.length, 2);
  assert.deepEqual(new Set(rows.map((r) => r.category_id)), new Set([1, 2]));
});

test('drawQuestionsForCategories : dédoublonne les slugs répétés', async () => {
  const db = fakeDb(
    [{ id: 1, slug: 'sport' }],
    [{ id: 10, category_id: 1, text_fr: 'Q1', text_en: 'Q1', duration_seconds: 60 }],
  );
  const rows = await drawQuestionsForCategories(db, ['sport', 'sport'], 5);
  assert.equal(rows.length, 1);
});

test('drawQuestionsForCategories : slug inconnu -> UnknownCategoriesError', async () => {
  const db = fakeDb([{ id: 1, slug: 'sport' }], []);
  await assert.rejects(
    () => drawQuestionsForCategories(db, ['sport', 'inconnu'], 5),
    (err: unknown) => {
      assert.ok(err instanceof UnknownCategoriesError);
      assert.deepEqual(err.slugs, ['inconnu']);
      return true;
    },
  );
});

test('drawQuestionsForCategories : respecte la limite count', async () => {
  const db = fakeDb(
    [{ id: 1, slug: 'sport' }],
    Array.from({ length: 10 }, (_, i) => ({
      id: i,
      category_id: 1,
      text_fr: `Q${i}`,
      text_en: `Q${i}`,
      duration_seconds: 60,
    })),
  );
  const rows = await drawQuestionsForCategories(db, ['sport'], 3);
  assert.equal(rows.length, 3);
});
