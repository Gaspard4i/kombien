import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateImportRow, validateImportRows, type RawImportRow } from '../src/domain/import.ts';

const KNOWN = new Set(['sport']);

test('validateImportRow : ligne valide avec catégorie existante', () => {
  const row: RawImportRow = {
    text_fr: 'Combien de temps dure un match de tennis ?',
    text_en: 'How long does a tennis match last?',
    duration: '2',
    unit: 'hour',
    category_slug: 'sport',
  };
  const result = validateImportRow(row, 1, KNOWN);
  assert.ok('valid' in result);
  assert.equal(result.valid.duration_seconds, 7200);
  assert.equal(result.valid.isNewCategory, false);
  assert.equal(result.valid.text_en, 'How long does a tennis match last?');
});

test('validateImportRow : text_en absent -> fallback sur text_fr', () => {
  const row: RawImportRow = { text_fr: 'Une sieste', duration: '20', unit: 'minute', category_slug: 'sport' };
  const result = validateImportRow(row, 1, KNOWN);
  assert.ok('valid' in result);
  assert.equal(result.valid.text_en, 'Une sieste');
});

test('validateImportRow : accepte une virgule décimale (locale fr)', () => {
  const row: RawImportRow = { text_fr: 'Test', duration: '1,5', unit: 'hour', category_slug: 'sport' };
  const result = validateImportRow(row, 1, KNOWN);
  assert.ok('valid' in result);
  assert.equal(result.valid.duration_seconds, 5400);
});

test('validateImportRow : text_fr manquant -> rejet text_fr_required', () => {
  const row: RawImportRow = { duration: '2', unit: 'hour', category_slug: 'sport' };
  const result = validateImportRow(row, 3, KNOWN);
  assert.ok('errors' in result);
  assert.deepEqual(result.errors, { line: 3, errors: ['text_fr_required'] });
});

test('validateImportRow : duration manquante, zéro ou négative -> rejet duration_invalid', () => {
  for (const duration of ['', '0', '-5', 'abc']) {
    const row: RawImportRow = { text_fr: 'Test', duration, unit: 'hour', category_slug: 'sport' };
    const result = validateImportRow(row, 1, KNOWN);
    assert.ok('errors' in result, `duration=${duration} aurait dû être rejetée`);
    assert.ok(result.errors.errors.includes('duration_invalid'));
  }
});

test('validateImportRow : unité invalide -> rejet invalid_unit', () => {
  const row: RawImportRow = { text_fr: 'Test', duration: '2', unit: 'decade', category_slug: 'sport' };
  const result = validateImportRow(row, 1, KNOWN);
  assert.ok('errors' in result);
  assert.deepEqual(result.errors.errors, ['invalid_unit']);
});

test('validateImportRow : category_slug manquant -> rejet category_slug_required', () => {
  const row: RawImportRow = { text_fr: 'Test', duration: '2', unit: 'hour' };
  const result = validateImportRow(row, 1, KNOWN);
  assert.ok('errors' in result);
  assert.deepEqual(result.errors.errors, ['category_slug_required']);
});

test('validateImportRow : nouvelle catégorie sans noms fr/en -> rejet unknown_category_needs_names', () => {
  const row: RawImportRow = { text_fr: 'Test', duration: '2', unit: 'hour', category_slug: 'cuisine' };
  const result = validateImportRow(row, 1, KNOWN);
  assert.ok('errors' in result);
  assert.deepEqual(result.errors.errors, ['unknown_category_needs_names']);
});

test('validateImportRow : nouvelle catégorie avec noms fr/en -> valide, isNewCategory true', () => {
  const row: RawImportRow = {
    text_fr: 'Test',
    duration: '2',
    unit: 'hour',
    category_slug: 'cuisine',
    category_name_fr: 'Cuisine',
    category_name_en: 'Cooking',
  };
  const result = validateImportRow(row, 1, KNOWN);
  assert.ok('valid' in result);
  assert.equal(result.valid.isNewCategory, true);
  assert.equal(result.valid.category_name_fr, 'Cuisine');
});

test('validateImportRow : plusieurs erreurs cumulées sur une même ligne', () => {
  const row: RawImportRow = { duration: '-1', unit: 'decade' };
  const result = validateImportRow(row, 1, KNOWN);
  assert.ok('errors' in result);
  assert.deepEqual(result.errors.errors, [
    'text_fr_required',
    'duration_invalid',
    'invalid_unit',
    'category_slug_required',
  ]);
});

test('validateImportRows : lignes valides et invalides mélangées, rapport complet', () => {
  const rows: RawImportRow[] = [
    { text_fr: 'Q1', duration: '2', unit: 'hour', category_slug: 'sport' },
    { text_fr: '', duration: '2', unit: 'hour', category_slug: 'sport' },
    { text_fr: 'Q3', duration: '5', unit: 'minute', category_slug: 'cuisine' },
  ];
  const result = validateImportRows(rows, KNOWN);
  assert.equal(result.total, 3);
  assert.equal(result.valid.length, 1);
  assert.equal(result.rejected.length, 2);
  assert.equal(result.rejected[0]!.line, 2);
  assert.equal(result.rejected[1]!.line, 3);
  assert.deepEqual(result.rejected[1]!.errors, ['unknown_category_needs_names']);
});

test('validateImportRows : une catégorie créée par une ligne devient connue pour les suivantes', () => {
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
  const result = validateImportRows(rows, new Set());
  assert.equal(result.valid.length, 2);
  assert.equal(result.valid[0]!.isNewCategory, true);
  assert.equal(result.valid[1]!.isNewCategory, false);
});

test('validateImportRows : ne mute pas l ensemble de slugs connus passé en entrée', () => {
  const known = new Set(['sport']);
  validateImportRows(
    [
      {
        text_fr: 'Q1',
        duration: '2',
        unit: 'hour',
        category_slug: 'cuisine',
        category_name_fr: 'Cuisine',
        category_name_en: 'Cooking',
      },
    ],
    known,
  );
  assert.equal(known.has('cuisine'), false);
});
