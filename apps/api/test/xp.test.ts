import { test } from 'node:test';
import assert from 'node:assert/strict';
import { xpForAnswer, xpForGameEnd, levelForXp } from '../src/domain/xp.ts';

test('xpForAnswer : bonne réponse simple = +10', () => {
  assert.equal(
    xpForAnswer({ mode: 'binaire', goodAnswer: true, exactMagnitude: false, wonDuel: false }),
    10,
  );
});

test('xpForAnswer : mauvaise réponse = 0', () => {
  assert.equal(
    xpForAnswer({ mode: 'binaire', goodAnswer: false, exactMagnitude: false, wonDuel: false }),
    0,
  );
});

test('xpForAnswer : ordre de grandeur exacte = 10 + 5 bonus', () => {
  assert.equal(
    xpForAnswer({ mode: 'ordre_de_grandeur', goodAnswer: true, exactMagnitude: true, wonDuel: false }),
    15,
  );
});

test('xpForAnswer : bonus exact ne s applique qu au mode ordre de grandeur', () => {
  assert.equal(
    xpForAnswer({ mode: 'binaire', goodAnswer: true, exactMagnitude: true, wonDuel: false }),
    10,
  );
});

test('xpForAnswer : duel gagné = 10 + 5 bonus', () => {
  assert.equal(
    xpForAnswer({ mode: 'duel', goodAnswer: true, exactMagnitude: false, wonDuel: true }),
    15,
  );
});

test('xpForAnswer : bonus duel ne s applique qu au mode duel', () => {
  assert.equal(
    xpForAnswer({ mode: 'binaire', goodAnswer: true, exactMagnitude: false, wonDuel: true }),
    10,
  );
});

test('xpForAnswer : égalité duel (bonne réponse, pas gagné) = 10 sans bonus', () => {
  assert.equal(
    xpForAnswer({ mode: 'duel', goodAnswer: true, exactMagnitude: false, wonDuel: false }),
    10,
  );
});

test('xpForGameEnd : terminer = 25, gagner = 75', () => {
  assert.equal(xpForGameEnd(false), 25);
  assert.equal(xpForGameEnd(true), 75);
});

test('levelForXp : formule floor(sqrt(xp/100))+1', () => {
  assert.equal(levelForXp(0), 1);
  assert.equal(levelForXp(99), 1);
  assert.equal(levelForXp(100), 2);
  assert.equal(levelForXp(400), 3);
  assert.equal(levelForXp(900), 4);
  // niveau 10 -> sqrt(xp/100) >= 9 -> xp >= 8100.
  assert.equal(levelForXp(8100), 10);
  assert.equal(levelForXp(8099), 9);
});
