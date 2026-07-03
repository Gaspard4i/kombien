// Service d'orchestration d'une partie : recharge la vérité terrain des
// questions depuis la DB (anti-triche — on ne fait jamais confiance aux
// durationSeconds/thresholdSeconds envoyés par le client), puis délègue le
// scoring au domaine pur (domain/game, domain/exploits).
//
// Réutilisable tel quel par le mode temps réel (round par round, lot 9) : ce
// module ne connaît que des questions et des réponses, jamais Fastify/HTTP.

import { computePlayerRun, decideWinners, type RawAnswer } from '../domain/game.ts';
import { evaluateExploits, type ExploitSlug } from '../domain/exploits.ts';
import type { DuelEstimate } from '../domain/scoring.ts';

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
  is_winner: boolean; // true si co-vainqueur (égalité de tête), pas seulement vainqueur unique
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

// Le classement Duel à N joueurs (GAME_DESIGN_V2.md §1.3) compare les estimations de TOUS
// les joueurs sur un même TOUR de manche : on ne peut pas se fier au opponentEstValue/Unit
// unique envoyé par le client (contrat v1, un seul adversaire). On regroupe par roundIndex
// plutôt que par questionId (GAME_DESIGN_V2.md §5.3, questions différenciées) : en mode
// "questions communes" tous les joueurs partagent le même questionId pour un round donné,
// grouper par round est donc strictement équivalent à grouper par questionId (zéro
// régression) ; en mode différencié, chaque joueur a SON questionId propre sur ce round et
// c'est justement ce qui permet de les faire s'affronter malgré des questions distinctes.
// Chaque estimation adverse porte sa propre durée serveur (withServerTruth), consommée par
// scoreDuelRanked en écart relatif dès qu'elle diffère de la durée du joueur courant.
function withOpponentEstimates(players: GamePlayerInput[]): GamePlayerInput[] {
  // roundIndex -> [{ playerIndex, estimate }] pour toutes les réponses duel de la partie.
  const byRound = new Map<number, { playerIndex: number; estimate: DuelEstimate }[]>();
  players.forEach((p, playerIndex) => {
    for (const a of p.answers) {
      if (a.mode !== 'duel') continue;
      const list = byRound.get(a.roundIndex) ?? [];
      list.push({
        playerIndex,
        estimate: { value: a.estValue!, unit: a.estUnit!, durationSeconds: a.durationSeconds },
      });
      byRound.set(a.roundIndex, list);
    }
  });

  return players.map((p, playerIndex) => ({
    ...p,
    answers: p.answers.map((a) => {
      if (a.mode !== 'duel') return a;
      const opponentEstimates = (byRound.get(a.roundIndex) ?? [])
        .filter((entry) => entry.playerIndex !== playerIndex)
        .map((entry) => entry.estimate);
      return { ...a, opponentEstimates };
    }),
  }));
}

// Scoring serveur-autoritatif d'une partie complète à N joueurs, à partir des réponses
// brutes envoyées par le client. Ne persiste rien.
export async function computeGameResult(
  db: QueryExecutor,
  players: GamePlayerInput[],
): Promise<GameResult> {
  const allQuestionIds = players.flatMap((p) => p.answers.map((a) => a.questionId));
  const truths = await loadQuestionTruths(db, allQuestionIds);

  const withTruth = players.map((p) => ({ ...p, answers: withServerTruth(p.answers, truths) }));
  const withOpponents = withOpponentEstimates(withTruth);

  const computed = withOpponents.map((p) => computePlayerRun({ answers: p.answers }));
  const winner = decideWinners(computed.map((c) => c.finalScore));

  const results: PlayerGameResult[] = players.map((input, i) => {
    const comp = computed[i]!;
    return {
      pseudo: input.pseudo,
      score: comp.finalScore,
      accuracy: comp.accuracy,
      best_streak: comp.bestStreak,
      // Match nul général (is_draw) : personne n'est vainqueur (comportement v1 inchangé).
      // Co-vainqueurs (égalité de tête partielle, Multi) : chacun est_winner=true.
      is_winner: !winner.isDraw && winner.winnerIndices.includes(i),
      session_exploits: evaluateExploits({ answers: comp.playedAnswers, finalScore: comp.finalScore }),
    };
  });

  return { is_draw: winner.isDraw, players: results };
}
