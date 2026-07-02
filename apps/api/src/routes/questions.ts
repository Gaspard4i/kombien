import type { FastifyInstance } from 'fastify';
import { isUnit, toSeconds, type UnitSlug } from '../domain/units.ts';

interface ContributionBody {
  text_fr: string;
  text_en?: string;
  duration: number;
  unit: string;
  category_slug: string;
  category_name_fr?: string;
  category_name_en?: string;
}

export async function questionsRoutes(app: FastifyInstance): Promise<void> {
  // Contribution communautaire -> status 'pending'.
  app.post(
    '/questions',
    {
      schema: {
        body: {
          type: 'object',
          required: ['text_fr', 'duration', 'unit', 'category_slug'],
          additionalProperties: false,
          properties: {
            text_fr: { type: 'string', minLength: 1, maxLength: 300 },
            text_en: { type: 'string', maxLength: 300 },
            duration: { type: 'number', exclusiveMinimum: 0 },
            unit: { type: 'string' },
            category_slug: { type: 'string', minLength: 1 },
            category_name_fr: { type: 'string', maxLength: 100 },
            category_name_en: { type: 'string', maxLength: 100 },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as ContributionBody;

      if (!isUnit(body.unit)) {
        return reply.code(400).send({ error: 'invalid_unit' });
      }
      const durationSeconds = toSeconds(body.duration, body.unit as UnitSlug);

      const existing = await app.pg.query('SELECT id FROM categories WHERE slug = $1', [
        body.category_slug,
      ]);

      let categoryId: number;
      if (existing.rows.length > 0) {
        categoryId = existing.rows[0].id;
      } else {
        // Catégorie proposée : la créer nécessite un nom. Sinon on refuse.
        if (!body.category_name_fr || !body.category_name_en) {
          return reply.code(400).send({ error: 'unknown_category_needs_names' });
        }
        // threshold_seconds inconnu pour une catégorie proposée : valeur neutre, à
        // ajuster par un admin. On prend la durée proposée comme seuil de départ.
        const created = await app.pg.query(
          `INSERT INTO categories (slug, name_fr, name_en, threshold_seconds)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [body.category_slug, body.category_name_fr, body.category_name_en, durationSeconds],
        );
        categoryId = created.rows[0].id;
      }

      const text_en = body.text_en ?? body.text_fr;
      const inserted = await app.pg.query(
        `INSERT INTO questions (category_id, text_fr, text_en, duration_seconds, status)
         VALUES ($1, $2, $3, $4, 'pending')
         RETURNING id, category_id, text_fr, text_en, duration_seconds, status`,
        [categoryId, body.text_fr, text_en, durationSeconds],
      );
      return reply.code(201).send(inserted.rows[0]);
    },
  );

  // Signalement d'une question -> incrémente report_count.
  app.post(
    '/questions/:id/report',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'integer' } },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: number };
      const { rows } = await app.pg.query(
        'UPDATE questions SET report_count = report_count + 1 WHERE id = $1 RETURNING id, report_count',
        [id],
      );
      if (rows.length === 0) {
        return reply.code(404).send({ error: 'question_not_found' });
      }
      return rows[0];
    },
  );
}
