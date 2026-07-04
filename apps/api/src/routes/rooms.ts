import type { FastifyInstance } from 'fastify';
import type { RedisClientType } from 'redis';
import { createRoom, getPublicRoomInfo, RoomServiceUnavailableError } from '../services/room-service.ts';
import { buildRoomJoinUrl, generateRoomQr } from '../services/room-code.ts';
import { UnknownCategoriesError } from '../services/questions-service.ts';
import { registerRoomQuestions } from './rooms-ws.ts';

// Rooms multi-écrans temps réel (Lot 9, PLAN_V2.md). REST pour créer/rejoindre une room ; le
// jeu lui-même (join, réponses, avance de manche) se déroule sur GET /rooms/ws (voir
// routes/rooms-ws.ts). Redis étant branché en best-effort (app.ts), toute indisponibilité se
// traduit ici par un 503 explicite plutôt qu'un crash de l'API — le pass-and-play continue de
// fonctionner sans Redis.
export async function roomsRoutes(app: FastifyInstance, redis: RedisClientType | null, webBaseUrl: string): Promise<void> {
  app.post(
    '/rooms',
    {
      schema: {
        body: {
          type: 'object',
          required: ['categorySlugs', 'mode'],
          properties: {
            categorySlugs: { type: 'array', items: { type: 'string', minLength: 1 }, minItems: 1 },
            mode: { type: 'string', enum: ['binaire', 'ordre_de_grandeur', 'duel'] },
            questionCount: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
            timerSeconds: { type: 'integer', minimum: 1, maximum: 120 },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        categorySlugs: string[];
        mode: 'binaire' | 'ordre_de_grandeur' | 'duel';
        questionCount?: number;
        timerSeconds?: number;
      };

      try {
        const { code, questions } = await createRoom(app.pg, redis, {
          categorySlugs: body.categorySlugs,
          mode: body.mode,
          questionCount: body.questionCount ?? 10,
          timerSeconds: body.timerSeconds,
        });
        registerRoomQuestions(code, questions);
        const joinUrl = buildRoomJoinUrl(webBaseUrl, code);
        const qr = await generateRoomQr(joinUrl);
        return reply.code(201).send({ code, qr });
      } catch (err) {
        if (err instanceof RoomServiceUnavailableError) {
          return reply.code(503).send({ error: 'room_service_unavailable' });
        }
        if (err instanceof UnknownCategoriesError) {
          return reply.code(404).send({ error: 'category_not_found' });
        }
        throw err;
      }
    },
  );

  app.get(
    '/rooms/:code',
    {
      schema: {
        params: {
          type: 'object',
          required: ['code'],
          properties: { code: { type: 'string', minLength: 1 } },
        },
      },
    },
    async (request, reply) => {
      const { code } = request.params as { code: string };

      try {
        const info = await getPublicRoomInfo(redis, code);
        if (!info) {
          return reply.code(404).send({ error: 'room_not_found' });
        }
        return info;
      } catch (err) {
        if (err instanceof RoomServiceUnavailableError) {
          return reply.code(503).send({ error: 'room_service_unavailable' });
        }
        throw err;
      }
    },
  );
}
