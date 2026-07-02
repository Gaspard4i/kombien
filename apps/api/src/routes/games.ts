import type { FastifyInstance } from 'fastify';
import type { PoolClient } from 'pg';
import {
  computePlayerRun,
  decideWinner,
  xpForPlayer,
  type RawAnswer,
} from '../domain/game.ts';
import { evaluateBadges } from '../domain/badges.ts';
import { XP_BADGE, levelForXp } from '../domain/xp.ts';

interface GamePlayerInput {
  pseudo: string;
  answers: RawAnswer[];
}

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
  required: ['mode', 'roundIndex', 'responseTimeMs', 'durationSeconds'],
  properties: {
    mode: { type: 'string', enum: ['binaire', 'ordre_de_grandeur', 'duel'] },
    roundIndex: { type: 'integer', minimum: 0 },
    responseTimeMs: { type: 'integer', minimum: 0 },
    durationSeconds: { type: 'number', exclusiveMinimum: 0 },
    binaryAnswer: { type: 'string', enum: ['yes', 'no'] },
    thresholdSeconds: { type: 'number', exclusiveMinimum: 0 },
    chosenUnit: { type: 'string' },
    estValue: { type: 'number', exclusiveMinimum: 0 },
    estUnit: { type: 'string' },
    opponentEstValue: { type: 'number', exclusiveMinimum: 0 },
    opponentEstUnit: { type: 'string' },
  },
};

// Upsert d'un joueur par pseudo ; retourne l'état AVANT ajout d'XP de la partie.
async function upsertPlayer(client: PoolClient, pseudo: string) {
  const { rows } = await client.query(
    `INSERT INTO players (pseudo) VALUES ($1)
     ON CONFLICT (pseudo) DO UPDATE SET pseudo = EXCLUDED.pseudo
     RETURNING id, pseudo, xp, games_played, duels_won`,
    [pseudo],
  );
  return rows[0] as { id: number; pseudo: string; xp: string; games_played: number; duels_won: number };
}

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
              type: 'array',
              minItems: 2,
              maxItems: 2,
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
      const client = await app.pg.connect();
      try {
        await client.query('BEGIN');

        // 1. Recalcul du domaine (score, précision, streak, xp, badges).
        const computed = body.players.map((p) => computePlayerRun({ answers: p.answers }));
        const winner = decideWinner(computed[0].finalScore, computed[1].finalScore);

        // 2. Enregistrer la partie.
        const gameRow = await client.query(
          `INSERT INTO games (mode, lang, end_condition, target_score, rounds_played)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [body.mode, body.lang, body.end_condition ?? null, body.target_score ?? null, body.rounds_played ?? null],
        );
        const gameId = gameRow.rows[0].id as number;

        // Table des badges (slug -> id) pour l'insertion.
        const badgeRows = await client.query('SELECT id, slug FROM badges');
        const badgeIdBySlug = new Map<string, number>(
          badgeRows.rows.map((r: { id: number; slug: string }) => [r.slug, r.id]),
        );

        const results = [];
        for (let i = 0; i < body.players.length; i++) {
          const input = body.players[i];
          const comp = computed[i];
          const isWinner = winner.winnerIndex === i;

          const before = await upsertPlayer(client, input.pseudo);

          // Compteurs de profil APRÈS cette partie (pour l'évaluation des badges).
          const gamesPlayedAfter = before.games_played + 1;
          const duelsWonAfter = before.duels_won + comp.duelsWon;

          // Langues jouées : la partie courante + historique.
          const langHist = await client.query(
            `SELECT DISTINCT g.lang FROM game_scores gs JOIN games g ON g.id = gs.game_id
             WHERE gs.player_id = $1`,
            [before.id],
          );
          const langs = new Set<string>(langHist.rows.map((r: { lang: string }) => r.lang));
          langs.add(body.lang);

          const xpAnswersAndEnd = xpForPlayer(comp, isWinner);

          // XP provisoire (sans badges) pour évaluer les badges dépendants du niveau.
          const xpBeforeBadges = Number(before.xp) + xpAnswersAndEnd;

          const candidateBadges = evaluateBadges(
            { answers: comp.playedAnswers, finalScore: comp.finalScore, lang: body.lang },
            {
              gamesPlayed: gamesPlayedAfter,
              duelsWon: duelsWonAfter,
              xp: xpBeforeBadges,
              playedFr: langs.has('fr'),
              playedEn: langs.has('en'),
            },
          );

          // Badges réellement nouveaux (idempotence : un badge par pseudo).
          const ownedRows = await client.query(
            'SELECT badge_id FROM player_badges WHERE player_id = $1',
            [before.id],
          );
          const owned = new Set<number>(ownedRows.rows.map((r: { badge_id: number }) => r.badge_id));

          const newBadges: string[] = [];
          for (const slug of candidateBadges) {
            const badgeId = badgeIdBySlug.get(slug);
            if (badgeId === undefined || owned.has(badgeId)) continue;
            await client.query(
              'INSERT INTO player_badges (player_id, badge_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
              [before.id, badgeId],
            );
            newBadges.push(slug);
          }

          const xpTotalGain = xpAnswersAndEnd + newBadges.length * XP_BADGE;
          const finalXp = Number(before.xp) + xpTotalGain;

          await client.query(
            'UPDATE players SET xp = $1, games_played = $2, duels_won = $3 WHERE id = $4',
            [finalXp, gamesPlayedAfter, duelsWonAfter, before.id],
          );

          await client.query(
            `INSERT INTO game_scores (game_id, player_id, pseudo, score, accuracy, best_streak, is_winner)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [gameId, before.id, input.pseudo, comp.finalScore, comp.accuracy, comp.bestStreak, isWinner],
          );

          results.push({
            pseudo: input.pseudo,
            score: comp.finalScore,
            accuracy: comp.accuracy,
            best_streak: comp.bestStreak,
            is_winner: isWinner,
            xp_gained: xpTotalGain,
            xp_total: finalXp,
            level: levelForXp(finalXp),
            new_badges: newBadges,
          });
        }

        await client.query('COMMIT');
        return reply.code(201).send({
          game_id: gameId,
          is_draw: winner.isDraw,
          players: results,
        });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },
  );
}
