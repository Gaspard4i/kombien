import { test } from 'node:test';
import assert from 'node:assert/strict';
import { multiplier, isGoodAnswer, applyAnswer } from '../src/domain/streak.ts';

test('multiplier : paliers exacts ×1/×2/×3', () => {
  assert.equal(multiplier(0), 1);
  assert.equal(multiplier(1), 1);
  assert.equal(multiplier(2), 1);
  assert.equal(multiplier(3), 2);
  assert.equal(multiplier(4), 2);
  assert.equal(multiplier(5), 3);
  assert.equal(multiplier(10), 3);
});

test('isGoodAnswer binaire : correct = 1 pt', () => {
  assert.equal(isGoodAnswer({ mode: 'binaire', basePoints: 1 }), true);
  assert.equal(isGoodAnswer({ mode: 'binaire', basePoints: 0 }), false);
});

test('isGoodAnswer ordre_de_grandeur : exacte OU adjacente (>= 1 pt)', () => {
  assert.equal(isGoodAnswer({ mode: 'ordre_de_grandeur', basePoints: 3 }), true);
  assert.equal(isGoodAnswer({ mode: 'ordre_de_grandeur', basePoints: 1 }), true);
  assert.equal(isGoodAnswer({ mode: 'ordre_de_grandeur', basePoints: 0 }), false);
});

test('isGoodAnswer duel : gagner ou égaliser (>=1 et >= adversaire)', () => {
  assert.equal(isGoodAnswer({ mode: 'duel', basePoints: 2, opponentBasePoints: 0 }), true);
  assert.equal(isGoodAnswer({ mode: 'duel', basePoints: 1, opponentBasePoints: 1 }), true);
  assert.equal(isGoodAnswer({ mode: 'duel', basePoints: 0, opponentBasePoints: 2 }), false);
});

test('isGoodAnswer duel : opponentBasePoints absent -> défaut 0', () => {
  assert.equal(isGoodAnswer({ mode: 'duel', basePoints: 2 }), true);
  assert.equal(isGoodAnswer({ mode: 'duel', basePoints: 0 }), false);
});

test('applyAnswer : bonne réponse incrémente et applique le multiplicateur du nouveau streak', () => {
  // 4e bonne réponse -> streak 5 -> ×3. Base 3 (ordre exact) -> 9.
  const step = applyAnswer(4, { mode: 'ordre_de_grandeur', basePoints: 3 });
  assert.equal(step.newStreak, 5);
  assert.equal(step.finalPoints, 9);
  assert.equal(step.goodAnswer, true);
});

test('applyAnswer : palier ×2 atteint exactement à 3', () => {
  const step = applyAnswer(2, { mode: 'binaire', basePoints: 1 });
  assert.equal(step.newStreak, 3);
  assert.equal(step.finalPoints, 2); // 1 * ×2
});

test('applyAnswer : mauvaise réponse reset à 0, points de base ×1', () => {
  const step = applyAnswer(4, { mode: 'ordre_de_grandeur', basePoints: 0 });
  assert.equal(step.newStreak, 0);
  assert.equal(step.finalPoints, 0);
  assert.equal(step.goodAnswer, false);
});

test('applyAnswer : streak < 3 reste ×1', () => {
  const step = applyAnswer(0, { mode: 'binaire', basePoints: 1 });
  assert.equal(step.newStreak, 1);
  assert.equal(step.finalPoints, 1);
});

test('applyAnswer : duel perdu (0 pt) casse la série', () => {
  const step = applyAnswer(3, { mode: 'duel', basePoints: 0, opponentBasePoints: 2 });
  assert.equal(step.newStreak, 0);
  assert.equal(step.finalPoints, 0);
  assert.equal(step.goodAnswer, false);
});
