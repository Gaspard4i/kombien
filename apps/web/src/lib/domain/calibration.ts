// Calibration du mode Binaire (Lot 4 v2, GAME_DESIGN_V2.md §3). Port TypeScript
// exact de apps/api/src/domain/calibration.ts::deriveThreshold : le calcul est fait
// côté client (le joueur ne doit jamais voir le seuil des autres avant la fin de
// SA propre calibration), le résultat n'étant transmis au serveur qu'au moment du
// scoring (thresholdSeconds par réponse binaire, cf. API_CONTRACT.md POST /games).

export interface CalibrationAnswer {
  durationSeconds: number;
  answer: 'yes' | 'no';
}

function computeBounds(answers: CalibrationAnswer[]): { low: number; high: number } {
  const low = Math.max(0, ...answers.filter((a) => a.answer === 'no').map((a) => a.durationSeconds));
  const highs = answers.filter((a) => a.answer === 'yes').map((a) => a.durationSeconds);
  const high = highs.length > 0 ? Math.min(...highs) : Infinity;
  return { low, high };
}

/**
 * §3.3-3.4 : seuil individuel = moyenne géométrique des bornes basse (max des
 * "pas longtemps") et haute (min des "longtemps"), avec repli sur les cas
 * extrêmes (tout-Oui, tout-Non, incohérence/absence de signal -> seuil de la
 * catégorie jouée, categoryThresholdSeconds).
 */
export function deriveThreshold(answers: CalibrationAnswer[], categoryThresholdSeconds: number): number {
  const { low, high } = computeBounds(answers);

  if (low > 0 && !Number.isFinite(high)) {
    return low * 2; // tout "pas longtemps"
  }
  if (low === 0 && Number.isFinite(high)) {
    return high / 2; // tout "longtemps"
  }
  if (low === 0 && !Number.isFinite(high)) {
    return categoryThresholdSeconds; // aucune réponse exploitable
  }
  if (low >= high) {
    return categoryThresholdSeconds; // incohérence complète
  }

  return Math.sqrt(low * high);
}
