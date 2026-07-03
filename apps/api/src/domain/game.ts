// Agrégation d'une partie complète côté serveur : à partir des réponses brutes
// de chaque joueur, recalcule score final, précision, meilleur streak et
// données par-réponse nécessaires à l'évaluation des exploits de session.
// Fonctions pures (pas d'I/O) — GAME_DESIGN §3-§9.

import { type UnitSlug, toSeconds } from './units.ts';
import {
  scoreBinary,
  scoreMagnitude,
  scoreDuelRanked,
  type BinaryAnswer,
  type DuelEstimate,
} from './scoring.ts';
import { applyAnswer, type GameMode } from './streak.ts';
import type { PlayedAnswer } from './exploits.ts';

// Réponse brute d'un joueur à une question, selon le mode. questionId permet
// au service appelant de recharger la vérité terrain (durationSeconds,
// thresholdSeconds) depuis la DB plutôt que de faire confiance au client.
export interface RawAnswer {
  mode: GameMode;
  questionId: number;
  roundIndex: number;
  responseTimeMs: number;
  durationSeconds: number;

  // binaire
  binaryAnswer?: BinaryAnswer;
  thresholdSeconds?: number;

  // ordre de grandeur
  chosenUnit?: UnitSlug;

  // duel (perspective de CE joueur) : estimation propre + estimations de TOUS les autres
  // joueurs sur la même question (GAME_DESIGN_V2.md §1.3, classement par rang d'écart à N
  // joueurs). opponentEstValue/opponentEstUnit (contrat v1, un seul adversaire) restent
  // acceptés en alias du cas N=2 pour compatibilité, mais opponentEstimates est la source
  // de vérité dès que présente.
  estValue?: number;
  estUnit?: UnitSlug;
  opponentEstValue?: number;
  opponentEstUnit?: UnitSlug;
  opponentEstimates?: DuelEstimate[];
}

// Normalise les adversaires d'une réponse duel en liste, quel que soit le format
// d'entrée (v1 un seul adversaire, ou v2 liste explicite pour N joueurs).
function resolveOpponentEstimates(raw: RawAnswer): DuelEstimate[] {
  if (raw.opponentEstimates) return raw.opponentEstimates;
  if (raw.opponentEstValue !== undefined && raw.opponentEstUnit !== undefined) {
    return [{ value: raw.opponentEstValue, unit: raw.opponentEstUnit }];
  }
  return [];
}

export interface PlayerRun {
  answers: RawAnswer[];
}

export interface PlayerComputed {
  finalScore: number;
  goodAnswers: number;
  totalAnswers: number;
  accuracy: number; // 0..1
  bestStreak: number;
  duelsWon: number; // duels gagnés (2 pts) dans cette partie
  playedAnswers: PlayedAnswer[]; // pour l'évaluation des exploits
}

// Calcule le résultat d'un joueur en rejouant ses réponses dans l'ordre.
// Le streak persiste sur toute la partie (à travers les manches).
export function computePlayerRun(run: PlayerRun): PlayerComputed {
  let streak = 0;
  let bestStreak = 0;
  let finalScore = 0;
  let goodAnswers = 0;
  let duelsWon = 0;
  const playedAnswers: PlayedAnswer[] = [];

  for (const raw of run.answers) {
    let basePoints = 0;
    let opponentBasePoints = 0;
    let exactMagnitude = false;
    let wonDuel = false;
    let duelErrorSeconds = 0;

    if (raw.mode === 'binaire') {
      const r = scoreBinary(raw.binaryAnswer!, raw.thresholdSeconds!, raw.durationSeconds);
      basePoints = r.points;
    } else if (raw.mode === 'ordre_de_grandeur') {
      const r = scoreMagnitude(raw.chosenUnit!, raw.durationSeconds);
      basePoints = r.points;
      exactMagnitude = r.exact;
    } else {
      const self: DuelEstimate = { value: raw.estValue!, unit: raw.estUnit! };
      const opponents = resolveOpponentEstimates(raw);
      const estimates = [self, ...opponents];
      const points = scoreDuelRanked(estimates, raw.durationSeconds);
      basePoints = points[0]!;
      // Le meilleur des points adverses détermine si CE joueur a "gagné ou égalisé"
      // (§6.1 : bonne réponse duel = marquer >= aux autres). Généralise le cas 1
      // adversaire (v1) où opponentBasePoints est simplement l'unique autre point.
      opponentBasePoints = points.length > 1 ? Math.max(...points.slice(1)) : 0;
      duelErrorSeconds = Math.abs(toSeconds(self.value, self.unit) - raw.durationSeconds);
      wonDuel = basePoints === 2;
      if (wonDuel) duelsWon += 1;
    }

    const step = applyAnswer(streak, {
      mode: raw.mode,
      basePoints,
      opponentBasePoints,
    });
    streak = step.newStreak;
    if (streak > bestStreak) bestStreak = streak;
    finalScore += step.finalPoints;
    if (step.goodAnswer) goodAnswers += 1;

    playedAnswers.push({
      mode: raw.mode,
      roundIndex: raw.roundIndex,
      responseTimeMs: raw.responseTimeMs,
      goodAnswer: step.goodAnswer,
      exactMagnitude,
      wonDuel,
      durationSeconds: raw.durationSeconds,
      duelErrorSeconds,
      streakAfter: streak,
    });
  }

  const totalAnswers = run.answers.length;
  const accuracy = totalAnswers === 0 ? 0 : goodAnswers / totalAnswers;

  return {
    finalScore,
    goodAnswers,
    totalAnswers,
    accuracy,
    bestStreak,
    duelsWon,
    playedAnswers,
  };
}

// Détermine le(s) vainqueur(s) d'une partie à N joueurs (GAME_DESIGN_V2.md §1.3) : le(s)
// joueur(s) au score le plus élevé gagnent. isDraw = true seulement si TOUS les joueurs
// sont à égalité (match nul général) ; une égalité de tête entre certains joueurs seulement
// (co-vainqueurs) n'est pas un match nul. Se réduit exactement au comportement v1 pour 2
// joueurs (isDraw ssi les deux scores sont égaux).
export interface WinnerResult {
  winnerIndices: number[]; // indices des joueurs au score le plus élevé (1 ou plusieurs)
  isDraw: boolean; // true ssi égalité générale (tous les joueurs à égalité)
}

export function decideWinners(scores: number[]): WinnerResult {
  const maxScore = Math.max(...scores);
  const winnerIndices = scores.reduce<number[]>((acc, s, i) => {
    if (s === maxScore) acc.push(i);
    return acc;
  }, []);
  const isDraw = winnerIndices.length === scores.length && scores.length > 1;
  return { winnerIndices, isDraw };
}
