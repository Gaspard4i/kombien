// Agrégation d'une partie complète côté serveur : à partir des réponses brutes
// de chaque joueur, recalcule score final, précision, meilleur streak et
// données par-réponse nécessaires à l'évaluation des exploits de session.
// Fonctions pures (pas d'I/O) — GAME_DESIGN §3-§9.

import { type UnitSlug } from './units.ts';
import {
  scoreBinary,
  scoreMagnitude,
  scoreDuel,
  type BinaryAnswer,
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

  // duel (perspective de CE joueur)
  estValue?: number;
  estUnit?: UnitSlug;
  opponentEstValue?: number;
  opponentEstUnit?: UnitSlug;
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
      const r = scoreDuel(
        { value: raw.estValue!, unit: raw.estUnit! },
        { value: raw.opponentEstValue!, unit: raw.opponentEstUnit! },
        raw.durationSeconds,
      );
      basePoints = r.pointsA;
      opponentBasePoints = r.pointsB;
      duelErrorSeconds = r.errorA;
      wonDuel = r.pointsA === 2;
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

// Détermine le(s) vainqueur(s) d'une partie à deux joueurs. Égalité -> match nul.
export interface WinnerResult {
  winnerIndex: number | null; // 0, 1, ou null (match nul)
  isDraw: boolean;
}

export function decideWinner(scoreA: number, scoreB: number): WinnerResult {
  if (scoreA > scoreB) return { winnerIndex: 0, isDraw: false };
  if (scoreB > scoreA) return { winnerIndex: 1, isDraw: false };
  return { winnerIndex: null, isDraw: true };
}
