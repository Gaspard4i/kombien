// Génération des templates d'import téléchargeables (GET /admin/questions/import/template).
// Un seul jeu de colonnes (IMPORT_COLUMNS), une ligne d'exemple commentée
// (préfixée `#`, ignorée par le parseur — cf. isCommentLine dans import-file-parser.ts).

import ExcelJS from 'exceljs';
import { IMPORT_COLUMNS } from '../domain/import.ts';

const EXAMPLE_ROW = [
  '# Combien de temps dure un match de tennis ?',
  'How long does a tennis match last?',
  '2',
  'hour',
  'sport',
  'Sport',
  'Sport',
];

export function buildCsvTemplate(): string {
  const header = IMPORT_COLUMNS.join(',');
  const example = EXAMPLE_ROW.map((cell) => (cell.includes(',') ? `"${cell}"` : cell)).join(',');
  return `${header}\n${example}\n`;
}

export async function buildXlsxTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('questions');
  sheet.addRow([...IMPORT_COLUMNS]);
  sheet.addRow(EXAMPLE_ROW);
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function buildMarkdownTemplate(): string {
  const header = `| ${IMPORT_COLUMNS.join(' | ')} |`;
  const separator = `| ${IMPORT_COLUMNS.map(() => '---').join(' | ')} |`;
  const example = `| ${EXAMPLE_ROW.join(' | ')} |`;
  return `${header}\n${separator}\n${example}\n`;
}
