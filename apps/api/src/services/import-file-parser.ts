// Extraction d'un fichier d'import (CSV / xlsx / Markdown) vers des lignes
// brutes tabulaires (RawImportRow[]), avant validation par domain/import.ts.
// Le format est détecté par extension : le fichier vient d'un upload non
// fiable, on ne lui fait confiance sur rien d'autre que ça pour choisir le
// parseur (le contenu lui-même est ensuite validé ligne à ligne).

import { parse as parseCsv } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { IMPORT_COLUMNS, type ImportColumn, type RawImportRow } from '../domain/import.ts';

export type ImportFileFormat = 'csv' | 'xlsx' | 'md';

export class UnsupportedImportFormatError extends Error {
  readonly extension: string;

  constructor(extension: string) {
    super(`format de fichier non supporté : ${extension}`);
    this.extension = extension;
  }
}

export function detectFormat(filename: string): ImportFileFormat {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'csv') return 'csv';
  if (ext === 'xlsx') return 'xlsx';
  if (ext === 'md' || ext === 'markdown') return 'md';
  throw new UnsupportedImportFormatError(ext);
}

// Une ligne d'en-tête (ou de commentaire) contenant `text_fr` sert de repère
// pour ignorer les lignes d'exemple commentées du template (préfixées `#`).
function isCommentLine(cells: string[]): boolean {
  return cells[0]?.trim().startsWith('#') ?? false;
}

function rowFromCells(headers: string[], cells: string[]): RawImportRow {
  const row: RawImportRow = {};
  headers.forEach((header, i) => {
    if ((IMPORT_COLUMNS as readonly string[]).includes(header)) {
      row[header as ImportColumn] = cells[i]?.trim() ?? '';
    }
  });
  return row;
}

function parseCsvBuffer(buffer: Buffer): RawImportRow[] {
  const records = parseCsv(buffer, {
    columns: false,
    skip_empty_lines: true,
    trim: true,
  }) as string[][];
  if (records.length === 0) return [];

  const [header, ...dataRows] = records;
  return dataRows
    .filter((cells) => !isCommentLine(cells))
    .map((cells) => rowFromCells(header!, cells));
}

async function parseXlsxBuffer(buffer: Buffer): Promise<RawImportRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  let header: string[] = [];
  const rows: RawImportRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    // ExcelJS indexe row.values à partir de 1, l'index 0 est vide : on retire.
    const cells = (row.values as unknown[]).slice(1).map((v) => (v === null || v === undefined ? '' : String(v)));
    if (rowNumber === 1) {
      header = cells.map((c) => c.trim());
      return;
    }
    if (isCommentLine(cells)) return;
    rows.push(rowFromCells(header, cells));
  });
  return rows;
}

// Tableau Markdown pipe-delimited : première ligne = en-têtes, deuxième ligne
// = séparateur `---` (ignorée), lignes suivantes = données. Réutilise la même
// logique de colonnes que CSV/xlsx (contrainte du Lot 6 : un seul parseur de
// validation pour les trois formats).
function parseMarkdownBuffer(buffer: Buffer): RawImportRow[] {
  const lines = buffer
    .toString('utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|') && line.endsWith('|'));
  if (lines.length === 0) return [];

  const toCells = (line: string): string[] =>
    line
      .slice(1, -1)
      .split('|')
      .map((cell) => cell.trim());

  const isSeparatorRow = (cells: string[]): boolean => cells.every((cell) => /^:?-+:?$/.test(cell));

  const [headerLine, ...rest] = lines;
  const header = toCells(headerLine!);
  const dataLines = isSeparatorRow(toCells(rest[0] ?? '')) ? rest.slice(1) : rest;

  return dataLines
    .map(toCells)
    .filter((cells) => !isCommentLine(cells))
    .map((cells) => rowFromCells(header, cells));
}

export async function parseImportFile(format: ImportFileFormat, buffer: Buffer): Promise<RawImportRow[]> {
  if (format === 'csv') return parseCsvBuffer(buffer);
  if (format === 'xlsx') return parseXlsxBuffer(buffer);
  return parseMarkdownBuffer(buffer);
}
