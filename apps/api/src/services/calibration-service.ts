// Service de tirage du pool de calibration (Lot 4 v2, GAME_DESIGN_V2.md §3.2) : la
// catégorie flaggée `is_calibration` (migration 0005) est exclue de tous les tirages
// de jeu (routes/categories.ts) — ce service est la SEULE porte d'entrée vers son
// contenu.

export interface QueryExecutor {
  query(text: string, values?: unknown[]): Promise<{ rows: any[] }>;
}

export interface CalibrationQuestionRow {
  id: number;
  text_fr: string;
  text_en: string;
  duration_seconds: number;
}

// §3.1 — 5 questions de calibration, tirées aléatoirement du pool dédié.
export async function drawCalibrationQuestions(
  db: QueryExecutor,
  count: number,
): Promise<CalibrationQuestionRow[]> {
  const { rows } = await db.query(
    `SELECT q.id, q.text_fr, q.text_en, q.duration_seconds
     FROM questions q JOIN categories c ON c.id = q.category_id
     WHERE c.is_calibration AND q.status = 'approved'
     ORDER BY random()
     LIMIT $1`,
    [count],
  );
  return rows as CalibrationQuestionRow[];
}
