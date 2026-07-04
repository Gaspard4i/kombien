import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import postgres from '@fastify/postgres';
import multipart from '@fastify/multipart';
import websocket from '@fastify/websocket';
import type { RedisClientType } from 'redis';
import type { AppConfig } from './config.ts';
import { categoriesRoutes } from './routes/categories.ts';
import { questionsRoutes } from './routes/questions.ts';
import { adminRoutes } from './routes/admin.ts';
import { gamesRoutes } from './routes/games.ts';
import { calibrationRoutes } from './routes/calibration.ts';
import { roomsRoutes } from './routes/rooms.ts';
import { roomsWsRoutes } from './routes/rooms-ws.ts';
import { createRedisClient, connectRedis } from './redis.ts';

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

  // Anti-DoS (Lot 9) : un message de room ne dépasse jamais quelques centaines d'octets
  // (réponse brute + pseudo), 16 Ko laisse large marge sans ouvrir de vecteur de saturation.
  await app.register(websocket, { options: { maxPayload: 16 * 1024 } });

  // Redis best-effort (Lot 9) : le pass-and-play ne dépend pas de Redis, donc une connexion
  // ratée est loggée mais NE BLOQUE JAMAIS le boot de l'API. `redis` reste `null` dans ce cas
  // — les routes rooms (REST + WS) répondent alors 503 room_service_unavailable, tout le
  // reste de l'API continue de fonctionner normalement.
  let redis: RedisClientType | null = createRedisClient(config.redisUrl);
  try {
    await connectRedis(redis);
  } catch (err) {
    console.error('[redis] connexion indisponible au démarrage, rooms désactivées', err);
    redis = null;
  }
  app.addHook('onClose', async () => {
    if (redis?.isReady) await redis.disconnect();
  });

  app.get('/health', async () => ({ status: 'ok' }));

  await app.register(categoriesRoutes);
  await app.register(questionsRoutes);
  await app.register(async (instance) => adminRoutes(instance, config.adminSecret));
  await app.register(gamesRoutes);
  await app.register(calibrationRoutes);
  await app.register(async (instance) => roomsRoutes(instance, redis, config.webBaseUrl));
  await app.register(async (instance) => roomsWsRoutes(instance, redis));

  return app;
}
