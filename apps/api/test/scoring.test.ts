import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreBinary, scoreMagnitude, scoreDuel, scoreDuelRanked } from '../src/domain/scoring.ts';

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

// GAME_DESIGN_V2.md §5.3 — questions différenciées : écart RELATIF, pas absolu.
test('scoreDuelRanked : questions différenciées, écart absolu inverserait le classement, l écart relatif corrige', () => {
  // A : durée réelle courte (120s), estime 180s -> écart absolu 60, écart relatif 0.5 (50%).
  // B : durée réelle longue (36000s), estime 36060s -> écart absolu 60 aussi, mais écart
  // relatif ~0.0017 (0.17%). En absolu ils seraient à égalité (1-1) ; en relatif B gagne
  // largement (2-0) car son estimation est bien plus précise vue sa propre durée.
  const points = scoreDuelRanked(
    [
      { value: 180, unit: 'second', durationSeconds: 120 },
      { value: 36060, unit: 'second', durationSeconds: 36000 },
    ],
    999, // ignoré : chaque estimation porte sa propre durée
  );
  assert.deepEqual(points, [0, 2]);
});

test('scoreDuelRanked : questions différenciées, égalité d écart relatif exact -> partage', () => {
  // A : durée 100, estime 110 -> écart relatif 0.10. B : durée 1000, estime 1100 -> écart
  // relatif 0.10 aussi (même proportion, durées différentes) -> égalité, 1-1.
  const points = scoreDuelRanked(
    [
      { value: 110, unit: 'second', durationSeconds: 100 },
      { value: 1100, unit: 'second', durationSeconds: 1000 },
    ],
    999,
  );
  assert.deepEqual(points, [1, 1]);
});

test('scoreDuelRanked : durée commune (v1/Duo standard) -> écart relatif se réduit exactement à l écart absolu', () => {
  // Sans durationSeconds par estimation, toutes les erreurs sont divisées par la MÊME
  // constante (le paramètre durationSeconds) : l'ordre et les égalités sont identiques à
  // l'écart absolu v1. Reproduit exactement les cas de scoreDuel testés plus haut.
  assert.deepEqual(
    scoreDuelRanked([{ value: 1, unit: 'hour' }, { value: 2, unit: 'hour' }], 3600),
    [2, 0],
  );
  assert.deepEqual(
    scoreDuelRanked([{ value: 30, unit: 'minute' }, { value: 90, unit: 'minute' }], 3600),
    [1, 1],
  );
});

test('scoreDuelRanked : mélange durée commune et durée différenciée (un seul joueur porte sa propre durée)', () => {
  // Si un seul DuelEstimate porte durationSeconds, les autres retombent sur le paramètre
  // durationSeconds (comportement de repli documenté).
  const points = scoreDuelRanked(
    [
      { value: 1, unit: 'hour', durationSeconds: 3600 }, // écart relatif 0
      { value: 2, unit: 'hour' }, // retombe sur durée commune 3600 -> écart relatif 1
    ],
    3600,
  );
  assert.deepEqual(points, [2, 0]);
});
