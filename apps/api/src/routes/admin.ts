import type { FastifyInstance } from 'fastify';
import { makeAdminGuard } from '../plugins/admin-auth.ts';
import { detectFormat, parseImportFile, UnsupportedImportFormatError } from '../services/import-file-parser.ts';
import { importQuestions } from '../services/import-service.ts';
import { buildCsvTemplate, buildXlsxTemplate, buildMarkdownTemplate } from '../services/import-template.ts';

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

  // Import en masse (Lot 6) : CSV/xlsx/md, validation ligne à ligne, insertion
  // en 'pending' (repasse par la modération existante). Une ligne invalide ne
  // bloque pas les autres — rapport d'erreurs complet retourné.
  app.post('/admin/questions/import', { preHandler: guard }, async (request, reply) => {
    const file = await request.file();
    if (!file) {
      return reply.code(400).send({ error: 'file_required' });
    }

    let format;
    try {
      format = detectFormat(file.filename);
    } catch (err) {
      if (err instanceof UnsupportedImportFormatError) {
        return reply.code(400).send({ error: 'unsupported_format' });
      }
      throw err;
    }

    let buffer: Buffer;
    try {
      buffer = await file.toBuffer();
    } catch {
      // Dépassement de la limite de taille configurée (@fastify/multipart, app.ts).
      return reply.code(413).send({ error: 'file_too_large' });
    }

    const rows = await parseImportFile(format, buffer);
    const report = await importQuestions(app.pg, file.filename, format, rows);
    return reply.code(201).send(report);
  });

  // Templates téléchargeables (colonnes du template générique + 1 ligne d'exemple
  // commentée, ignorée par le parseur d'import).
  app.get(
    '/admin/questions/import/template',
    {
      preHandler: guard,
      schema: {
        querystring: {
          type: 'object',
          properties: {
            format: { type: 'string', enum: ['csv', 'xlsx', 'md'], default: 'csv' },
          },
        },
      },
    },
    async (request, reply) => {
      const { format = 'csv' } = request.query as { format?: 'csv' | 'xlsx' | 'md' };

      if (format === 'xlsx') {
        const buffer = await buildXlsxTemplate();
        return reply
          .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
          .header('Content-Disposition', 'attachment; filename="kombien-import-template.xlsx"')
          .send(buffer);
      }
      if (format === 'md') {
        return reply
          .header('Content-Type', 'text/markdown; charset=utf-8')
          .header('Content-Disposition', 'attachment; filename="kombien-import-template.md"')
          .send(buildMarkdownTemplate());
      }
      return reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', 'attachment; filename="kombien-import-template.csv"')
        .send(buildCsvTemplate());
    },
  );
}
