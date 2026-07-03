import { UNIT_FACTOR_SECONDS, UNITS, naturalMagnitude, type Unit } from './units';

// Labels courts affichés sur les palettes (Space Mono, MAJUSCULES — DESIGN_SYSTEM.md §3.2/§5.3).
// i18n : le libellé long des unités vit dans les fichiers de traduction ; ces tags courts sont
// un langage de tableau d'affichage, volontairement identiques dans les deux langues sauf
// pour l'ambiguïté minute/mois (M) et l'anglais qui utilise ses propres initiales usuelles.
const UNIT_TAG: Record<'fr' | 'en', Record<Unit, string>> = {
  fr: {
    second: 'S',
    minute: 'MIN',
    hour: 'H',
    day: 'J',
    week: 'SEM',
    month: 'MOIS',
    year: 'AN',
  },
  en: {
    second: 'S',
    minute: 'MIN',
    hour: 'H',
    day: 'D',
    week: 'WK',
    month: 'MO',
    year: 'YR',
  },
};

export function unitTag(unit: Unit, lang: 'fr' | 'en'): string {
  return UNIT_TAG[lang][unit];
}

/**
 * Formate une durée en langage split-flap : valeur entière de la magnitude naturelle,
 * suivie du reste dans l'unité immédiatement inférieure si non nul.
 * Ex (DESIGN_SYSTEM.md §5.3) : 9000s -> "2 H 30", 259200s -> "3 J", 45s -> "45 S".
 */
export function formatSplitFlapDuration(durationSeconds: number, lang: 'fr' | 'en'): string {
  const magnitude = naturalMagnitude(durationSeconds);
  const magnitudeIndex = UNITS.indexOf(magnitude);
  const mainValue = Math.floor(durationSeconds / UNIT_FACTOR_SECONDS[magnitude]);
  const mainTag = unitTag(magnitude, lang);

  if (magnitudeIndex === 0) {
    return `${mainValue} ${mainTag}`;
  }

  const subUnit = UNITS[magnitudeIndex - 1];
  const remainderSeconds = durationSeconds - mainValue * UNIT_FACTOR_SECONDS[magnitude];
  const remainderValue = Math.round(remainderSeconds / UNIT_FACTOR_SECONDS[subUnit]);

  if (remainderValue === 0) {
    return `${mainValue} ${mainTag}`;
  }

  return `${mainValue} ${mainTag} ${remainderValue} ${unitTag(subUnit, lang)}`;
}
