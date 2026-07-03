// Sept unités de temps (GAME_DESIGN.md §1). Mois = 30 j, année = 365 j : constantes du jeu,
// jamais recalculées à partir d'un calendrier réel.

export type Unit = 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';

export const UNITS: readonly Unit[] = ['second', 'minute', 'hour', 'day', 'week', 'month', 'year'];

export const UNIT_FACTOR_SECONDS: Record<Unit, number> = {
  second: 1,
  minute: 60,
  hour: 3600,
  day: 86400,
  week: 604800,
  month: 2592000,
  year: 31536000,
};

export const UNIT_RANK: Record<Unit, number> = {
  second: 0,
  minute: 1,
  hour: 2,
  day: 3,
  week: 4,
  month: 5,
  year: 6,
};

export function toSeconds(value: number, unit: Unit): number {
  return value * UNIT_FACTOR_SECONDS[unit];
}

export function areAdjacent(a: Unit, b: Unit): boolean {
  return Math.abs(UNIT_RANK[a] - UNIT_RANK[b]) === 1;
}

/**
 * Magnitude naturelle d'une durée (GAME_DESIGN.md §2) : la plus grande unité dont
 * le facteur est <= d. Bornes inclusives en bas (60s -> minute, pas second).
 */
export function naturalMagnitude(durationSeconds: number): Unit {
  for (let i = UNITS.length - 1; i >= 0; i--) {
    const unit = UNITS[i];
    if (durationSeconds >= UNIT_FACTOR_SECONDS[unit]) {
      return unit;
    }
  }
  return 'second';
}
