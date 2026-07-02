// XP et niveaux — GAME_DESIGN §7.
// L'XP ne subit jamais le multiplicateur de streak. Calculée backend, monotone.

import type { GameMode } from './streak.ts';

export const XP_GOOD_ANSWER = 10;
export const XP_EXACT_MAGNITUDE_BONUS = 5;
export const XP_DUEL_WIN_BONUS = 5;
export const XP_BADGE = 50;
export const XP_FINISH_GAME = 25;
export const XP_WIN_GAME_BONUS = 50;

export interface AnswerXpInput {
  mode: GameMode;
  goodAnswer: boolean; // au sens streak §6.1
  exactMagnitude: boolean; // ordre de grandeur : 3 pts base
  wonDuel: boolean; // duel : 2 pts marqués
}

// XP d'une réponse (hors badges). Les bonus sont cumulables avec +10.
export function xpForAnswer(input: AnswerXpInput): number {
  let xp = 0;
  if (input.goodAnswer) {
    xp += XP_GOOD_ANSWER;
  }
  if (input.mode === 'ordre_de_grandeur' && input.exactMagnitude) {
    xp += XP_EXACT_MAGNITUDE_BONUS;
  }
  if (input.mode === 'duel' && input.wonDuel) {
    xp += XP_DUEL_WIN_BONUS;
  }
  return xp;
}

// XP de fin de partie : terminer (+25), gagner (+50 bonus cumulable).
export function xpForGameEnd(isWinner: boolean): number {
  return XP_FINISH_GAME + (isWinner ? XP_WIN_GAME_BONUS : 0);
}

// §7 — niveau = floor(sqrt(xp / 100)) + 1.
export function levelForXp(xp: number): number {
  return Math.floor(Math.sqrt(xp / 100)) + 1;
}
