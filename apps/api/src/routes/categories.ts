import type { FastifyInstance } from 'fastify';
import { drawQuestionsForCategories, UnknownCategoriesError } from '../services/questions-service.ts';

export async function categoriesRoutes(app: FastifyInstance): Promise<void> {
  app.get('/categories', async () => {
    const { rows } = await app.pg.query(
      'SELECT id, slug, name_fr, name_en, threshold_seconds FROM categories ORDER BY name_fr',
    );
    return rows;
  });

  app.get(
    '/categories/:slug/questions',
    {
      schema: {
        params: {
          type: 'object',
          required: ['slug'],
          properties: { slug: { type: 'string' } },
        },
        querystring: {
          type: 'object',
          properties: {
            count: { type: 'integer', minimum: 1, maximum: 50, default: 5 },
          },
        },
      },
    },
    async (request, reply) => {
      const { slug } = request.params as { slug: string };
      const { count = 5 } = request.query as { count?: number };

      const cat = await app.pg.query('SELECT id FROM categories WHERE slug = $1', [slug]);
      if (cat.rows.length === 0) {
        return reply.code(404).send({ error: 'category_not_found' });
      }

      const { rows } = await app.pg.query(
        `SELECT id, category_id, text_fr, text_en, duration_seconds
         FROM questions
         WHERE category_id = $1 AND status = 'approved'
         ORDER BY random()
         LIMIT $2`,
        [cat.rows[0].id, count],
      );
      return rows;
    },
  );

  // Tirage multi-catégories (Lot 2 v2, GAME_DESIGN_V2.md §2.3-2.4) : les modes de
  // sélection "multi-thèmes" et "par joueur" tirent dans l'UNION des catégories
  // choisies plutôt que dans une seule. Coexiste avec /categories/:slug/questions
  // (croisement/global/vote, une seule catégorie à la fois).
  app.get(
    '/questions',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['categories'],
          properties: {
            categories: { type: 'string', minLength: 1 },
            count: { type: 'integer', minimum: 1, maximum: 50, default: 5 },
          },
        },
      },
    },
    async (request, reply) => {
      const { categories, count = 5 } = request.query as { categories: string; count?: number };
      const slugs = categories.split(',').map((s) => s.trim()).filter(Boolean);

      try {
        const rows = await drawQuestionsForCategories(app.pg, slugs, count);
        return rows;
      } catch (err) {
        if (err instanceof UnknownCategoriesError) {
          return reply.code(404).send({ error: 'category_not_found' });
        }
        throw err;
      }
    },
  );
}
