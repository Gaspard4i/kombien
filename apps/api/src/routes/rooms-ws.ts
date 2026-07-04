import type { FastifyInstance } from 'fastify';
import type { WebSocket } from '@fastify/websocket';
import type { RawData } from 'ws';
import { randomUUID } from 'node:crypto';
import type { RedisClientType } from 'redis';
import {
  getRoomState,
  joinRoomAndSave,
  reconnectAndSave,
  disconnectAndSave,
  startGameAndSave,
  submitAnswerAndSave,
  shouldCloseQuestion,
  closeQuestionAndSave,
  advanceAndSave,
  getLeaderboard,
  RoomServiceUnavailableError,
  type StreakByPlayer,
} from '../services/room-service.ts';
import type { RoomQuestionRef, RoomState } from '../domain/room.ts';
import type { RawAnswer } from '../domain/game.ts';
import type { DuelEstimate } from '../domain/scoring.ts';
import type {
  ClientMessage,
  ServerMessage,
  PublicPlayerView,
  RoomErrorCode,
} from '../domain/room-protocol.ts';

// Transport WebSocket des rooms multi-écrans (Lot 9, §6). Un seul canal `GET /rooms/ws` sert
// les 3 rôles (écran principal, manette MJ, appareil joueur) — voir room-protocol.ts pour le
// détail des messages. Redis reste la source de vérité de RoomState (rejoue après un restart
// process tant que le TTL n'a pas expiré) ; cette map en mémoire ne tient que ce qui est
// intrinsèquement local à CE process (mono-instance, cf. contraintes du lot — pas de pub/sub) :
// - les sockets ouvertes, pour savoir à qui envoyer quoi (websocketServer.clients ne suffit
//   pas à lui seul : il faut aussi savoir à quelle room/playerId chaque socket appartient) ;
// - le timer de question en cours (setTimeout) ;
// - le streak par joueur (persistant à travers les questions, jamais recalculé depuis Redis) ;
// - la liste ordonnée des questions tirées à la création (RoomQuestionRef[] avec vérité
//   terrain), qui n'a pas sa place dans le snapshot Redis exposé aux clients.
interface RoomRuntime {
  questions: RoomQuestionRef[];
  streaks: StreakByPlayer;
  timer: NodeJS.Timeout | null;
  connections: Map<string, WebSocket>; // playerId -> socket
}

const runtimes = new Map<string, RoomRuntime>();

function getOrCreateRuntime(code: string): RoomRuntime {
  let runtime = runtimes.get(code);
  if (!runtime) {
    runtime = { questions: [], streaks: new Map(), timer: null, connections: new Map() };
    runtimes.set(code, runtime);
  }
  return runtime;
}

function send(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function sendError(socket: WebSocket, code: RoomErrorCode): void {
  send(socket, { type: 'error', code });
}

function broadcast(runtime: RoomRuntime, message: ServerMessage): void {
  for (const socket of runtime.connections.values()) {
    send(socket, message);
  }
}

function toPublicPlayers(state: RoomState): PublicPlayerView[] {
  return state.players.map((p) => ({
    id: p.id,
    pseudo: p.pseudo,
    isGameMaster: p.isGameMaster,
    connected: p.connected,
    score: p.score,
    hasAnswered: state.pendingAnswers.has(p.id),
  }));
}

// room:state est personnalisé par destinataire (champ `you`) : on ne peut pas broadcaster un
// message unique, chaque socket reçoit sa propre vue.
function broadcastRoomState(runtime: RoomRuntime, state: RoomState): void {
  const players = toPublicPlayers(state);
  for (const [playerId, socket] of runtime.connections.entries()) {
    const self = state.players.find((p) => p.id === playerId);
    if (!self) continue;
    send(socket, {
      type: 'room:state',
      code: state.code,
      mode: state.mode,
      status: state.status,
      timerSeconds: state.timerSeconds,
      players,
      you: { playerId, isGameMaster: self.isGameMaster },
    });
  }
}

function broadcastQuestionShow(runtime: RoomRuntime, state: RoomState, question: RoomQuestionRef): void {
  const endsAt = Date.now() + state.timerSeconds * 1000;
  broadcast(runtime, {
    type: 'question:show',
    questionIndex: question.roundIndex,
    questionId: question.questionId,
    textFr: question.textFr,
    textEn: question.textEn,
    endsAt,
  });
}

// Reconstruit, pour un joueur donné, les estimations RÉELLES des autres joueurs sur le round
// en cours (mode duel) — jamais depuis un champ déclaré par le client, seulement depuis les
// pendingAnswers effectivement reçues par le serveur (même anti-triche que
// game-service.ts::withOpponentEstimates, transposée au temps réel).
function opponentsFor(playerId: string, allAnswers: Map<string, RawAnswer>): DuelEstimate[] {
  const opponents: DuelEstimate[] = [];
  for (const [otherId, answer] of allAnswers.entries()) {
    if (otherId === playerId || answer.mode !== 'duel') continue;
    opponents.push({
      value: answer.estValue ?? 0,
      unit: answer.estUnit ?? 'second',
      durationSeconds: answer.durationSeconds,
      noAnswer: answer.noAnswer,
    });
  }
  return opponents;
}

function clearTimer(runtime: RoomRuntime): void {
  if (runtime.timer) {
    clearTimeout(runtime.timer);
    runtime.timer = null;
  }
}

// Clôture la question en cours (§6.3 : tous ont répondu, timer expiré, ou skip MJ — les trois
// déclencheurs convergent ici) : score chaque réponse, broadcast les résultats + le
// classement, puis avance à la question suivante ou termine la partie. Idempotent par
// construction : si la question a déjà été clôturée (state.status !== 'question'), l'appel
// est un no-op silencieux (protège contre une course entre "tous ont répondu" et l'expiration
// du timer arrivant au même instant).
async function closeCurrentQuestion(redis: RedisClientType | null, code: string): Promise<void> {
  const runtime = getOrCreateRuntime(code);
  clearTimer(runtime);

  const before = await getRoomState(redis, code);
  if (!before || before.status !== 'question') return;

  const closed = await closeQuestionAndSave(redis, code, runtime.streaks, opponentsFor);
  if (!closed) return;

  broadcast(runtime, {
    type: 'question:results',
    questionIndex: before.currentQuestion!.roundIndex,
    durationSeconds: before.currentQuestion!.durationSeconds,
    results: closed.results.map((r) => ({
      playerId: r.playerId,
      pseudo: r.pseudo,
      points: r.points,
      scoreAfter: r.scoreAfter,
      binaryAnswer: r.answer.binaryAnswer,
      chosenUnit: r.answer.chosenUnit,
      estValue: r.answer.estValue,
      estUnit: r.answer.estUnit,
      noAnswer: r.answer.noAnswer ?? false,
    })),
    leaderboard: getLeaderboard(closed.state),
  });
}

// Avance à la question suivante (mj:next depuis la phase results) ou termine la partie si le
// pool de questions est épuisé.
async function goToNextQuestion(redis: RedisClientType | null, code: string): Promise<void> {
  const runtime = getOrCreateRuntime(code);
  const state = await getRoomState(redis, code);
  if (!state) return;

  const nextIndex = state.questionIndex + 1;
  const next = runtime.questions[nextIndex] ?? null;
  const advanced = await advanceAndSave(redis, code, next);
  if (!advanced) return;

  if (advanced.status === 'ended') {
    broadcast(runtime, { type: 'game:end', leaderboard: getLeaderboard(advanced) });
    return;
  }

  broadcastQuestionShow(runtime, advanced, next!);
  armTimer(redis, code, advanced.timerSeconds);
}

// Timer serveur-autoritatif (§6.2) : échéance absolue via setTimeout côté serveur (le client
// n'affiche qu'un décompte visuel dérivé de `endsAt`, cf. QuestionShowMessage). À expiration,
// clôture la question même si des joueurs n'ont pas répondu (non-réponse, cf. domain/room.ts
// buildNoAnswer).
function armTimer(redis: RedisClientType | null, code: string, timerSeconds: number): void {
  const runtime = getOrCreateRuntime(code);
  clearTimer(runtime);
  runtime.timer = setTimeout(() => {
    closeCurrentQuestion(redis, code).catch((err) => console.error('[rooms-ws] erreur clôture timer', err));
  }, timerSeconds * 1000);
}

export async function roomsWsRoutes(app: FastifyInstance, redis: RedisClientType | null): Promise<void> {
  app.get('/rooms/ws', { websocket: true }, (socket, request) => {
    // code+playerId de CETTE connexion, connus après le premier message `join` (le protocole
    // n'ouvre pas la connexion avec un code dans l'URL — un seul canal générique, cf. header
    // du fichier). Tant que `join` n'a pas été reçu, aucun autre message n'est traité.
    let code: string | null = null;
    let playerId: string | null = null;

    socket.on('message', (raw: RawData) => {
      void (async () => {
        let message: ClientMessage;
        try {
          message = JSON.parse(raw.toString());
        } catch {
          sendError(socket, 'invalid_message');
          return;
        }

        try {
          if (message.type === 'join') {
            await handleJoin(message);
            return;
          }
          if (!code || !playerId) {
            sendError(socket, 'unknown_player');
            return;
          }
          if (message.type === 'answer') {
            await handleAnswer(code, playerId, message);
          } else if (message.type === 'mj:start') {
            await handleMjStart(code, playerId);
          } else if (message.type === 'mj:next' || message.type === 'mj:skip') {
            await handleMjNext(code, playerId);
          } else {
            sendError(socket, 'invalid_message');
          }
        } catch (err) {
          if (err instanceof RoomServiceUnavailableError) {
            sendError(socket, 'room_not_found');
            return;
          }
          throw err;
        }
      })();
    });

    socket.on('close', () => {
      if (!code || !playerId) return;
      const runtime = getOrCreateRuntime(code);
      runtime.connections.delete(playerId);
      disconnectAndSave(redis, code, playerId)
        .then(async () => {
          const state = await getRoomState(redis, code!);
          if (state) broadcastRoomState(runtime, state);
        })
        .catch((err) => console.error('[rooms-ws] erreur déconnexion', err));
    });

    async function handleJoin(message: { code: string; pseudo?: string; playerId?: string }): Promise<void> {
      code = message.code;
      const runtime = getOrCreateRuntime(code);

      // Reconnexion (PLAN_V2) : le client renvoie son ancien playerId.
      if (message.playerId) {
        const reconnected = await reconnectAndSave(redis, code, message.playerId);
        if (reconnected) {
          playerId = message.playerId;
          runtime.connections.set(playerId, socket);
          broadcastRoomState(runtime, reconnected);
          if (reconnected.status === 'question' && reconnected.currentQuestion) {
            broadcastQuestionShow(runtime, reconnected, reconnected.currentQuestion);
          }
          return;
        }
        // playerId inconnu de cette room (TTL expiré ou jamais rejoint) : on retombe sur un
        // join classique plutôt que d'échouer, le pseudo devient alors indispensable.
      }

      if (!message.pseudo) {
        sendError(socket, 'invalid_message');
        code = null;
        return;
      }

      playerId = randomUUID();
      const result = await joinRoomAndSave(redis, code, playerId, message.pseudo);
      if (!result) {
        sendError(socket, 'room_not_found');
        code = null;
        playerId = null;
        return;
      }
      runtime.connections.set(playerId, socket);
      broadcastRoomState(runtime, result.state);
    }

    async function handleAnswer(roomCode: string, pid: string, message: { binaryAnswer?: any; chosenUnit?: any; estValue?: number; estUnit?: any }): Promise<void> {
      const state = await getRoomState(redis, roomCode);
      if (!state || !state.currentQuestion) {
        sendError(socket, 'not_in_question');
        return;
      }
      const q = state.currentQuestion;
      const answer: RawAnswer = {
        mode: state.mode,
        questionId: q.questionId,
        roundIndex: q.roundIndex,
        responseTimeMs: 0, // temps réel : la latence de réponse n'est pas mesurée côté room (pas d'exploit de session ici, cf. rapport)
        durationSeconds: q.durationSeconds,
        binaryAnswer: message.binaryAnswer,
        chosenUnit: message.chosenUnit,
        estValue: message.estValue,
        estUnit: message.estUnit,
      };

      const result = await submitAnswerAndSave(redis, roomCode, pid, answer);
      if (!result) {
        sendError(socket, 'room_not_found');
        return;
      }
      if (result.error) {
        sendError(socket, result.error);
        return;
      }

      const runtime = getOrCreateRuntime(roomCode);
      broadcastRoomState(runtime, result.state);

      if (shouldCloseQuestion(result.state)) {
        await closeCurrentQuestion(redis, roomCode);
      }
    }

    async function handleMjStart(roomCode: string, pid: string): Promise<void> {
      const state = await getRoomState(redis, roomCode);
      if (!state) {
        sendError(socket, 'room_not_found');
        return;
      }
      const self = state.players.find((p) => p.id === pid);
      if (!self?.isGameMaster) {
        sendError(socket, 'not_game_master');
        return;
      }
      const runtime = getOrCreateRuntime(roomCode);
      const first = runtime.questions[0];
      if (!first) {
        sendError(socket, 'invalid_message');
        return;
      }
      const started = await startGameAndSave(redis, roomCode, first);
      if (!started) return;
      broadcastQuestionShow(runtime, started, first);
      armTimer(redis, roomCode, started.timerSeconds);
    }

    async function handleMjNext(roomCode: string, pid: string): Promise<void> {
      const state = await getRoomState(redis, roomCode);
      if (!state) {
        sendError(socket, 'room_not_found');
        return;
      }
      const self = state.players.find((p) => p.id === pid);
      if (!self?.isGameMaster) {
        sendError(socket, 'not_game_master');
        return;
      }
      if (state.status === 'question') {
        await closeCurrentQuestion(redis, roomCode); // skip : clôture immédiate (§6.3)
      } else if (state.status === 'results') {
        await goToNextQuestion(redis, roomCode);
      }
    }
  });
}

// Enregistre la liste de questions tirées à la création de la room (createRoom, app.ts) dans
// le runtime process — nécessaire pour que mj:start/goToNextQuestion sachent quelle question
// suit, sans la remettre dans le snapshot Redis exposé aux clients (cf. RoomRuntime ci-dessus).
export function registerRoomQuestions(code: string, questions: RoomQuestionRef[]): void {
  getOrCreateRuntime(code).questions = questions;
}
