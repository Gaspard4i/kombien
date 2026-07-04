// Persistance Redis d'une room (Lot 9, PLAN_V2.md — "Redis — structures de données").
// Best-effort : appelé uniquement quand la connexion Redis est établie (voir app.ts) ; toute
// erreur Redis remonte telle quelle, à charge de l'appelant (routes/rooms.ts, room-ws.ts) de
// la traduire en 503 room_service_unavailable plutôt que de planter le process.
//
// Structures utilisées :
// - room:{code}          Hash   métadonnées légères (mode, statut, timer, questionIndex) —
//                                lisible/inspectable directement via redis-cli, pratique en
//                                debug prod sans devoir parser du JSON.
// - room:{code}:players   Sorted Set   classement de session, scoré par le score cumulé —
//                                gratuit à lire trié (ZRANGE ... REV) après chaque question.
// - room:{code}:state     String (JSON)   snapshot complet de RoomState (players avec leur
//                                rôle/connexion, pendingAnswers, currentQuestion, lastResults)
//                                — nécessaire à la reconnexion fidèle (PLAN_V2 : "snapshot"),
//                                que le Hash+Sorted Set seuls ne suffisent pas à reconstituer
//                                (pendingAnswers est une Map, currentQuestion une vérité
//                                terrain qu'on ne veut pas re-déduire).
// Toutes les clés d'une room partagent le même TTL (30 min), rafraîchi à chaque écriture
// (activité de la room) plutôt qu'à la lecture seule.

import type { RedisClientType } from 'redis';
import type { RoomState, RoomPlayer } from '../domain/room.ts';

export const ROOM_TTL_SECONDS = 30 * 60;

function metaKey(code: string): string {
  return `room:${code}`;
}
function playersKey(code: string): string {
  return `room:${code}:players`;
}
function stateKey(code: string): string {
  return `room:${code}:state`;
}

// RoomState.pendingAnswers est une Map, non sérialisable telle quelle en JSON.stringify
// (deviendrait `{}`) : on la convertit explicitement en tableau d'entrées pour le snapshot.
interface SerializedRoomState extends Omit<RoomState, 'pendingAnswers'> {
  pendingAnswers: [string, RoomState['pendingAnswers'] extends Map<string, infer V> ? V : never][];
}

function serialize(state: RoomState): string {
  const serialized: SerializedRoomState = {
    ...state,
    pendingAnswers: [...state.pendingAnswers.entries()],
  };
  return JSON.stringify(serialized);
}

function deserialize(raw: string): RoomState {
  const parsed = JSON.parse(raw) as SerializedRoomState;
  return { ...parsed, pendingAnswers: new Map(parsed.pendingAnswers) };
}

// Écrit le snapshot complet + rafraîchit le Hash de métadonnées + le Sorted Set de classement
// + le TTL des trois clés (activité de la room). C'est la SEULE fonction d'écriture du store :
// toute mutation de RoomState (join, submitAnswer, closeQuestion, ...) passe par le domaine
// pur puis persiste son résultat ici en un seul appel, pour ne jamais désynchroniser les 3 clés.
export async function saveRoom(redis: RedisClientType, state: RoomState): Promise<void> {
  const multi = redis.multi();
  multi.set(stateKey(state.code), serialize(state));
  multi.hSet(metaKey(state.code), {
    mode: state.mode,
    status: state.status,
    timerSeconds: String(state.timerSeconds),
    questionIndex: String(state.questionIndex),
    playerCount: String(state.players.length),
  });
  multi.del(playersKey(state.code));
  if (state.players.length > 0) {
    multi.zAdd(
      playersKey(state.code),
      state.players.map((p: RoomPlayer) => ({ score: p.score, value: p.id })),
    );
  }
  multi.expire(stateKey(state.code), ROOM_TTL_SECONDS);
  multi.expire(metaKey(state.code), ROOM_TTL_SECONDS);
  multi.expire(playersKey(state.code), ROOM_TTL_SECONDS);
  await multi.exec();
}

// Recharge le snapshot complet — utilisé par le transport WS à chaque message reçu (source de
// vérité unique) et par la reconnexion. Renvoie null si la room n'existe pas/plus (TTL expiré).
export async function loadRoom(redis: RedisClientType, code: string): Promise<RoomState | null> {
  const raw = await redis.get(stateKey(code));
  if (!raw) return null;
  return deserialize(raw);
}

// État public minimal pour GET /rooms/:code (rejoindre) : n'expose ni les réponses en attente
// ni les scores détaillés, seulement de quoi décider si on peut rejoindre.
export interface PublicRoomInfo {
  code: string;
  mode: string;
  status: string;
  playerCount: number;
}

export async function loadPublicRoomInfo(redis: RedisClientType, code: string): Promise<PublicRoomInfo | null> {
  const meta = await redis.hGetAll(metaKey(code));
  if (!meta || Object.keys(meta).length === 0) return null;
  return {
    code,
    mode: meta.mode!,
    status: meta.status!,
    playerCount: Number(meta.playerCount ?? 0),
  };
}

export async function deleteRoom(redis: RedisClientType, code: string): Promise<void> {
  await redis.del([stateKey(code), metaKey(code), playersKey(code)]);
}
