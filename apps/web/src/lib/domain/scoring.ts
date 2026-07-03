// Scoring provisoire côté client, pour le feedback immédiat pendant la partie
// (barre de score/streak). La vérité vient toujours de la réponse POST /games
// (le backend recalcule tout à partir des réponses brutes — anti-triche, cf API_CONTRACT.md).

import { areAdjacent, naturalMagnitude, type Unit } from './units';

export type GameMode = 'binaire' | 'ordre_de_grandeur' | 'duel';

export interface RoundOutcome {
  points: number;
  isGoodAnswer: boolean;
}

export function scoreBinaire(answer: 'yes' | 'no', durationSeconds: number, thresholdSeconds: number): RoundOutcome {
  const isLong = durationSeconds >= thresholdSeconds;
  const correct = (answer === 'yes') === isLong;
  return { points: correct ? 1 : 0, isGoodAnswer: correct };
}

export function scoreOrdreDeGrandeur(chosenUnit: Unit, durationSeconds: number): RoundOutcome {
  const correctUnit = naturalMagnitude(durationSeconds);
  if (chosenUnit === correctUnit) {
    return { points: 3, isGoodAnswer: true };
  }
  if (areAdjacent(chosenUnit, correctUnit)) {
    return { points: 1, isGoodAnswer: true };
  }
  return { points: 0, isGoodAnswer: false };
}

/** Duel : points du joueur courant selon l'écart absolu comparé à celui de l'adversaire. */
export function scoreDuel(ownEstimateSeconds: number, opponentEstimateSeconds: number, durationSeconds: number): RoundOutcome {
  const ownError = Math.abs(ownEstimateSeconds - durationSeconds);
  const opponentError = Math.abs(opponentEstimateSeconds - durationSeconds);
  if (ownError < opponentError) {
    return { points: 2, isGoodAnswer: true };
  }
  if (ownError === opponentError) {
    return { points: 1, isGoodAnswer: true };
  }
  return { points: 0, isGoodAnswer: false };
}

/**
 * Duel à N joueurs (GAME_DESIGN_V2.md §1.3) : seul le groupe de tête (le ou les joueurs au
 * plus petit écart absolu) marque des points, en se partageant un pool fixe de 2 points
 * (floor(2 / k), k = nombre d'ex-æquo en tête). Tous les autres joueurs marquent 0. Se
 * réduit exactement au barème v1 pour 2 joueurs (k=1 -> 2/0, k=2 -> 1/1 en cas d'égalité).
 * Retourne un RoundOutcome par joueur, dans l'ordre de `estimateSeconds`.
 */
export function scoreDuelRanked(estimateSeconds: number[], durationSeconds: number): RoundOutcome[] {
  const errors = estimateSeconds.map((e) => Math.abs(e - durationSeconds));
  const bestError = Math.min(...errors);
  const leadCount = errors.filter((e) => e === bestError).length;
  const leadPoints = Math.floor(2 / leadCount);

  return errors.map((error) =>
    error === bestError ? { points: leadPoints, isGoodAnswer: leadPoints > 0 } : { points: 0, isGoodAnswer: false },
  );
}

/** Multiplicateur appliqué au streak après incrémentation de la question courante (GAME_DESIGN.md §6.2). */
export function streakMultiplier(streakAfter: number): number {
  if (streakAfter >= 5) return 3;
  if (streakAfter >= 3) return 2;
  return 1;
}

/** Fait évoluer le streak courant selon le résultat de la manche, renvoie le nouveau streak. */
export function nextStreak(currentStreak: number, isGoodAnswer: boolean): number {
  return isGoodAnswer ? currentStreak + 1 : 0;
}
