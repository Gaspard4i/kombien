// Tests de sécurité de l'endpoint d'import (limite de taille, format non
// supporté) sur une app Fastify minimale isolée (sans Postgres réel — ces cas
// sont rejetés avant tout accès DB, cf. routes/admin.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import { detectFormat, parseImportFile, UnsupportedImportFormatError } from '../src/services/import-file-parser.ts';

const MAX_FILE_SIZE_BYTES = 1024; // petite limite pour un test rapide

function buildTestApp() {
  const app = Fastify();
  app.register(multipart, { limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 } });

  app.post('/admin/questions/import', async (request, reply) => {
    const file = await request.file();
    if (!file) return reply.code(400).send({ error: 'file_required' });

    let format;
    try {
      format = detectFormat(file.filename);
    } catch (err) {
      if (err instanceof UnsupportedImportFormatError) {
        return reply.code(400).send({ error: 'unsupported_format' });
      }
      throw err;
    }

    let buffer;
    try {
      buffer = await file.toBuffer();
    } catch {
      return reply.code(413).send({ error: 'file_too_large' });
    }

    const rows = await parseImportFile(format, buffer);
    return reply.code(200).send({ rows: rows.length });
  });

  return app;
}

function multipartBody(filename: string, content: string, boundary = 'testboundary') {
  const body =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
    'Content-Type: text/csv\r\n\r\n' +
    `${content}\r\n` +
    `--${boundary}--\r\n`;
  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}

test('POST /admin/questions/import : fichier trop gros -> 413 file_too_large', async () => {
  const app = buildTestApp();
  const oversized = 'x'.repeat(MAX_FILE_SIZE_BYTES * 2);
  const { body, contentType } = multipartBody('questions.csv', oversized);

  const response = await app.inject({
    method: 'POST',
    url: '/admin/questions/import',
    headers: { 'content-type': contentType },
    payload: body,
  });

  assert.equal(response.statusCode, 413);
  assert.deepEqual(response.json(), { error: 'file_too_large' });
  await app.close();
});

test('POST /admin/questions/import : extension non supportée -> 400 unsupported_format', async () => {
  const app = buildTestApp();
  const { body, contentType } = multipartBody('questions.exe', 'contenu quelconque');

  const response = await app.inject({
    method: 'POST',
    url: '/admin/questions/import',
    headers: { 'content-type': contentType },
    payload: body,
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.json(), { error: 'unsupported_format' });
  await app.close();
});

test('POST /admin/questions/import : fichier csv valide sous la limite -> 200', async () => {
  const app = buildTestApp();
  const { body, contentType } = multipartBody('questions.csv', 'text_fr,duration,unit,category_slug\nQ1,2,hour,sport');

  const response = await app.inject({
    method: 'POST',
    url: '/admin/questions/import',
    headers: { 'content-type': contentType },
    payload: body,
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { rows: 1 });
  await app.close();
});
