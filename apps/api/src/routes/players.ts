import type { FastifyInstance } from 'fastify';
import { levelForXp } from '../domain/xp.ts';

export async function playersRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/players/:pseudo',
    {
      schema: {
        params: {
          type: 'object',
          required: ['pseudo'],
          properties: { pseudo: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const { pseudo } = request.params as { pseudo: string };

      const playerRes = await app.pg.query(
        'SELECT id, pseudo, xp, games_played, duels_won, created_at FROM players WHERE pseudo = $1',
        [pseudo],
      );
      if (playerRes.rows.length === 0) {
        return reply.code(404).send({ error: 'player_not_found' });
      }
      const player = playerRes.rows[0];
      const xp = Number(player.xp);

      const badgesRes = await app.pg.query(
        `SELECT b.slug, b.name_fr, b.name_en, b.description_fr, b.description_en, pb.unlocked_at
         FROM player_badges pb JOIN badges b ON b.id = pb.badge_id
         WHERE pb.player_id = $1 ORDER BY pb.unlocked_at`,
        [player.id],
      );

      const statsRes = await app.pg.query(
        `SELECT
           count(*)::int AS games,
           coalesce(sum(score), 0)::int AS total_score,
           coalesce(max(best_streak), 0)::int AS best_streak,
           coalesce(avg(accuracy), 0)::float AS avg_accuracy,
           coalesce(sum(case when is_winner then 1 else 0 end), 0)::int AS wins
         FROM game_scores WHERE player_id = $1`,
        [player.id],
      );

      return {
        pseudo: player.pseudo,
        xp,
        level: levelForXp(xp),
        games_played: player.games_played,
        duels_won: player.duels_won,
        created_at: player.created_at,
        badges: badgesRes.rows,
        stats: statsRes.rows[0],
      };
    },
  );
}
