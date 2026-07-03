import type { FastifyInstance } from 'fastify';
import type { RawAnswer } from '../domain/game.ts';
import { computeGameResult, type GamePlayerInput } from '../services/game-service.ts';

interface GameBody {
  mode: 'binaire' | 'ordre_de_grandeur' | 'duel';
  lang: 'fr' | 'en';
  end_condition?: 'points' | 'manual';
  target_score?: number;
  rounds_played?: number;
  players: GamePlayerInput[];
}

const rawAnswerSchema = {
  type: 'object',
  required: ['mode', 'questionId', 'roundIndex', 'responseTimeMs', 'durationSeconds'],
  properties: {
    mode: { type: 'string', enum: ['binaire', 'ordre_de_grandeur', 'duel'] },
    questionId: { type: 'integer', minimum: 1 },
    roundIndex: { type: 'integer', minimum: 0 },
    responseTimeMs: { type: 'integer', minimum: 0 },
    // Envoyée par le client pour affichage provisoire ; le serveur la RECHARGE
    // depuis `questions` par questionId avant de scorer (anti-triche).
    durationSeconds: { type: 'number', exclusiveMinimum: 0 },
    binaryAnswer: { type: 'string', enum: ['yes', 'no'] },
    thresholdSeconds: { type: 'number', exclusiveMinimum: 0 },
    chosenUnit: { type: 'string' },
    estValue: { type: 'number', exclusiveMinimum: 0 },
    estUnit: { type: 'string' },
    // opponentEstValue/opponentEstUnit (contrat v1, un seul adversaire) : acceptés mais
    // ignorés dès que présents plusieurs joueurs. Le service reconstruit les estimations
    // adverses réelles à partir des estValue/estUnit de TOUS les joueurs sur le même
    // questionId (GAME_DESIGN_V2.md §1.3, anti-triche : jamais confiance au client).
    opponentEstValue: { type: 'number', exclusiveMinimum: 0 },
    opponentEstUnit: { type: 'string' },
  },
};

// Enregistre POST /games : scoring serveur-autoritatif d'une partie pass-and-play
// (anti-triche), sans aucune persistance (GAME_DESIGN_V2.md §0). La partie n'est
// jamais écrite en base ; seul le résultat calculé est renvoyé.
export async function gamesRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/games',
    {
      schema: {
        body: {
          type: 'object',
          required: ['mode', 'lang', 'players'],
          properties: {
            mode: { type: 'string', enum: ['binaire', 'ordre_de_grandeur', 'duel'] },
            lang: { type: 'string', enum: ['fr', 'en'] },
            end_condition: { type: 'string', enum: ['points', 'manual'] },
            target_score: { type: 'integer', minimum: 1 },
            rounds_played: { type: 'integer', minimum: 0 },
            players: {
              // GAME_DESIGN_V2.md §1.3 : 2 à 8 joueurs pass-and-play (v1 lot 0 imposait
              // exactement 2 ; N-joueurs = lot 1). 8 = plafond raisonnable côté UX mobile,
              // aligné sur Setup.svelte MAX_PLAYERS.
              type: 'array',
              minItems: 2,
              maxItems: 8,
              items: {
                type: 'object',
                required: ['pseudo', 'answers'],
                properties: {
                  pseudo: { type: 'string', minLength: 1, maxLength: 40 },
                  answers: { type: 'array', items: rawAnswerSchema },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as GameBody;
      const result = await computeGameResult(app.pg, body.players as { pseudo: string; answers: RawAnswer[] }[]);
      return reply.code(201).send(result);
    },
  );
}
