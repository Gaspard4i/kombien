import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import postgres from '@fastify/postgres';
import type { AppConfig } from './config.ts';
import { categoriesRoutes } from './routes/categories.ts';
import { questionsRoutes } from './routes/questions.ts';
import { adminRoutes } from './routes/admin.ts';
import { gamesRoutes } from './routes/games.ts';
import { leaderboardRoutes } from './routes/leaderboard.ts';
import { playersRoutes } from './routes/players.ts';

export async function buildApp(config: AppConfig): Promise<FastifyInstance> {
  const app = Fastify({ logger: config.isDev });

  await app.register(cors, {
    // Permissif en dev, restreint en prod via l'origine du front si fournie.
    origin: config.isDev ? true : (process.env.CORS_ORIGIN ?? true),
  });

  await app.register(postgres, { connectionString: config.databaseUrl });

  app.get('/health', async () => ({ status: 'ok' }));

  await app.register(categoriesRoutes);
  await app.register(questionsRoutes);
  await app.register(async (instance) => adminRoutes(instance, config.adminSecret));
  await app.register(gamesRoutes);
  await app.register(leaderboardRoutes);
  await app.register(playersRoutes);

  return app;
}
