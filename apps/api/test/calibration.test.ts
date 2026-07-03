import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveThreshold, type CalibrationAnswer } from '../src/domain/calibration.ts';

const CATEGORY_FALLBACK = 3600; // threshold_seconds de la catégorie jouée, repli §3.4.

test('deriveThreshold : cas nominal -> moyenne géométrique des bornes basse/haute', () => {
  // borne basse = 300 (max des "pas longtemps"), borne haute = 3600 (min des "longtemps").
  // sqrt(300 * 3600) = sqrt(1080000) ≈ 1039.23.
  const answers: CalibrationAnswer[] = [
    { durationSeconds: 60, answer: 'no' },
    { durationSeconds: 300, answer: 'no' },
    { durationSeconds: 3600, answer: 'yes' },
    { durationSeconds: 86400, answer: 'yes' },
  ];
  const threshold = deriveThreshold(answers, CATEGORY_FALLBACK);
  assert.ok(Math.abs(threshold - Math.sqrt(300 * 3600)) < 1e-9);
});

test('deriveThreshold : tout "pas longtemps" -> borne basse * 2', () => {
  const answers: CalibrationAnswer[] = [
    { durationSeconds: 60, answer: 'no' },
    { durationSeconds: 300, answer: 'no' },
    { durationSeconds: 3600, answer: 'no' },
  ];
  assert.equal(deriveThreshold(answers, CATEGORY_FALLBACK), 3600 * 2);
});

test('deriveThreshold : tout "longtemps" -> borne haute / 2', () => {
  const answers: CalibrationAnswer[] = [
    { durationSeconds: 3600, answer: 'yes' },
    { durationSeconds: 86400, answer: 'yes' },
  ];
  assert.equal(deriveThreshold(answers, CATEGORY_FALLBACK), 3600 / 2);
});

test('deriveThreshold : incohérence complète (borne basse >= borne haute) -> repli catégorie', () => {
  // "pas longtemps" à 86400 (borne basse), "longtemps" à 60 (borne haute) -> low >= high.
  const answers: CalibrationAnswer[] = [
    { durationSeconds: 86400, answer: 'no' },
    { durationSeconds: 60, answer: 'yes' },
  ];
  assert.equal(deriveThreshold(answers, CATEGORY_FALLBACK), CATEGORY_FALLBACK);
});

test('deriveThreshold : borne basse == borne haute (égalité stricte) -> repli catégorie', () => {
  const answers: CalibrationAnswer[] = [
    { durationSeconds: 3600, answer: 'no' },
    { durationSeconds: 3600, answer: 'yes' },
  ];
  assert.equal(deriveThreshold(answers, CATEGORY_FALLBACK), CATEGORY_FALLBACK);
});

test('deriveThreshold : aucune réponse -> repli catégorie', () => {
  assert.equal(deriveThreshold([], CATEGORY_FALLBACK), CATEGORY_FALLBACK);
});

test('deriveThreshold : inversions partielles ignorées, seuls les extrema comptent (§3.3)', () => {
  // Le joueur change d'avis en cours de route : "longtemps" à 600, puis "pas longtemps" à 1200
  // (durée plus longue que la précédente jugée "longtemps"). borne basse = max(no) = 1200,
  // borne haute = min(yes) = 600 -> incohérence (low >= high) -> repli catégorie.
  const answers: CalibrationAnswer[] = [
    { durationSeconds: 600, answer: 'yes' },
    { durationSeconds: 1200, answer: 'no' },
  ];
  assert.equal(deriveThreshold(answers, CATEGORY_FALLBACK), CATEGORY_FALLBACK);
});

test('deriveThreshold : une seule réponse "pas longtemps" et une seule "longtemps", cohérentes', () => {
  const answers: CalibrationAnswer[] = [
    { durationSeconds: 100, answer: 'no' },
    { durationSeconds: 400, answer: 'yes' },
  ];
  assert.ok(Math.abs(deriveThreshold(answers, CATEGORY_FALLBACK) - Math.sqrt(100 * 400)) < 1e-9);
});
