// Scoring par question — GAME_DESIGN §3, §4, §5.
// Fonctions pures : points de base (avant multiplicateur de streak).

import { type UnitSlug, naturalMagnitude, areAdjacent, toSeconds } from './units.ts';

export type BinaryAnswer = 'yes' | 'no';

export interface BinaryResult {
  points: number;
  correct: boolean;
}

// §3 — « longtemps » ssi duration >= threshold (borne inclusive : == compte comme longtemps).
export function scoreBinary(
  answer: BinaryAnswer,
  thresholdSeconds: number,
  durationSeconds: number,
): BinaryResult {
  const isLong = durationSeconds >= thresholdSeconds;
  const correct = answer === 'yes' ? isLong : !isLong;
  return { points: correct ? 1 : 0, correct };
}

export interface MagnitudeResult {
  points: number;
  correctUnit: UnitSlug;
  exact: boolean;
  adjacent: boolean;
}

// §4 — exacte = 3, adjacente = 1, sinon 0. Unité correcte = magnitude naturelle.
export function scoreMagnitude(chosenUnit: UnitSlug, durationSeconds: number): MagnitudeResult {
  const correctUnit = naturalMagnitude(durationSeconds);
  if (chosenUnit === correctUnit) {
    return { points: 3, correctUnit, exact: true, adjacent: false };
  }
  if (areAdjacent(chosenUnit, correctUnit)) {
    return { points: 1, correctUnit, exact: false, adjacent: true };
  }
  return { points: 0, correctUnit, exact: false, adjacent: false };
}

export interface DuelEstimate {
  value: number;
  unit: UnitSlug;
}

export interface DuelResult {
  pointsA: number;
  pointsB: number;
  errorA: number;
  errorB: number;
}

// §5 — le plus proche marque 2, égalité stricte d'écart = 1-1. Comparaison directe (pas d'epsilon).
export function scoreDuel(
  estA: DuelEstimate,
  estB: DuelEstimate,
  durationSeconds: number,
): DuelResult {
  const errorA = Math.abs(toSeconds(estA.value, estA.unit) - durationSeconds);
  const errorB = Math.abs(toSeconds(estB.value, estB.unit) - durationSeconds);
  if (errorA < errorB) {
    return { pointsA: 2, pointsB: 0, errorA, errorB };
  }
  if (errorB < errorA) {
    return { pointsA: 0, pointsB: 2, errorA, errorB };
  }
  return { pointsA: 1, pointsB: 1, errorA, errorB };
}
