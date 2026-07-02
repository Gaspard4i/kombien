import type { FastifyInstance } from 'fastify';

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
}
