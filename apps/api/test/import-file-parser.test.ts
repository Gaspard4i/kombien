import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectFormat,
  parseImportFile,
  UnsupportedImportFormatError,
} from '../src/services/import-file-parser.ts';
import { buildCsvTemplate, buildXlsxTemplate, buildMarkdownTemplate } from '../src/services/import-template.ts';

test('detectFormat : reconnaît csv/xlsx/md par extension', () => {
  assert.equal(detectFormat('questions.csv'), 'csv');
  assert.equal(detectFormat('questions.xlsx'), 'xlsx');
  assert.equal(detectFormat('questions.md'), 'md');
  assert.equal(detectFormat('questions.markdown'), 'md');
});

test('detectFormat : rejette une extension inconnue', () => {
  assert.throws(() => detectFormat('questions.exe'), UnsupportedImportFormatError);
  assert.throws(() => detectFormat('questions'), UnsupportedImportFormatError);
});

test('parseImportFile csv : extrait les lignes en objets, ignore les commentaires', async () => {
  const csv = [
    'text_fr,text_en,duration,unit,category_slug,category_name_fr,category_name_en',
    '# Combien de temps dure un match de tennis ?,How long...,2,hour,sport,Sport,Sport',
    'Une sieste,,20,minute,sport,,',
  ].join('\n');
  const rows = await parseImportFile('csv', Buffer.from(csv, 'utf8'));
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.text_fr, 'Une sieste');
  assert.equal(rows[0]!.category_slug, 'sport');
});

test('parseImportFile csv : gère les champs quotés contenant des virgules', async () => {
  const csv = [
    'text_fr,text_en,duration,unit,category_slug,category_name_fr,category_name_en',
    '"Une, question avec virgule",,5,minute,sport,,',
  ].join('\n');
  const rows = await parseImportFile('csv', Buffer.from(csv, 'utf8'));
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.text_fr, 'Une, question avec virgule');
});

test('parseImportFile xlsx : round-trip avec le template généré, ligne d exemple ignorée (commentée)', async () => {
  const buffer = await buildXlsxTemplate();
  const rows = await parseImportFile('xlsx', buffer);
  assert.equal(rows.length, 0);
});

test('parseImportFile xlsx : lit une ligne de données réelle', async () => {
  const csvEquivalent = [
    'text_fr,text_en,duration,unit,category_slug,category_name_fr,category_name_en',
    'Une sieste,,20,minute,sport,,',
  ].join('\n');
  // On génère un xlsx équivalent via ExcelJS directement pour ne pas dépendre du csv.
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('q');
  sheet.addRow(['text_fr', 'text_en', 'duration', 'unit', 'category_slug', 'category_name_fr', 'category_name_en']);
  sheet.addRow(['Une sieste', '', 20, 'minute', 'sport', '', '']);
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());

  const rows = await parseImportFile('xlsx', buffer);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.text_fr, 'Une sieste');
  assert.equal(rows[0]!.duration, '20');
  void csvEquivalent;
});

test('parseImportFile md : tableau pipe-delimited, ignore séparateur et ligne d exemple commentée', async () => {
  const md = buildMarkdownTemplate();
  const rows = await parseImportFile('md', Buffer.from(md, 'utf8'));
  assert.equal(rows.length, 0);
});

test('parseImportFile md : lit une ligne de données réelle', async () => {
  const md = [
    '| text_fr | text_en | duration | unit | category_slug | category_name_fr | category_name_en |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    '| Une sieste |  | 20 | minute | sport |  |  |',
  ].join('\n');
  const rows = await parseImportFile('md', Buffer.from(md, 'utf8'));
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.text_fr, 'Une sieste');
  assert.equal(rows[0]!.duration, '20');
  assert.equal(rows[0]!.category_slug, 'sport');
});

test('parseImportFile csv : round-trip avec le template généré, ligne d exemple ignorée (commentée)', async () => {
  const csv = buildCsvTemplate();
  const rows = await parseImportFile('csv', Buffer.from(csv, 'utf8'));
  assert.equal(rows.length, 0);
});

test('buildCsvTemplate : en-tête complet + ligne d exemple commentée', () => {
  const csv = buildCsvTemplate();
  const [header, example] = csv.trim().split('\n');
  assert.equal(
    header,
    'text_fr,text_en,duration,unit,category_slug,category_name_fr,category_name_en',
  );
  assert.ok(example!.startsWith('#'));
});
