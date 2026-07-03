// Service d'orchestration d'une partie : recharge la vérité terrain des
// questions depuis la DB (anti-triche — on ne fait jamais confiance aux
// durationSeconds/thresholdSeconds envoyés par le client), puis délègue le
// scoring au domaine pur (domain/game, domain/exploits).
//
// Réutilisable tel quel par le mode temps réel (round par round, lot 9) : ce
// module ne connaît que des questions et des réponses, jamais Fastify/HTTP.

import { computePlayerRun, decideWinner, type RawAnswer } from '../domain/game.ts';
import { evaluateExploits, type ExploitSlug } from '../domain/exploits.ts';

// Sous-ensemble de `pg.Pool` / `pg.PoolClient` suffisant à ce service.
export interface QueryExecutor {
  query(text: string, values?: unknown[]): Promise<{ rows: any[] }>;
}

export interface GamePlayerInput {
  pseudo: string;
  answers: RawAnswer[];
}

export interface PlayerGameResult {
  pseudo: string;
  score: number;
  accuracy: number;
  best_streak: number;
  is_winner: boolean;
  session_exploits: ExploitSlug[];
}

export interface GameResult {
  is_draw: boolean;
  players: PlayerGameResult[];
}

interface QuestionTruth {
  duration_seconds: number;
  threshold_seconds: number | null; // seuil de la catégorie de la question (mode binaire)
}

// Recharge, pour un ensemble de questionId, la durée réelle et le seuil de
// catégorie associé (jointure questions -> categories). Lève si un id est
// inconnu : une réponse ne peut pas référencer une question qui n'existe pas.
async function loadQuestionTruths(
  db: QueryExecutor,
  questionIds: number[],
): Promise<Map<number, QuestionTruth>> {
  const uniqueIds = [...new Set(questionIds)];
  if (uniqueIds.length === 0) return new Map();

  const { rows } = await db.query(
    `SELECT q.id, q.duration_seconds, c.threshold_seconds
     FROM questions q JOIN categories c ON c.id = q.category_id
     WHERE q.id = ANY($1::int[])`,
    [uniqueIds],
  );

  const truths = new Map<number, QuestionTruth>();
  for (const row of rows) {
    truths.set(row.id, {
      duration_seconds: Number(row.duration_seconds),
      threshold_seconds: row.threshold_seconds === null ? null : Number(row.threshold_seconds),
    });
  }

  const missing = uniqueIds.filter((id) => !truths.has(id));
  if (missing.length > 0) {
    throw new Error(`questions introuvables : ${missing.join(', ')}`);
  }
  return truths;
}

// Réhydrate les réponses brutes d'un joueur avec la vérité terrain serveur :
// durationSeconds et (mode binaire) thresholdSeconds sont écrasés, jamais lus
// depuis le payload client.
function withServerTruth(answers: RawAnswer[], truths: Map<number, QuestionTruth>): RawAnswer[] {
  return answers.map((a) => {
    const truth = truths.get(a.questionId)!;
    return {
      ...a,
      durationSeconds: truth.duration_seconds,
      thresholdSeconds: a.mode === 'binaire' ? (truth.threshold_seconds ?? a.thresholdSeconds) : a.thresholdSeconds,
    };
  });
}

// Scoring serveur-autoritatif d'une partie complète à deux joueurs, à partir
// des réponses brutes envoyées par le client. Ne persiste rien.
export async function computeGameResult(
  db: QueryExecutor,
  players: GamePlayerInput[],
): Promise<GameResult> {
  const allQuestionIds = players.flatMap((p) => p.answers.map((a) => a.questionId));
  const truths = await loadQuestionTruths(db, allQuestionIds);

  const computed = players.map((p) => computePlayerRun({ answers: withServerTruth(p.answers, truths) }));
  const [computedA, computedB] = computed;
  const winner = decideWinner(computedA!.finalScore, computedB!.finalScore);

  const results: PlayerGameResult[] = players.map((input, i) => {
    const comp = computed[i]!;
    return {
      pseudo: input.pseudo,
      score: comp.finalScore,
      accuracy: comp.accuracy,
      best_streak: comp.bestStreak,
      is_winner: winner.winnerIndex === i,
      session_exploits: evaluateExploits({ answers: comp.playedAnswers, finalScore: comp.finalScore }),
    };
  });

  return { is_draw: winner.isDraw, players: results };
}
