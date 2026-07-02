import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreBinary, scoreMagnitude, scoreDuel } from '../src/domain/scoring.ts';

test('scoreBinary : Oui correct si duration >= threshold', () => {
  assert.deepEqual(scoreBinary('yes', 3600, 7200), { points: 1, correct: true });
  assert.deepEqual(scoreBinary('no', 3600, 7200), { points: 0, correct: false });
});

test('scoreBinary : Non correct si duration < threshold', () => {
  assert.deepEqual(scoreBinary('no', 3600, 1800), { points: 1, correct: true });
  assert.deepEqual(scoreBinary('yes', 3600, 1800), { points: 0, correct: false });
});

test('scoreBinary : == seuil compte comme longtemps (Oui correct)', () => {
  assert.deepEqual(scoreBinary('yes', 3600, 3600), { points: 1, correct: true });
  assert.deepEqual(scoreBinary('no', 3600, 3600), { points: 0, correct: false });
});

test('scoreMagnitude : exacte = 3 pts', () => {
  const r = scoreMagnitude('day', 259200); // 3 jours -> day
  assert.equal(r.points, 3);
  assert.equal(r.correctUnit, 'day');
  assert.equal(r.exact, true);
  assert.equal(r.adjacent, false);
});

test('scoreMagnitude : adjacente des deux côtés = 1 pt', () => {
  const below = scoreMagnitude('hour', 259200); // hour (2) vs day (3)
  assert.equal(below.points, 1);
  assert.equal(below.adjacent, true);
  assert.equal(below.exact, false);

  const above = scoreMagnitude('week', 259200); // week (4) vs day (3)
  assert.equal(above.points, 1);
  assert.equal(above.adjacent, true);
});

test('scoreMagnitude : trop loin = 0 pt', () => {
  const r = scoreMagnitude('minute', 259200); // minute (1) vs day (3)
  assert.equal(r.points, 0);
  assert.equal(r.adjacent, false);
  assert.equal(r.exact, false);
});

test('scoreDuel : A plus proche marque 2', () => {
  const r = scoreDuel({ value: 1, unit: 'hour' }, { value: 2, unit: 'hour' }, 3600);
  assert.deepEqual({ a: r.pointsA, b: r.pointsB }, { a: 2, b: 0 });
});

test('scoreDuel : B plus proche marque 2', () => {
  const r = scoreDuel({ value: 5, unit: 'hour' }, { value: 1, unit: 'hour' }, 3600);
  assert.deepEqual({ a: r.pointsA, b: r.pointsB }, { a: 0, b: 2 });
});

test('scoreDuel : égalité stricte d écart = 1-1', () => {
  // A = 1800s (écart 1800), B = 5400s (écart 1800), durée 3600.
  const r = scoreDuel({ value: 30, unit: 'minute' }, { value: 90, unit: 'minute' }, 3600);
  assert.deepEqual({ a: r.pointsA, b: r.pointsB }, { a: 1, b: 1 });
  assert.equal(r.errorA, r.errorB);
});

test('scoreDuel : estimations identiques -> 1-1', () => {
  const r = scoreDuel({ value: 2, unit: 'hour' }, { value: 2, unit: 'hour' }, 3600);
  assert.deepEqual({ a: r.pointsA, b: r.pointsB }, { a: 1, b: 1 });
});
