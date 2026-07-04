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
  // Questions différenciées (GAME_DESIGN_V2.md §5.3) : chaque joueur peut avoir sa
  // propre question, donc sa propre durée réelle. Absent = durée commune (v1/Duo
  // standard, cf. paramètre `durationSeconds` de scoreDuelRanked).
  durationSeconds?: number;
  // Timer de réponse expiré, pass-and-play (v2.1, GAME_DESIGN_V2.md §6.2 repris hors
  // multi-écrans) : ce joueur n'a pas répondu dans le délai. Écart traité comme infini —
  // ne peut jamais entrer dans le groupe de tête, quelle que soit la valeur de `value`/
  // `unit` reçue (le client envoie une estimation arbitraire non exploitable, jamais
  // faisant foi : c'est ce flag, pas la valeur, qui détermine le résultat).
  noAnswer?: boolean;
}

export interface DuelResult {
  pointsA: number;
  pointsB: number;
  errorA: number;
  errorB: number;
}

// GAME_DESIGN_V2.md §1.3 et §5.3 — Duel à N joueurs : seul le groupe de tête marque des
// points, qu'il partage à parts égales (floor(2 / k), k = nombre d'ex-æquo). Le rang se
// calcule sur l'ÉCART RELATIF (|estimation - durée| / durée) et non l'écart absolu, dès
// que les questions sont différenciées par joueur (§5.3) : sans cela, un joueur tombé sur
// une longue durée serait mécaniquement avantagé (60s d'écart est énorme sur 2 minutes,
// négligeable sur un an). `durationSeconds` (paramètre) reste la durée par défaut pour
// toute estimation qui ne porte pas la sienne (`DuelEstimate.durationSeconds` absent) —
// c'est le cas v1/questions communes : diviser deux écarts absolus par la MÊME constante
// ne change ni leur ordre ni les égalités, donc le classement (et les points) sont
// rigoureusement identiques à l'écart absolu v1. Aucune régression.
export function scoreDuelRanked(estimates: DuelEstimate[], durationSeconds: number): number[] {
  const errors = estimates.map((e) => {
    if (e.noAnswer) return Infinity;
    const trueDuration = e.durationSeconds ?? durationSeconds;
    return Math.abs(toSeconds(e.value, e.unit) - trueDuration) / trueDuration;
  });
  const bestError = Math.min(...errors);
  const leadCount = errors.filter((e) => e === bestError).length;
  const leadPoints = Number.isFinite(bestError) ? Math.floor(2 / leadCount) : 0;

  return errors.map((error) => (error === bestError && Number.isFinite(error) ? leadPoints : 0));
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
