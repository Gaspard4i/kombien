import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computePlayerRun,
  decideWinner,
  xpForPlayer,
  type RawAnswer,
} from '../src/domain/game.ts';

test('computePlayerRun : binaire, streak et multiplicateur cumulés', () => {
  // 5 bonnes réponses binaires d'affilée : 1,1,2,2,3 = 9 pts. bestStreak 5.
  const answers: RawAnswer[] = Array.from({ length: 5 }, (_, i) => ({
    mode: 'binaire',
    roundIndex: 0,
    responseTimeMs: 4000,
    durationSeconds: 7200,
    binaryAnswer: 'yes',
    thresholdSeconds: 3600,
  }));
  const c = computePlayerRun({ answers });
  assert.equal(c.finalScore, 9);
  assert.equal(c.goodAnswers, 5);
  assert.equal(c.totalAnswers, 5);
  assert.equal(c.bestStreak, 5);
  assert.equal(c.accuracy, 1);
  // XP : 5 bonnes réponses * 10 = 50 (pas de multiplicateur sur XP).
  assert.equal(c.xpFromAnswers, 50);
});

test('computePlayerRun : mauvaise réponse reset le streak', () => {
  const answers: RawAnswer[] = [
    { mode: 'binaire', roundIndex: 0, responseTimeMs: 1000, durationSeconds: 7200, binaryAnswer: 'yes', thresholdSeconds: 3600 },
    { mode: 'binaire', roundIndex: 0, responseTimeMs: 1000, durationSeconds: 1800, binaryAnswer: 'yes', thresholdSeconds: 3600 }, // faux
    { mode: 'binaire', roundIndex: 0, responseTimeMs: 1000, durationSeconds: 7200, binaryAnswer: 'yes', thresholdSeconds: 3600 },
  ];
  const c = computePlayerRun({ answers });
  assert.equal(c.goodAnswers, 2);
  assert.equal(c.bestStreak, 1);
  assert.equal(c.finalScore, 2); // 1 + 0 + 1
});

test('computePlayerRun : ordre de grandeur exact donne bonus XP', () => {
  const answers: RawAnswer[] = [
    { mode: 'ordre_de_grandeur', roundIndex: 0, responseTimeMs: 2000, durationSeconds: 259200, chosenUnit: 'day' },
  ];
  const c = computePlayerRun({ answers });
  assert.equal(c.finalScore, 3);
  assert.equal(c.xpFromAnswers, 15); // 10 + 5 bonus exact
  assert.equal(c.playedAnswers[0].exactMagnitude, true);
});

test('computePlayerRun : duel gagné compte duelsWon et bonus XP', () => {
  const answers: RawAnswer[] = [
    {
      mode: 'duel',
      roundIndex: 0,
      responseTimeMs: 2000,
      durationSeconds: 3600,
      estValue: 1,
      estUnit: 'hour',
      opponentEstValue: 3,
      opponentEstUnit: 'hour',
    },
  ];
  const c = computePlayerRun({ answers });
  assert.equal(c.finalScore, 2);
  assert.equal(c.duelsWon, 1);
  assert.equal(c.xpFromAnswers, 15); // 10 + 5 bonus duel
  assert.equal(c.playedAnswers[0].wonDuel, true);
  assert.equal(c.playedAnswers[0].duelErrorSeconds, 0);
});

test('computePlayerRun : duel perdu, aucun point ni XP', () => {
  const answers: RawAnswer[] = [
    {
      mode: 'duel',
      roundIndex: 0,
      responseTimeMs: 2000,
      durationSeconds: 3600,
      estValue: 10,
      estUnit: 'hour',
      opponentEstValue: 1,
      opponentEstUnit: 'hour',
    },
  ];
  const c = computePlayerRun({ answers });
  assert.equal(c.finalScore, 0);
  assert.equal(c.duelsWon, 0);
  assert.equal(c.xpFromAnswers, 0);
});

test('computePlayerRun : partie sans réponse -> accuracy 0', () => {
  const c = computePlayerRun({ answers: [] });
  assert.equal(c.accuracy, 0);
  assert.equal(c.totalAnswers, 0);
  assert.equal(c.finalScore, 0);
});

test('decideWinner : A, B ou match nul', () => {
  assert.deepEqual(decideWinner(10, 5), { winnerIndex: 0, isDraw: false });
  assert.deepEqual(decideWinner(5, 10), { winnerIndex: 1, isDraw: false });
  assert.deepEqual(decideWinner(7, 7), { winnerIndex: null, isDraw: true });
});

test('xpForPlayer : réponses + fin de partie (gagnant / perdant)', () => {
  const c = computePlayerRun({
    answers: [
      { mode: 'binaire', roundIndex: 0, responseTimeMs: 1000, durationSeconds: 7200, binaryAnswer: 'yes', thresholdSeconds: 3600 },
    ],
  });
  // 10 (réponse) + 25 (terminer) = 35 perdant ; + 50 gagnant = 85.
  assert.equal(xpForPlayer(c, false), 35);
  assert.equal(xpForPlayer(c, true), 85);
});
