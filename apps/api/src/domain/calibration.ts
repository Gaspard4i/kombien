// Calibration du mode Binaire — GAME_DESIGN_V2.md §3.
//
// À partir des 5 réponses "longtemps"/"pas longtemps" d'un joueur sur le pool de
// calibration (durées connues, hors catégories de jeu), dérive un seuil individuel
// qui remplace threshold_seconds de la catégorie POUR CE JOUEUR, pour toute la partie.

import type { BinaryAnswer } from './scoring.ts';

export interface CalibrationAnswer {
  durationSeconds: number;
  answer: BinaryAnswer;
}

// §3.3 — bornes basse (max des "pas longtemps") et haute (min des "longtemps").
// borneBasse = 0 si aucune réponse "pas longtemps" ; borneHaute = +infini si aucune
// réponse "longtemps". Les inversions (répondre "longtemps" à une durée plus courte
// qu'une réponse "pas longtemps") sont ignorées : seuls les extrema comptent (§3.3).
function computeBounds(answers: CalibrationAnswer[]): { low: number; high: number } {
  const low = Math.max(0, ...answers.filter((a) => a.answer === 'no').map((a) => a.durationSeconds));
  const highs = answers.filter((a) => a.answer === 'yes').map((a) => a.durationSeconds);
  const high = highs.length > 0 ? Math.min(...highs) : Infinity;
  return { low, high };
}

// §3.4 — repli si le seuil de catégorie est le seul signal exploitable (incohérence
// complète). categoryThresholdSeconds : threshold_seconds de la catégorie jouée.
export function deriveThreshold(answers: CalibrationAnswer[], categoryThresholdSeconds: number): number {
  const { low, high } = computeBounds(answers);

  // Tout-Non : aucune réponse "longtemps" -> repli borne basse * 2 (§3.4).
  if (low > 0 && !Number.isFinite(high)) {
    return low * 2;
  }
  // Tout-Oui : aucune réponse "pas longtemps" -> repli borne haute / 2 (§3.4).
  if (low === 0 && Number.isFinite(high)) {
    return high / 2;
  }
  // Incohérence complète (borne basse >= borne haute) ou aucune réponse du tout
  // (low === 0 && high === Infinity) : repli sur le seuil de catégorie (§3.4).
  if (low === 0 && !Number.isFinite(high)) {
    return categoryThresholdSeconds;
  }
  if (low >= high) {
    return categoryThresholdSeconds;
  }

  // Cas nominal : moyenne géométrique des deux bornes (§3.3, centre logarithmique).
  return Math.sqrt(low * high);
}
