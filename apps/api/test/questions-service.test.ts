import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  drawQuestionsForCategories,
  drawDistinctSetsForPlayers,
  UnknownCategoriesError,
  type QueryExecutor,
} from '../src/services/questions-service.ts';

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
        const limit = values![1] as number | undefined; // absent : drawDistinctSetsForPlayers (pool complet, sans LIMIT)
        const pool = questions.filter((q) => categoryIds.includes(q.category_id));
        return { rows: limit === undefined ? pool : pool.slice(0, limit) };
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

function pool(size: number): { id: number; category_id: number; text_fr: string; text_en: string; duration_seconds: number }[] {
  return Array.from({ length: size }, (_, i) => ({
    id: i,
    category_id: 1,
    text_fr: `Q${i}`,
    text_en: `Q${i}`,
    duration_seconds: 60,
  }));
}

test('drawDistinctSetsForPlayers : pool large -> sous-ensembles totalement disjoints', async () => {
  // 4 joueurs x 5 questions = 20 nécessaires, pool de 30 -> largement de quoi rester disjoint.
  const db = fakeDb([{ id: 1, slug: 'sport' }], pool(30));
  const sets = await drawDistinctSetsForPlayers(db, ['sport'], 5, 4);

  assert.equal(sets.length, 4);
  for (const set of sets) assert.equal(set.length, 5);

  const allIds = sets.flat().map((q) => q.id);
  assert.equal(new Set(allIds).size, allIds.length); // aucune question partagée entre joueurs
});

test('drawDistinctSetsForPlayers : chaque joueur ne se répète jamais lui-même (règle 1, non sacrifiée)', async () => {
  const db = fakeDb([{ id: 1, slug: 'sport' }], pool(30));
  const sets = await drawDistinctSetsForPlayers(db, ['sport'], 5, 4);

  for (const set of sets) {
    const ids = set.map((q) => q.id);
    assert.equal(new Set(ids).size, ids.length);
  }
});

test('drawDistinctSetsForPlayers : pool insuffisant pour la disjonction inter-joueurs -> relâche la règle 2, garde la règle 1', async () => {
  // 3 joueurs x 5 = 15 nécessaires pour rester disjoints, pool de seulement 8 : le 1er joueur
  // épuise presque tout le pool disjoint, les suivants doivent forcément recouper.
  const db = fakeDb([{ id: 1, slug: 'sport' }], pool(8));
  const sets = await drawDistinctSetsForPlayers(db, ['sport'], 5, 3);

  assert.equal(sets.length, 3);
  // Règle 1 jamais sacrifiée : chaque joueur reçoit 5 questions distinctes entre elles
  // (le pool de 8 le permet toujours pour un seul joueur à la fois).
  for (const set of sets) {
    assert.equal(set.length, 5);
    const ids = set.map((q) => q.id);
    assert.equal(new Set(ids).size, ids.length);
  }
  // Règle 2 forcément relâchée : au moins un recoupement existe entre deux joueurs
  // (8 < 3*5=15, la disjonction totale est mathématiquement impossible).
  const allIds = sets.flat().map((q) => q.id);
  assert.ok(new Set(allIds).size < allIds.length);
});

test('drawDistinctSetsForPlayers : pool plus petit que count -> renvoie tout le pool (répétition intra-joueur inévitable, en dernier recours)', async () => {
  const db = fakeDb([{ id: 1, slug: 'sport' }], pool(3));
  const sets = await drawDistinctSetsForPlayers(db, ['sport'], 5, 2);

  assert.equal(sets.length, 2);
  for (const set of sets) assert.equal(set.length, 3); // pool.length < count : on ne peut fournir que 3
});

test('drawDistinctSetsForPlayers : pool vide -> un tableau vide par joueur (pas d exception)', async () => {
  const db = fakeDb([{ id: 1, slug: 'sport' }], []);
  const sets = await drawDistinctSetsForPlayers(db, ['sport'], 5, 3);

  assert.equal(sets.length, 3);
  for (const set of sets) assert.deepEqual(set, []);
});

test('drawDistinctSetsForPlayers : répartition équitable en dégradation, pas toujours le même sous-ensemble', async () => {
  // Pool de 12, count=5, 3 joueurs : joueur 0 disjoint (0-4), puis pool restant (5-11, 7
  // questions) insuffisant pour le joueur 1 (besoin de 5) -> dégradation dès le joueur 1.
  // Les joueurs 1 et 2 doivent recevoir des tranches DÉCALÉES du pool complet, pas identiques.
  const db = fakeDb([{ id: 1, slug: 'sport' }], pool(12));
  const sets = await drawDistinctSetsForPlayers(db, ['sport'], 5, 3);

  const idsPlayer1 = sets[1]!.map((q) => q.id);
  const idsPlayer2 = sets[2]!.map((q) => q.id);
  assert.notDeepEqual(idsPlayer1, idsPlayer2);
});

test('drawDistinctSetsForPlayers : régression — 2 joueurs, pool tout juste insuffisant, le joueur dégradé ne reçoit JAMAIS le set identique au premier', async () => {
  // Reproduit le bug réel observé en local (catégorie à 9 questions, count=5, 2 joueurs) :
  // le joueur 0 (non dégradé) consomme pool[0..4], puis le joueur 1 (dégradé) démarrait à
  // tort son curseur de dégradation à 0 -> repiochait EXACTEMENT pool[0..4], le même
  // tableau, dans le même ordre. `degradedCursor` doit reprendre où `cursor` s'est arrêté.
  const db = fakeDb([{ id: 1, slug: 'cuisine' }], pool(9));
  const sets = await drawDistinctSetsForPlayers(db, ['cuisine'], 5, 2);

  assert.equal(sets.length, 2);
  const idsPlayer0 = sets[0]!.map((q) => q.id);
  const idsPlayer1 = sets[1]!.map((q) => q.id);
  assert.notDeepEqual(idsPlayer0, idsPlayer1);
  // Le pool (9) ne permet pas une disjonction totale (2*5=10 > 9) : un seul recoupement est
  // acceptable (règle 2 relâchée en dernier recours), mais jamais un recoupement total.
  const overlap = idsPlayer0.filter((id) => idsPlayer1.includes(id));
  assert.ok(overlap.length < idsPlayer0.length, `recoupement total détecté : ${overlap.length}/${idsPlayer0.length}`);
});

test('drawDistinctSetsForPlayers : slug inconnu -> UnknownCategoriesError (même validation que drawQuestionsForCategories)', async () => {
  const db = fakeDb([{ id: 1, slug: 'sport' }], []);
  await assert.rejects(
    () => drawDistinctSetsForPlayers(db, ['inconnu'], 5, 2),
    (err: unknown) => {
      assert.ok(err instanceof UnknownCategoriesError);
      return true;
    },
  );
});
