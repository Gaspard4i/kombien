import type { FastifyInstance } from 'fastify';
import { drawCalibrationQuestions } from '../services/calibration-service.ts';

// Lot 4 v2 (GAME_DESIGN_V2.md §3) : phase de calibration du mode Binaire, avant la
// première manche. Sert les questions du pool dédié ; la dérivation du seuil
// individuel par joueur (deriveThreshold, domain/calibration.ts) est faite côté
// client au fil des réponses, le résultat n'étant lu par le serveur qu'au moment
// du scoring de la partie (POST /games, thresholdSeconds par réponse binaire).
export async function calibrationRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/calibration/questions',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            // §3.1 : 5 questions par défaut. Paramétrable pour les tests/tuning,
            // borné au pool réel (8 questions seedées, migration 0005).
            count: { type: 'integer', minimum: 1, maximum: 50, default: 5 },
          },
        },
      },
    },
    async (request) => {
      const { count = 5 } = request.query as { count?: number };
      return drawCalibrationQuestions(app.pg, count);
    },
  );
}
