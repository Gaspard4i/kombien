// Orchestration d'une room multi-écrans (Lot 9) : relie le domaine pur (domain/room.ts) au
// scoring déjà testé (domain/scoring.ts, domain/streak.ts) et à la persistance Redis
// (room-store.ts). Réutilise le domaine round par round — aucune logique de points
// dupliquée ici, seulement l'orchestration (streak par joueur tenu en mémoire de room,
// chargement de la vérité terrain des questions depuis Postgres).

import type { RedisClientType } from 'redis';
import { randomUUID } from 'node:crypto';
import { drawQuestionsForCategories } from './questions-service.ts';
import { generateRoomCode } from './room-code.ts';
import { saveRoom, loadRoom, loadPublicRoomInfo, deleteRoom, type PublicRoomInfo } from './room-store.ts';
import {
  createRoomState,
  joinRoom,
  reconnectPlayer,
  disconnectPlayer,
  startGame,
  submitAnswer,
  allConnectedPlayersAnswered,
  closeQuestion,
  advanceToNextQuestion,
  computeLeaderboard,
  type RoomState,
  type RoomQuestionRef,
  type JoinOptions,
  type JoinResult,
  type SubmitAnswerResult,
  type CloseQuestionResult,
  type LeaderboardEntry,
} from '../domain/room.ts';
import { scoreBinary, scoreMagnitude, scoreDuelRanked, type DuelEstimate } from '../domain/scoring.ts';
import { applyAnswer, type GameMode } from '../domain/streak.ts';
import type { RawAnswer } from '../domain/game.ts';

export interface QueryExecutor {
  query(text: string, values?: unknown[]): Promise<{ rows: any[] }>;
}

const DEFAULT_TIMER_SECONDS = 10; // §6.2
const MAX_JOIN_ATTEMPTS = 10;

export class RoomServiceUnavailableError extends Error {
  constructor() {
    super('room_service_unavailable');
  }
}

function assertRedis(redis: RedisClientType | null): asserts redis is RedisClientType {
  if (!redis || !redis.isReady) {
    throw new RoomServiceUnavailableError();
  }
}

// Sérialise les opérations lire-modifier-écrire sur une même room (mono-instance, cf.
// contraintes du lot — pas de verrou distribué nécessaire). Sans ce verrou, deux `join`
// concurrents sur le hostToken (rare mais possible si le créateur ouvre deux onglets)
// pourraient tous les deux lire `hostAssigned=false` avant que l'un ou l'autre ait sauvegardé,
// et devenir hôte tous les deux (§6.1 : un seul hôte par room). Chaque fonction `*AndSave`
// ci-dessous qui fait un load -> transition pure -> save passe par `withRoomLock`.
const roomLocks = new Map<string, Promise<void>>();

// Exporté uniquement pour le test de non-régression de la sérialisation (test/room-service.test.ts)
// — jamais appelé directement en dehors de ce module en usage normal.
export async function withRoomLock<T>(code: string, fn: () => Promise<T>): Promise<T> {
  const previous = roomLocks.get(code) ?? Promise.resolve();
  const run = previous.then(fn, fn);
  // Le verrou courant de la room devient "attendre que CETTE opération se termine" (succès ou
  // échec, peu importe pour la sérialisation) ; la Map ne grossit jamais puisqu'une seule
  // entrée par code est gardée à la fois.
  const next = run.then(
    () => undefined,
    () => undefined,
  );
  roomLocks.set(code, next);
  next.finally(() => {
    if (roomLocks.get(code) === next) roomLocks.delete(code);
  });
  return run;
}

export interface CreateRoomInput {
  categorySlugs: string[];
  mode: GameMode;
  questionCount: number; // taille du pool de questions tirées pour toute la partie
  timerSeconds?: number;
}

export interface CreateRoomResult {
  code: string;
  hostToken: string; // à présenter par le créateur au premier `join` WS pour devenir l'hôte
  questions: RoomQuestionRef[]; // ordre de jeu, vérité terrain déjà chargée (anti-triche)
}

// Crée une room : tire les questions (réutilise questions-service, même pool que le
// pass-and-play), génère un code unique (retry si collision, improbable sur 6 car. mais
// vérifié pour rester correct), et persiste l'état initial (lobby, aucun joueur). Le hostToken
// est un secret serveur généré ici une seule fois : c'est la preuve que le créateur (POST
// /rooms), et lui seul, peut devenir l'hôte au join WS (§6.1, modèle Kahoot).
export async function createRoom(
  db: QueryExecutor,
  redis: RedisClientType | null,
  input: CreateRoomInput,
): Promise<CreateRoomResult> {
  assertRedis(redis);

  const rows = await drawQuestionsForCategories(db, input.categorySlugs, input.questionCount);
  const questions: RoomQuestionRef[] = rows.map((row, i) => ({
    questionId: row.id,
    roundIndex: i,
    durationSeconds: row.duration_seconds,
    textFr: row.text_fr,
    textEn: row.text_en,
  }));

  let code = generateRoomCode();
  for (let attempt = 0; attempt < MAX_JOIN_ATTEMPTS; attempt++) {
    const existing = await loadPublicRoomInfo(redis, code);
    if (!existing) break;
    code = generateRoomCode();
  }

  const hostToken = randomUUID();
  const state = createRoomState(code, input.mode, input.timerSeconds ?? DEFAULT_TIMER_SECONDS, hostToken);
  await saveRoom(redis, state);
  // La liste de questions n'a pas sa place dans RoomState (snapshot exposé tel quel côté
  // resync) : elle est reconstituée à la demande par questionAt ci-dessous, à partir de
  // l'index courant + d'un tirage stocké côté appelant (voir room-ws.ts, qui garde la liste
  // en mémoire process le temps de la partie — mono-instance, cf. contraintes du lot).
  return { code, hostToken, questions };
}

export async function getPublicRoomInfo(redis: RedisClientType | null, code: string): Promise<PublicRoomInfo | null> {
  assertRedis(redis);
  return loadPublicRoomInfo(redis, code);
}

export async function getRoomState(redis: RedisClientType | null, code: string): Promise<RoomState | null> {
  assertRedis(redis);
  return loadRoom(redis, code);
}

export async function joinRoomAndSave(
  redis: RedisClientType | null,
  code: string,
  playerId: string,
  pseudo: string,
  options: JoinOptions = {},
): Promise<JoinResult | null> {
  assertRedis(redis);
  return withRoomLock(code, async () => {
    const state = await loadRoom(redis, code);
    if (!state) return null;
    const result = joinRoom(state, playerId, pseudo, options);
    await saveRoom(redis, result.state);
    return result;
  });
}

// Reconnexion (PLAN_V2 : le client renvoie code+playerId, le serveur renvoie un snapshot).
// Renvoie null si la room n'existe plus (TTL expiré) OU si le playerId est inconnu de cette
// room — dans les deux cas l'appelant (room-ws.ts) doit répondre par une erreur explicite
// plutôt que de faire rejoindre silencieusement un nouveau joueur sous une identité usurpée.
export async function reconnectAndSave(
  redis: RedisClientType | null,
  code: string,
  playerId: string,
): Promise<RoomState | null> {
  assertRedis(redis);
  return withRoomLock(code, async () => {
    const state = await loadRoom(redis, code);
    if (!state) return null;
    const reconnected = reconnectPlayer(state, playerId);
    if (!reconnected) return null;
    await saveRoom(redis, reconnected);
    return reconnected;
  });
}

export async function disconnectAndSave(redis: RedisClientType | null, code: string, playerId: string): Promise<void> {
  assertRedis(redis);
  await withRoomLock(code, async () => {
    const state = await loadRoom(redis, code);
    if (!state) return;
    await saveRoom(redis, disconnectPlayer(state, playerId));
  });
}

export async function startGameAndSave(
  redis: RedisClientType | null,
  code: string,
  firstQuestion: RoomQuestionRef,
): Promise<RoomState | null> {
  assertRedis(redis);
  return withRoomLock(code, async () => {
    const state = await loadRoom(redis, code);
    if (!state) return null;
    const started = startGame(state, firstQuestion);
    await saveRoom(redis, started);
    return started;
  });
}

export async function submitAnswerAndSave(
  redis: RedisClientType | null,
  code: string,
  playerId: string,
  answer: RawAnswer,
): Promise<SubmitAnswerResult | null> {
  assertRedis(redis);
  return withRoomLock(code, async () => {
    const state = await loadRoom(redis, code);
    if (!state) return null;
    const result = submitAnswer(state, playerId, answer);
    if (!result.error) {
      await saveRoom(redis, result.state);
    }
    return result;
  });
}

export function shouldCloseQuestion(state: RoomState): boolean {
  return allConnectedPlayersAnswered(state);
}

// État de streak par joueur, tenu en mémoire process par room-ws.ts (mono-instance, pas de
// pub/sub nécessaire — cf. contraintes du lot) et transmis ici à chaque clôture de question.
// C'est l'équivalent temps réel du streak qui, en pass-and-play, se déduit en rejouant
// séquentiellement toutes les réponses (computePlayerRun) : ici les réponses arrivent une
// question à la fois, on ne peut pas attendre la fin de partie pour calculer.
export type StreakByPlayer = Map<string, number>;

// Score UNE réponse brute avec le domaine pur existant (scoreBinary/scoreMagnitude/
// scoreDuelRanked), applique le streak courant du joueur (applyAnswer, domain/streak.ts) et
// met à jour son streak pour la question suivante. Duel : `opponents` doit contenir les
// estimations de tous les AUTRES joueurs sur ce même round (reconstruites par l'appelant à
// partir des pendingAnswers de la room, jamais depuis un champ déclaré par le client — même
// anti-triche que computeGameResult/withOpponentEstimates en pass-and-play).
export function scoreRoomAnswer(
  streaks: StreakByPlayer,
  playerId: string,
  answer: RawAnswer,
  opponents: DuelEstimate[],
): number {
  let basePoints = 0;
  let opponentBasePoints = 0;

  // §6.2 : non-réponse (timer expiré, skip MJ) = 0 pt en Binaire/Ordre de grandeur, streak
  // cassé — sans court-circuiter ici, scoreBinary(undefined, ...) interpréterait l'absence de
  // binaryAnswer comme "no" et pourrait accidentellement marquer un point (si la vraie durée
  // est courte). Duel : géré par scoreDuelRanked lui-même (écart infini, cf. DuelEstimate.noAnswer).
  if (answer.mode === 'binaire' && answer.noAnswer) {
    basePoints = 0;
  } else if (answer.mode === 'ordre_de_grandeur' && answer.noAnswer) {
    basePoints = 0;
  } else if (answer.mode === 'binaire') {
    basePoints = scoreBinary(answer.binaryAnswer!, answer.thresholdSeconds!, answer.durationSeconds).points;
  } else if (answer.mode === 'ordre_de_grandeur') {
    basePoints = scoreMagnitude(answer.chosenUnit!, answer.durationSeconds).points;
  } else {
    const self: DuelEstimate = {
      value: answer.estValue ?? 0,
      unit: answer.estUnit ?? 'second',
      durationSeconds: answer.durationSeconds,
      noAnswer: answer.noAnswer,
    };
    const points = scoreDuelRanked([self, ...opponents], answer.durationSeconds);
    basePoints = points[0]!;
    opponentBasePoints = points.length > 1 ? Math.max(...points.slice(1)) : 0;
  }

  const currentStreak = streaks.get(playerId) ?? 0;
  const step = applyAnswer(currentStreak, { mode: answer.mode as GameMode, basePoints, opponentBasePoints });
  streaks.set(playerId, step.newStreak);
  return step.finalPoints;
}

// Clôture la question en cours (§6.3) : complète les non-répondants (domaine pur), score
// chaque réponse (streak + domaine), persiste le nouvel état. `opponentsFor` reconstruit,
// pour un joueur donné, les estimations réelles des autres joueurs de la room sur ce round
// (nécessaire uniquement en mode duel) à partir de `pendingAnswers` — l'appelant (room-ws.ts)
// le calcule une fois pour tous les joueurs avant d'appeler cette fonction.
export async function closeQuestionAndSave(
  redis: RedisClientType | null,
  code: string,
  streaks: StreakByPlayer,
  opponentsFor: (playerId: string, allAnswers: Map<string, RawAnswer>) => DuelEstimate[],
): Promise<CloseQuestionResult | null> {
  assertRedis(redis);
  return withRoomLock(code, async () => {
    const state = await loadRoom(redis, code);
    if (!state) return null;

    const result = closeQuestion(state, (playerId, answer) =>
      scoreRoomAnswer(streaks, playerId, answer, opponentsFor(playerId, state.pendingAnswers)),
    );
    await saveRoom(redis, result.state);
    return result;
  });
}

export async function advanceAndSave(
  redis: RedisClientType | null,
  code: string,
  nextQuestion: RoomQuestionRef | null,
): Promise<RoomState | null> {
  assertRedis(redis);
  return withRoomLock(code, async () => {
    const state = await loadRoom(redis, code);
    if (!state) return null;
    const advanced = advanceToNextQuestion(state, nextQuestion);
    await saveRoom(redis, advanced);
    return advanced;
  });
}

export function getLeaderboard(state: RoomState): LeaderboardEntry[] {
  return computeLeaderboard(state);
}

export async function deleteRoomAndClean(redis: RedisClientType | null, code: string): Promise<void> {
  assertRedis(redis);
  await deleteRoom(redis, code);
}
