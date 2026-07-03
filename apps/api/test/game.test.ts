import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computePlayerRun,
  decideWinner,
  type RawAnswer,
} from '../src/domain/game.ts';

test('computePlayerRun : binaire, streak et multiplicateur cumulés', () => {
  // 5 bonnes réponses binaires d'affilée : 1,1,2,2,3 = 9 pts. bestStreak 5.
  const answers: RawAnswer[] = Array.from({ length: 5 }, (_, i) => ({
    mode: 'binaire',
    questionId: i + 1,
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
});

test('computePlayerRun : mauvaise réponse reset le streak', () => {
  const answers: RawAnswer[] = [
    { mode: 'binaire', questionId: 1, roundIndex: 0, responseTimeMs: 1000, durationSeconds: 7200, binaryAnswer: 'yes', thresholdSeconds: 3600 },
    { mode: 'binaire', questionId: 2, roundIndex: 0, responseTimeMs: 1000, durationSeconds: 1800, binaryAnswer: 'yes', thresholdSeconds: 3600 }, // faux
    { mode: 'binaire', questionId: 3, roundIndex: 0, responseTimeMs: 1000, durationSeconds: 7200, binaryAnswer: 'yes', thresholdSeconds: 3600 },
  ];
  const c = computePlayerRun({ answers });
  assert.equal(c.goodAnswers, 2);
  assert.equal(c.bestStreak, 1);
  assert.equal(c.finalScore, 2); // 1 + 0 + 1
});

test('computePlayerRun : ordre de grandeur exact', () => {
  const answers: RawAnswer[] = [
    { mode: 'ordre_de_grandeur', questionId: 1, roundIndex: 0, responseTimeMs: 2000, durationSeconds: 259200, chosenUnit: 'day' },
  ];
  const c = computePlayerRun({ answers });
  assert.equal(c.finalScore, 3);
  assert.equal(c.playedAnswers[0]!.exactMagnitude, true);
});

test('computePlayerRun : duel gagné compte duelsWon', () => {
  const answers: RawAnswer[] = [
    {
      mode: 'duel',
      questionId: 1,
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
  assert.equal(c.playedAnswers[0]!.wonDuel, true);
  assert.equal(c.playedAnswers[0]!.duelErrorSeconds, 0);
});

test('computePlayerRun : duel perdu, aucun point', () => {
  const answers: RawAnswer[] = [
    {
      mode: 'duel',
      questionId: 1,
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
