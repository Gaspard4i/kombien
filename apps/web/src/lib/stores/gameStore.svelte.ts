import type { GameMode } from '../domain/scoring';
import { nextStreak, streakMultiplier } from '../domain/scoring';
import type { Category, Question, RawAnswer } from '../api/types';

export type EndCondition = 'points' | 'manual';

export interface PlayerSlot {
  pseudo: string;
  answers: RawAnswer[];
  score: number;
  streak: number;
  bestStreak: number;
}

export interface GameConfig {
  mode: GameMode;
  category: Category;
  endCondition: EndCondition;
  targetScore: number;
  questionsPerRound: number;
}

export interface GameState {
  config: GameConfig | null;
  players: [PlayerSlot, PlayerSlot] | null;
  roundNumber: number;
  chooserIndex: 0 | 1;
  questions: Question[];
  questionIndex: number;
}

function emptyPlayer(pseudo: string): PlayerSlot {
  return { pseudo, answers: [], score: 0, streak: 0, bestStreak: 0 };
}

let state = $state<GameState>({
  config: null,
  players: null,
  roundNumber: 1,
  chooserIndex: 0,
  questions: [],
  questionIndex: 0,
});

export function getGameState(): GameState {
  return state;
}

export function startGame(config: GameConfig, pseudoA: string, pseudoB: string): void {
  state.config = config;
  state.players = [emptyPlayer(pseudoA), emptyPlayer(pseudoB)];
  state.roundNumber = 1;
  state.chooserIndex = 0;
  state.questions = [];
  state.questionIndex = 0;
}

export function setRoundQuestions(questions: Question[]): void {
  state.questions = questions;
  state.questionIndex = 0;
}

export function currentQuestion(): Question | null {
  return state.questions[state.questionIndex] ?? null;
}

/** Applique le résultat d'une réponse (points de base déjà calculés) à un joueur. */
export function recordAnswer(playerIndex: 0 | 1, answer: RawAnswer, basePoints: number, isGoodAnswer: boolean): void {
  const player = state.players?.[playerIndex];
  if (!player) return;

  player.answers.push(answer);
  const newStreak = nextStreak(player.streak, isGoodAnswer);
  const multiplier = streakMultiplier(newStreak);
  player.score += basePoints * multiplier;
  player.streak = newStreak;
  player.bestStreak = Math.max(player.bestStreak, newStreak);
}

export function advanceQuestion(): boolean {
  if (state.questionIndex + 1 < state.questions.length) {
    state.questionIndex += 1;
    return true;
  }
  return false;
}

/** Chooser croisé, alternance stricte par parité de manche (GAME_DESIGN.md §9.2). */
export function advanceRound(): void {
  state.roundNumber += 1;
  state.chooserIndex = state.chooserIndex === 0 ? 1 : 0;
  state.questions = [];
  state.questionIndex = 0;
}

export function isEndConditionMet(): boolean {
  if (!state.config || !state.players) return false;
  if (state.config.endCondition !== 'points') return false;
  return state.players.some((p) => p.score >= state.config!.targetScore);
}

export function resetGame(): void {
  state.config = null;
  state.players = null;
  state.roundNumber = 1;
  state.chooserIndex = 0;
  state.questions = [];
  state.questionIndex = 0;
}
