// Unités de temps et conversions — GAME_DESIGN §1 et §2.
// Facteurs fixes : mois = 30 jours, année = 365 jours (constantes du jeu).

export type UnitSlug = 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';

// Ordonnées par rang croissant (index = rang).
export const UNITS: readonly UnitSlug[] = [
  'second',
  'minute',
  'hour',
  'day',
  'week',
  'month',
  'year',
] as const;

const FACTORS: Record<UnitSlug, number> = {
  second: 1,
  minute: 60,
  hour: 3600,
  day: 86400,
  week: 604800,
  month: 2592000,
  year: 31536000,
};

export function isUnit(value: string): value is UnitSlug {
  return value in FACTORS;
}

export function factor(unit: UnitSlug): number {
  return FACTORS[unit];
}

export function rank(unit: UnitSlug): number {
  return UNITS.indexOf(unit);
}

// §1.1 — valeur (> 0) * facteur(unité). Le contrôle de valeur > 0 est fait en amont (validation).
export function toSeconds(value: number, unit: UnitSlug): number {
  return value * factor(unit);
}

// Deux unités sont adjacentes si |rang(a) - rang(b)| == 1.
export function areAdjacent(a: UnitSlug, b: UnitSlug): boolean {
  return Math.abs(rank(a) - rank(b)) === 1;
}

// §2 — plus grande unité dont le facteur est <= d (bornes basses inclusives).
// d en secondes, d > 0. Une durée < 60s a pour magnitude 'second'.
export function naturalMagnitude(seconds: number): UnitSlug {
  for (let i = UNITS.length - 1; i >= 0; i--) {
    const unit = UNITS[i]!;
    if (seconds >= factor(unit)) {
      return unit;
    }
  }
  return 'second';
}
