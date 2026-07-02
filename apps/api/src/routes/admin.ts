import type { FastifyInstance } from 'fastify';
import { makeAdminGuard } from '../plugins/admin-auth.ts';

export async function adminRoutes(app: FastifyInstance, adminSecret: string | undefined): Promise<void> {
  const guard = makeAdminGuard(adminSecret);

  app.get(
    '/admin/questions',
    {
      preHandler: guard,
      schema: {
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['pending', 'approved', 'rejected'], default: 'pending' },
          },
        },
      },
    },
    async (request) => {
      const { status = 'pending' } = request.query as { status?: string };
      const { rows } = await app.pg.query(
        `SELECT id, category_id, text_fr, text_en, duration_seconds, status, report_count
         FROM questions WHERE status = $1 ORDER BY id`,
        [status],
      );
      return rows;
    },
  );

  const setStatus = (newStatus: 'approved' | 'rejected') =>
    async (request: any, reply: any) => {
      const { id } = request.params as { id: number };
      const { rows } = await app.pg.query(
        'UPDATE questions SET status = $1 WHERE id = $2 RETURNING id, status',
        [newStatus, id],
      );
      if (rows.length === 0) {
        return reply.code(404).send({ error: 'question_not_found' });
      }
      return rows[0];
    };

  const idParams = {
    params: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'integer' } },
    },
  };

  app.post('/admin/questions/:id/approve', { preHandler: guard, schema: idParams }, setStatus('approved'));
  app.post('/admin/questions/:id/reject', { preHandler: guard, schema: idParams }, setStatus('rejected'));
}
