import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import postgres from '@fastify/postgres';
import multipart from '@fastify/multipart';
import type { AppConfig } from './config.ts';
import { categoriesRoutes } from './routes/categories.ts';
import { questionsRoutes } from './routes/questions.ts';
import { adminRoutes } from './routes/admin.ts';
import { gamesRoutes } from './routes/games.ts';

// Taille max d'un fichier d'import (Lot 6) : le fichier vient d'un upload admin
// non fiable, on borne large pour un import de texte (questions) mais anti-DoS.
export const IMPORT_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 Mo

export async function buildApp(config: AppConfig): Promise<FastifyInstance> {
  const app = Fastify({ logger: config.isDev });

  await app.register(cors, {
    // Permissif en dev, restreint en prod via l'origine du front si fournie.
    origin: config.isDev ? true : (process.env.CORS_ORIGIN ?? true),
  });

  await app.register(postgres, { connectionString: config.databaseUrl });

  await app.register(multipart, {
    limits: {
      fileSize: IMPORT_MAX_FILE_SIZE_BYTES,
      files: 1,
    },
  });

  app.get('/health', async () => ({ status: 'ok' }));

  await app.register(categoriesRoutes);
  await app.register(questionsRoutes);
  await app.register(async (instance) => adminRoutes(instance, config.adminSecret));
  await app.register(gamesRoutes);

  return app;
}
