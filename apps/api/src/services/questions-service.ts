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

// Vérifie que tous les slugs existent (404 category_not_found sinon), renvoie leurs ids.
// Factorisé entre drawQuestionsForCategories et resolveShuffledPool (même validation).
async function resolveCategoryIds(db: QueryExecutor, slugs: string[]): Promise<number[]> {
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

  return foundCategories.map((c) => c.id as number);
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
  const categoryIds = await resolveCategoryIds(db, slugs);
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

// Résout les catégories et renvoie tout le pool approuvé disponible, mélangé aléatoirement,
// SANS limite — nécessaire à la partition applicative de drawDistinctSetsForPlayers (on doit
// connaître la taille réelle du pool pour décider où relâcher la contrainte de disjonction,
// cf. GAME_DESIGN_V2.md §5.2).
async function resolveShuffledPool(db: QueryExecutor, slugs: string[]): Promise<QuestionRow[]> {
  const categoryIds = await resolveCategoryIds(db, slugs);
  const { rows } = await db.query(
    `SELECT id, category_id, text_fr, text_en, duration_seconds
     FROM questions
     WHERE category_id = ANY($1::int[]) AND status = 'approved'
     ORDER BY random()`,
    [categoryIds],
  );
  return rows as QuestionRow[];
}

// Tirage en sous-ensembles DISJOINTS, un par joueur (Lot 3, GAME_DESIGN_V2.md §5.2) : chaque
// joueur reçoit `count` questions qui lui sont propres. Tirage APPLICATIF (fetch large de tout
// le pool mélangé côté SQL, puis partition en mémoire) plutôt qu'un ORDER BY random() séparé
// par joueur, qui ne garantirait jamais l'absence de recoupement entre joueurs.
//
// Priorité (GAME_DESIGN_V2.md §5.2, ordre de dégradation si le pool est trop petit pour tout
// garantir) :
//   1. Non-répétition intra-joueur (chaque joueur ne revoit jamais deux fois la même question
//      dans ce tirage) — jamais sacrifiée : mieux vaut qu'un joueur recoupe avec un autre que
//      de se répéter lui-même.
//   2. Non-répétition inter-joueurs (aucune question partagée entre deux joueurs) — relâchée
//      en premier si le pool ne suffit pas à satisfaire les deux (§5.2, dernier paragraphe).
//
// Concrètement : le pool mélangé est distribué en tranches disjointes de taille `count` tant
// qu'il en reste assez (garantit 1 ET 2 pour ces joueurs-là). Une fois le pool disjoint épuisé,
// les joueurs restants piochent dans le pool COMPLET, en tournant (modulo) sur un curseur
// indépendant plutôt que de toujours repartir du début : deux joueurs en dégradation ne
// reçoivent donc pas systématiquement le même sous-ensemble (meilleure répartition), tout en
// garantissant toujours la règle 1 (jamais deux fois la même question pour un même joueur,
// tant que `pool.length >= count`).
export async function drawDistinctSetsForPlayers(
  db: QueryExecutor,
  slugs: string[],
  count: number,
  playerCount: number,
): Promise<QuestionRow[][]> {
  const pool = await resolveShuffledPool(db, slugs);
  if (pool.length === 0) return Array.from({ length: playerCount }, () => []);

  const sets: QuestionRow[][] = [];
  let cursor = 0;
  let degradedCursor = 0;

  for (let player = 0; player < playerCount; player++) {
    const remainingDisjoint = pool.length - cursor;

    if (remainingDisjoint >= count) {
      // Assez de questions jamais distribuées pour garder ce joueur totalement disjoint
      // des précédents : on avance simplement le curseur (règle 1 ET 2 respectées).
      sets.push(pool.slice(cursor, cursor + count));
      cursor += count;
      continue;
    }

    // Pool disjoint épuisé pour ce joueur : on relâche la règle 2 (non-répétition
    // inter-joueurs) en repiochant dans le pool complet, mais on continue à garantir la
    // règle 1 (jamais deux fois la même question POUR CE joueur) tant que pool.length >=
    // count. `degradedCursor` tourne indépendamment du curseur disjoint et avance à chaque
    // joueur dégradé : deux joueurs consécutifs en dégradation reçoivent des tranches
    // décalées du pool plutôt que la même (répartition équitable), tout en restant chacun
    // sans répétition interne.
    const setSize = Math.min(count, pool.length);
    const start = degradedCursor % pool.length;
    const wrapped = [...pool.slice(start), ...pool.slice(0, start)].slice(0, setSize);
    sets.push(wrapped);
    degradedCursor += setSize;
  }

  return sets;
}
