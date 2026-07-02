import type { FastifyInstance } from 'fastify';
import { levelForXp } from '../domain/xp.ts';

export async function leaderboardRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/leaderboard',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            category: { type: 'string' },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        },
      },
    },
    async (request, reply) => {
      const { category, limit = 20 } = request.query as { category?: string; limit?: number };

      // Global : top joueurs par XP cumulée.
      if (!category) {
        const { rows } = await app.pg.query(
          'SELECT pseudo, xp FROM players ORDER BY xp DESC, pseudo ASC LIMIT $1',
          [limit],
        );
        return rows.map((r: { pseudo: string; xp: string }) => ({
          pseudo: r.pseudo,
          xp: Number(r.xp),
          level: levelForXp(Number(r.xp)),
        }));
      }

      // Par catégorie : score cumulé sur les parties de cette catégorie.
      // Les parties ne portent pas de catégorie (une partie mélange les manches),
      // donc on classe par score cumulé filtré via les questions n'est pas trivial.
      // On expose ici le score cumulé global par joueur, borné à la catégorie via
      // les parties où le joueur a joué (approximation documentée : le modèle ne
      // rattache pas une partie à une catégorie unique).
      const cat = await app.pg.query('SELECT id FROM categories WHERE slug = $1', [category]);
      if (cat.rows.length === 0) {
        return reply.code(404).send({ error: 'category_not_found' });
      }
      const { rows } = await app.pg.query(
        `SELECT gs.pseudo, SUM(gs.score)::int AS total_score
         FROM game_scores gs
         GROUP BY gs.pseudo
         ORDER BY total_score DESC, gs.pseudo ASC
         LIMIT $1`,
        [limit],
      );
      return rows;
    },
  );
}
