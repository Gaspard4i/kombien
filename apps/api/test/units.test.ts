import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  UNITS,
  isUnit,
  factor,
  rank,
  toSeconds,
  areAdjacent,
  naturalMagnitude,
} from '../src/domain/units.ts';

test('UNITS ordonnées par rang croissant', () => {
  assert.deepEqual([...UNITS], ['second', 'minute', 'hour', 'day', 'week', 'month', 'year']);
});

test('isUnit reconnaît les slugs valides et rejette les autres', () => {
  assert.equal(isUnit('hour'), true);
  assert.equal(isUnit('second'), true);
  assert.equal(isUnit('decade'), false);
  assert.equal(isUnit(''), false);
});

test('factor renvoie les facteurs fixes du jeu', () => {
  assert.equal(factor('second'), 1);
  assert.equal(factor('minute'), 60);
  assert.equal(factor('hour'), 3600);
  assert.equal(factor('day'), 86400);
  assert.equal(factor('week'), 604800);
  assert.equal(factor('month'), 2592000);
  assert.equal(factor('year'), 31536000);
});

test('rank renvoie la position dans l échelle', () => {
  assert.equal(rank('second'), 0);
  assert.equal(rank('year'), 6);
  assert.equal(rank('day'), 3);
});

test('toSeconds : valeur * facteur', () => {
  assert.equal(toSeconds(2.5, 'hour'), 9000);
  assert.equal(toSeconds(1, 'second'), 1);
  assert.equal(toSeconds(3, 'day'), 259200);
});

test('areAdjacent : vrai ssi écart de rang == 1', () => {
  assert.equal(areAdjacent('hour', 'day'), true);
  assert.equal(areAdjacent('day', 'hour'), true);
  assert.equal(areAdjacent('hour', 'week'), false);
  assert.equal(areAdjacent('hour', 'hour'), false);
  assert.equal(areAdjacent('second', 'minute'), true);
});

test('naturalMagnitude : bornes inférieures inclusives (table GAME_DESIGN §2)', () => {
  assert.equal(naturalMagnitude(45), 'second');
  assert.equal(naturalMagnitude(59), 'second');
  assert.equal(naturalMagnitude(60), 'minute');
  assert.equal(naturalMagnitude(120), 'minute');
  assert.equal(naturalMagnitude(3599), 'minute');
  assert.equal(naturalMagnitude(3600), 'hour');
  assert.equal(naturalMagnitude(86400), 'day');
  assert.equal(naturalMagnitude(259200), 'day');
  assert.equal(naturalMagnitude(604800), 'week');
  assert.equal(naturalMagnitude(2592000), 'month');
  assert.equal(naturalMagnitude(31536000), 'year');
});

test('naturalMagnitude : durée très petite -> second (borne basse)', () => {
  assert.equal(naturalMagnitude(1), 'second');
});

test('naturalMagnitude : durée énorme -> year', () => {
  assert.equal(naturalMagnitude(10 * 31536000), 'year');
});

test('naturalMagnitude : durée sous-seconde (0 < d < 1) -> second (fallback)', () => {
  // Aucun facteur <= 0.5 sauf implicitement : la boucle ne trouve rien, fallback 'second'.
  assert.equal(naturalMagnitude(0.5), 'second');
});
