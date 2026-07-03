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

// GAME_DESIGN_V2.md §1.3 — Duel à N joueurs : seul le groupe de tête (le ou les joueurs au
// plus petit écart absolu) marque des points. Le groupe de tête se partage un pool fixe de
// 2 points, arrondi à l'entier inférieur : floor(2 / k) où k = nombre de joueurs ex-æquo au
// meilleur écart. Tous les autres joueurs (hors du groupe de tête) marquent 0. Se réduit
// exactement au barème v1 pour 2 joueurs (k=1 -> 2/0, k=2 -> 1/1 en cas d'égalité) : aucune
// régression pour les parties Duo existantes.
export function scoreDuelRanked(estimates: DuelEstimate[], durationSeconds: number): number[] {
  const errors = estimates.map((e) => Math.abs(toSeconds(e.value, e.unit) - durationSeconds));
  const bestError = Math.min(...errors);
  const leadCount = errors.filter((e) => e === bestError).length;
  const leadPoints = Math.floor(2 / leadCount);

  return errors.map((error) => (error === bestError ? leadPoints : 0));
}

// §5 — le plus proche marque 2, égalité stricte d'écart = 1-1. Comparaison directe (pas d'epsilon).
// Cas particulier de scoreDuelRanked à 2 joueurs (aucune régression).
export function scoreDuel(
  estA: DuelEstimate,
  estB: DuelEstimate,
  durationSeconds: number,
): DuelResult {
  const [pointsA, pointsB] = scoreDuelRanked([estA, estB], durationSeconds);
  const errorA = Math.abs(toSeconds(estA.value, estA.unit) - durationSeconds);
  const errorB = Math.abs(toSeconds(estB.value, estB.unit) - durationSeconds);
  return { pointsA: pointsA!, pointsB: pointsB!, errorA, errorB };
}
