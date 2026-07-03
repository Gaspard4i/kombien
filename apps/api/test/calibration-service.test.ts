import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawCalibrationQuestions, type QueryExecutor } from '../src/services/calibration-service.ts';

function fakeDb(rows: { id: number; text_fr: string; text_en: string; duration_seconds: number }[]): QueryExecutor {
  return {
    async query(text: string, values?: unknown[]) {
      assert.match(text, /is_calibration/);
      const limit = values![0] as number;
      return { rows: rows.slice(0, limit) };
    },
  };
}

test('drawCalibrationQuestions : renvoie le nombre demandé, filtré sur is_calibration', async () => {
  const db = fakeDb(
    Array.from({ length: 8 }, (_, i) => ({
      id: i,
      text_fr: `Q${i}`,
      text_en: `Q${i}`,
      duration_seconds: 60 * (i + 1),
    })),
  );
  const rows = await drawCalibrationQuestions(db, 5);
  assert.equal(rows.length, 5);
});

test('drawCalibrationQuestions : pool plus petit que count -> renvoie tout le pool', async () => {
  const db = fakeDb([{ id: 1, text_fr: 'Q1', text_en: 'Q1', duration_seconds: 60 }]);
  const rows = await drawCalibrationQuestions(db, 5);
  assert.equal(rows.length, 1);
});
