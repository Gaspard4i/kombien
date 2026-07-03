// Validation ligne à ligne d'un import en masse de questions (Lot 6). Pur :
// ne connaît ni fichier ni DB, seulement des lignes déjà tabulaires (colonnes
// du template générique) et l'ensemble des category_slug déjà en base. Une
// ligne invalide n'empêche pas les autres d'être importées (rapport complet).

import { isUnit, toSeconds, type UnitSlug } from './units.ts';

// Colonnes du template générique unique — mappe exactement le body de
// POST /questions (API_CONTRACT.md).
export const IMPORT_COLUMNS = [
  'text_fr',
  'text_en',
  'duration',
  'unit',
  'category_slug',
  'category_name_fr',
  'category_name_en',
] as const;

export type ImportColumn = (typeof IMPORT_COLUMNS)[number];

// Ligne brute telle qu'extraite du fichier : valeurs texte (CSV/xlsx/md ne
// distinguent pas nombre/chaîne de façon fiable), colonnes optionnelles absentes.
export type RawImportRow = Partial<Record<ImportColumn, string>>;

export type ImportErrorCode =
  | 'text_fr_required'
  | 'duration_invalid'
  | 'invalid_unit'
  | 'category_slug_required'
  | 'unknown_category_needs_names';

export interface ImportRowError {
  line: number; // 1-based, correspond à la position dans le fichier (hors en-tête)
  errors: ImportErrorCode[];
}

export interface ValidImportRow {
  line: number;
  text_fr: string;
  text_en: string;
  duration_seconds: number;
  category_slug: string;
  category_name_fr?: string;
  category_name_en?: string;
  // true si category_slug n'existe pas encore parmi les catégories connues :
  // le service devra la créer (mêmes règles que POST /questions).
  isNewCategory: boolean;
}

export interface ImportValidationResult {
  total: number;
  valid: ValidImportRow[];
  rejected: ImportRowError[];
}

function trimmed(value: string | undefined): string {
  return (value ?? '').trim();
}

// Valide une ligne brute. `knownCategorySlugs` permet de distinguer catégorie
// existante (pas besoin de noms) et catégorie nouvelle (noms fr/en requis) —
// même invariant que POST /questions (routes/questions.ts).
export function validateImportRow(
  row: RawImportRow,
  line: number,
  knownCategorySlugs: ReadonlySet<string>,
): { valid: ValidImportRow } | { errors: ImportRowError } {
  const errors: ImportErrorCode[] = [];

  const textFr = trimmed(row.text_fr);
  if (!textFr) errors.push('text_fr_required');

  const durationRaw = trimmed(row.duration).replace(',', '.');
  const duration = durationRaw === '' ? NaN : Number(durationRaw);
  if (!(duration > 0)) errors.push('duration_invalid');

  const unit = trimmed(row.unit);
  if (!isUnit(unit)) errors.push('invalid_unit');

  const categorySlug = trimmed(row.category_slug);
  if (!categorySlug) errors.push('category_slug_required');

  const categoryNameFr = trimmed(row.category_name_fr) || undefined;
  const categoryNameEn = trimmed(row.category_name_en) || undefined;
  const isNewCategory = categorySlug !== '' && !knownCategorySlugs.has(categorySlug);
  if (isNewCategory && (!categoryNameFr || !categoryNameEn)) {
    errors.push('unknown_category_needs_names');
  }

  if (errors.length > 0) {
    return { errors: { line, errors } };
  }

  return {
    valid: {
      line,
      text_fr: textFr,
      text_en: trimmed(row.text_en) || textFr,
      duration_seconds: toSeconds(duration, unit as UnitSlug),
      category_slug: categorySlug,
      category_name_fr: categoryNameFr,
      category_name_en: categoryNameEn,
      isNewCategory,
    },
  };
}

// Valide un lot de lignes brutes déjà parsées. Les slugs créés par des lignes
// précédentes du même fichier comptent comme "connus" pour les lignes
// suivantes (permet de définir une catégorie une fois puis de la réutiliser).
export function validateImportRows(
  rows: RawImportRow[],
  existingCategorySlugs: ReadonlySet<string>,
): ImportValidationResult {
  const known = new Set(existingCategorySlugs);
  const valid: ValidImportRow[] = [];
  const rejected: ImportRowError[] = [];

  rows.forEach((row, index) => {
    const line = index + 1;
    const result = validateImportRow(row, line, known);
    if ('valid' in result) {
      valid.push(result.valid);
      known.add(result.valid.category_slug);
    } else {
      rejected.push(result.errors);
    }
  });

  return { total: rows.length, valid, rejected };
}
