// Service de tirage de questions (Lot 2 v2, GAME_DESIGN_V2.md §2.6) : résout les
// catégories demandées par slug, puis tire aléatoirement dans l'UNION de leurs
// questions approuvées. Réutilisé par les modes de sélection de thème "multi-thèmes"
// et "par joueur" (GAME_DESIGN_V2.md §2.3-2.4) ; l'ancien tirage mono-catégorie
// (routes/categories.ts) reste en place pour le croisement/global/vote.

export interface QueryExecutor {
  query(text: string, values?: unknown[]): Promise<{ rows: any[] }>;
}

export interface QuestionRow {
  id: number;
  category_id: number;
  text_fr: string;
  text_en: string;
  duration_seconds: number;
}

export class UnknownCategoriesError extends Error {
  readonly slugs: string[];

  constructor(slugs: string[]) {
    super(`catégories inconnues : ${slugs.join(', ')}`);
    this.slugs = slugs;
  }
}

// Vérifie que tous les slugs existent (404 categories_not_found sinon), puis tire
// `count` questions aléatoires parmi celles approuvées dans l'ensemble des catégories
// résolues. Une seule requête SQL (IN via ANY) : le mélange entre catégories est géré
// par ORDER BY random() sur le pool fusionné, comme le tirage mono-catégorie v1.
export async function drawQuestionsForCategories(
  db: QueryExecutor,
  slugs: string[],
  count: number,
): Promise<QuestionRow[]> {
  const uniqueSlugs = [...new Set(slugs)];

  const { rows: foundCategories } = await db.query(
    'SELECT id, slug FROM categories WHERE slug = ANY($1::text[])',
    [uniqueSlugs],
  );
  const foundSlugs = new Set(foundCategories.map((c) => c.slug as string));
  const missing = uniqueSlugs.filter((s) => !foundSlugs.has(s));
  if (missing.length > 0) {
    throw new UnknownCategoriesError(missing);
  }

  const categoryIds = foundCategories.map((c) => c.id as number);
  const { rows } = await db.query(
    `SELECT id, category_id, text_fr, text_en, duration_seconds
     FROM questions
     WHERE category_id = ANY($1::int[]) AND status = 'approved'
     ORDER BY random()
     LIMIT $2`,
    [categoryIds, count],
  );
  return rows as QuestionRow[];
}
