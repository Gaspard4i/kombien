// Évaluation des conditions de badges — GAME_DESIGN §8.
// Fonctions pures calculées à partir des données d'une partie (réponses
// horodatées) et du profil cumulé. L'idempotence (un badge par pseudo) est
// gérée à la persistance, pas ici.

import type { GameMode } from './streak.ts';
import { levelForXp } from './xp.ts';

export const BADGE_SLUGS = [
  'first_game',
  'speedrunner',
  'bullseye',
  'perfect_round',
  'on_fire',
  'sharpshooter',
  'duel_master',
  'centurion',
  'polyglot',
  'time_lord',
] as const;

export type BadgeSlug = (typeof BADGE_SLUGS)[number];

// Une réponse jouée par un joueur, telle qu'exploitable pour l'évaluation.
export interface PlayedAnswer {
  mode: GameMode;
  roundIndex: number; // index de la manche (pour perfect_round)
  responseTimeMs: number;
  goodAnswer: boolean; // §6.1
  exactMagnitude: boolean; // ordre de grandeur : 3 pts
  wonDuel: boolean; // duel : 2 pts marqués
  durationSeconds: number;
  duelErrorSeconds: number; // écart absolu du joueur (duel uniquement)
  streakAfter: number; // streak du joueur après cette réponse
}

// Vue par joueur d'une partie terminée.
export interface PlayerGameData {
  answers: PlayedAnswer[];
  finalScore: number;
  lang: 'fr' | 'en';
}

// Compteurs de profil APRÈS prise en compte de la partie courante.
export interface PlayerProfileData {
  gamesPlayed: number;
  duelsWon: number;
  xp: number;
  playedFr: boolean;
  playedEn: boolean;
}

// speedrunner : une bonne réponse en < 3000 ms.
export function hasSpeedrunner(answers: PlayedAnswer[]): boolean {
  return answers.some((a) => a.goodAnswer && a.responseTimeMs < 3000);
}

// bullseye : au moins une réponse exacte en ordre de grandeur.
export function hasBullseye(answers: PlayedAnswer[]): boolean {
  return answers.some((a) => a.mode === 'ordre_de_grandeur' && a.exactMagnitude);
}

// on_fire : le streak atteint >= 5 à un moment.
export function hasOnFire(answers: PlayedAnswer[]): boolean {
  return answers.some((a) => a.streakAfter >= 5);
}

// sharpshooter : gagner un duel avec écart <= 10 % de la durée réelle.
export function hasSharpshooter(answers: PlayedAnswer[]): boolean {
  return answers.some(
    (a) => a.mode === 'duel' && a.wonDuel && a.duelErrorSeconds <= 0.1 * a.durationSeconds,
  );
}

// perfect_round : une manche où le joueur a une bonne réponse à TOUTES ses questions.
export function hasPerfectRound(answers: PlayedAnswer[]): boolean {
  if (answers.length === 0) return false;
  const rounds = new Map<number, { total: number; good: number }>();
  for (const a of answers) {
    const acc = rounds.get(a.roundIndex) ?? { total: 0, good: 0 };
    acc.total += 1;
    if (a.goodAnswer) acc.good += 1;
    rounds.set(a.roundIndex, acc);
  }
  for (const { total, good } of rounds.values()) {
    if (total > 0 && good === total) return true;
  }
  return false;
}

// centurion : score final >= 100 dans la partie.
export function hasCenturion(finalScore: number): boolean {
  return finalScore >= 100;
}

// Évalue tous les badges nouvellement remplis pour un joueur à la fin d'une partie.
// Ne filtre PAS les badges déjà possédés : la persistance s'en charge (idempotence).
export function evaluateBadges(
  game: PlayerGameData,
  profile: PlayerProfileData,
): BadgeSlug[] {
  const unlocked: BadgeSlug[] = [];

  if (profile.gamesPlayed >= 1) unlocked.push('first_game');
  if (hasSpeedrunner(game.answers)) unlocked.push('speedrunner');
  if (hasBullseye(game.answers)) unlocked.push('bullseye');
  if (hasPerfectRound(game.answers)) unlocked.push('perfect_round');
  if (hasOnFire(game.answers)) unlocked.push('on_fire');
  if (hasSharpshooter(game.answers)) unlocked.push('sharpshooter');
  if (profile.duelsWon >= 10) unlocked.push('duel_master');
  if (hasCenturion(game.finalScore)) unlocked.push('centurion');
  if (profile.playedFr && profile.playedEn) unlocked.push('polyglot');
  if (levelForXp(profile.xp) >= 10) unlocked.push('time_lord');

  return unlocked;
}
