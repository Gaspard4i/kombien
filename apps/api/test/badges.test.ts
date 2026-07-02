import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BADGE_SLUGS,
  hasSpeedrunner,
  hasBullseye,
  hasOnFire,
  hasSharpshooter,
  hasPerfectRound,
  hasCenturion,
  evaluateBadges,
  type PlayedAnswer,
} from '../src/domain/badges.ts';

function answer(over: Partial<PlayedAnswer>): PlayedAnswer {
  return {
    mode: 'binaire',
    roundIndex: 0,
    responseTimeMs: 5000,
    goodAnswer: false,
    exactMagnitude: false,
    wonDuel: false,
    durationSeconds: 3600,
    duelErrorSeconds: 0,
    streakAfter: 0,
    ...over,
  };
}

test('BADGE_SLUGS contient les 10 badges du seed', () => {
  assert.equal(BADGE_SLUGS.length, 10);
  assert.ok(BADGE_SLUGS.includes('time_lord'));
});

test('hasSpeedrunner : bonne réponse en < 3000 ms', () => {
  assert.equal(hasSpeedrunner([answer({ goodAnswer: true, responseTimeMs: 2999 })]), true);
  assert.equal(hasSpeedrunner([answer({ goodAnswer: true, responseTimeMs: 3000 })]), false);
  assert.equal(hasSpeedrunner([answer({ goodAnswer: false, responseTimeMs: 100 })]), false);
});

test('hasBullseye : exacte en ordre de grandeur', () => {
  assert.equal(
    hasBullseye([answer({ mode: 'ordre_de_grandeur', exactMagnitude: true })]),
    true,
  );
  assert.equal(
    hasBullseye([answer({ mode: 'ordre_de_grandeur', exactMagnitude: false })]),
    false,
  );
  assert.equal(hasBullseye([answer({ mode: 'binaire', exactMagnitude: true })]), false);
});

test('hasOnFire : streak atteint >= 5', () => {
  assert.equal(hasOnFire([answer({ streakAfter: 5 })]), true);
  assert.equal(hasOnFire([answer({ streakAfter: 4 })]), false);
});

test('hasSharpshooter : duel gagné avec écart <= 10 %', () => {
  assert.equal(
    hasSharpshooter([answer({ mode: 'duel', wonDuel: true, durationSeconds: 3600, duelErrorSeconds: 360 })]),
    true,
  );
  assert.equal(
    hasSharpshooter([answer({ mode: 'duel', wonDuel: true, durationSeconds: 3600, duelErrorSeconds: 361 })]),
    false,
  );
  assert.equal(
    hasSharpshooter([answer({ mode: 'duel', wonDuel: false, durationSeconds: 3600, duelErrorSeconds: 0 })]),
    false,
  );
});

test('hasPerfectRound : toutes bonnes sur une manche', () => {
  const perfect = [
    answer({ roundIndex: 1, goodAnswer: true }),
    answer({ roundIndex: 1, goodAnswer: true }),
  ];
  assert.equal(hasPerfectRound(perfect), true);

  const imperfect = [
    answer({ roundIndex: 1, goodAnswer: true }),
    answer({ roundIndex: 1, goodAnswer: false }),
  ];
  assert.equal(hasPerfectRound(imperfect), false);
});

test('hasPerfectRound : liste vide -> false', () => {
  assert.equal(hasPerfectRound([]), false);
});

test('hasPerfectRound : une manche parfaite parmi plusieurs suffit', () => {
  const answers = [
    answer({ roundIndex: 0, goodAnswer: false }),
    answer({ roundIndex: 1, goodAnswer: true }),
    answer({ roundIndex: 1, goodAnswer: true }),
  ];
  assert.equal(hasPerfectRound(answers), true);
});

test('hasCenturion : score final >= 100', () => {
  assert.equal(hasCenturion(100), true);
  assert.equal(hasCenturion(99), false);
});

test('evaluateBadges : profil premier jeu débloque first_game', () => {
  const badges = evaluateBadges(
    { answers: [], finalScore: 0, lang: 'fr' },
    { gamesPlayed: 1, duelsWon: 0, xp: 0, playedFr: true, playedEn: false },
  );
  assert.deepEqual(badges, ['first_game']);
});

test('evaluateBadges : aucun badge si conditions non remplies', () => {
  const badges = evaluateBadges(
    { answers: [], finalScore: 0, lang: 'fr' },
    { gamesPlayed: 0, duelsWon: 0, xp: 0, playedFr: false, playedEn: false },
  );
  assert.deepEqual(badges, []);
});

test('evaluateBadges : cumul duel_master, centurion, polyglot, time_lord', () => {
  const badges = evaluateBadges(
    { answers: [], finalScore: 100, lang: 'en' },
    { gamesPlayed: 5, duelsWon: 10, xp: 8100, playedFr: true, playedEn: true },
  );
  assert.ok(badges.includes('duel_master'));
  assert.ok(badges.includes('centurion'));
  assert.ok(badges.includes('polyglot'));
  assert.ok(badges.includes('time_lord'));
  assert.ok(badges.includes('first_game'));
});

test('evaluateBadges : manche parfaite débloque perfect_round', () => {
  const answers: PlayedAnswer[] = [
    answer({ roundIndex: 0, goodAnswer: true }),
    answer({ roundIndex: 0, goodAnswer: true }),
  ];
  const badges = evaluateBadges(
    { answers, finalScore: 4, lang: 'fr' },
    { gamesPlayed: 0, duelsWon: 0, xp: 0, playedFr: false, playedEn: false },
  );
  assert.ok(badges.includes('perfect_round'));
});

test('evaluateBadges : badges par-réponse (speedrunner, bullseye, on_fire, sharpshooter)', () => {
  const answers: PlayedAnswer[] = [
    answer({ mode: 'ordre_de_grandeur', exactMagnitude: true, goodAnswer: true, responseTimeMs: 1000 }),
    answer({ streakAfter: 5 }),
    answer({ mode: 'duel', wonDuel: true, durationSeconds: 1000, duelErrorSeconds: 50 }),
  ];
  const badges = evaluateBadges(
    { answers, finalScore: 10, lang: 'fr' },
    { gamesPlayed: 2, duelsWon: 1, xp: 0, playedFr: true, playedEn: false },
  );
  assert.ok(badges.includes('speedrunner'));
  assert.ok(badges.includes('bullseye'));
  assert.ok(badges.includes('on_fire'));
  assert.ok(badges.includes('sharpshooter'));
});
