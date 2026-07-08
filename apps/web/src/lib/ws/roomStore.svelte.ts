// État de room synchronisé par le client WS (Lot 9). Un seul store module-level (comme
// gameStore.svelte.ts) : une seule room active à la fois côté client, cohérent avec le
// pass-and-play qui n'a lui aussi qu'une seule GameState en cours.

import type {
  PublicPlayerView,
  QuestionResultsMessage,
  QuestionShowMessage,
  RoomErrorCode,
  RoomStatus,
} from './protocol';
import type { GameMode } from '../domain/scoring';

export interface RoomLeaderboardEntry {
  playerId: string;
  pseudo: string;
  score: number;
}

// connecting : socket ouverte, en attente du premier room:state (après join envoyé).
// connected : room:state reçu au moins une fois, état exploitable par les vues.
// reconnecting : coupure détectée, tentative de reconnexion en cours (backoff) — l'état
// précédent (players/question/results) reste affiché tel quel, pas de flash "chargement".
// error : coupure définitive (room_not_found, room_service_unavailable, ou tentatives épuisées).
export type RoomConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export interface RoomStoreState {
  connection: RoomConnectionStatus;
  errorCode: RoomErrorCode | null;
  code: string | null;
  mode: GameMode | null;
  status: RoomStatus | null;
  timerSeconds: number;
  // Exclut tout hôte non-joueur (isPlaying=false) -- jamais dans le classement/la liste
  // affichée, cf. domain/room-protocol.ts côté API.
  players: PublicPlayerView[];
  you: { playerId: string; isHost: boolean; isPlaying: boolean } | null;
  question: QuestionShowMessage | null;
  results: QuestionResultsMessage | null;
  leaderboard: RoomLeaderboardEntry[];
}

function initialState(): RoomStoreState {
  return {
    connection: 'idle',
    errorCode: null,
    code: null,
    mode: null,
    status: null,
    timerSeconds: 10,
    players: [],
    you: null,
    question: null,
    results: null,
    leaderboard: [],
  };
}

let state = $state<RoomStoreState>(initialState());

export function getRoomState(): RoomStoreState {
  return state;
}

export function resetRoomState(): void {
  state = initialState();
}

export function setConnection(connection: RoomConnectionStatus, errorCode: RoomErrorCode | null = null): void {
  state.connection = connection;
  state.errorCode = errorCode;
}

export function applyRoomState(msg: {
  code: string;
  mode: GameMode;
  status: RoomStatus;
  timerSeconds: number;
  players: PublicPlayerView[];
  you: { playerId: string; isHost: boolean; isPlaying: boolean };
}): void {
  state.connection = 'connected';
  state.errorCode = null;
  state.code = msg.code;
  state.mode = msg.mode;
  state.status = msg.status;
  state.timerSeconds = msg.timerSeconds;
  state.players = msg.players;
  state.you = msg.you;
}

export function applyQuestionShow(msg: QuestionShowMessage): void {
  state.question = msg;
  state.results = null;
  state.status = 'question';
}

export function applyQuestionResults(msg: QuestionResultsMessage): void {
  state.results = msg;
  state.leaderboard = msg.leaderboard;
  state.status = 'results';
}

export function applyGameEnd(leaderboard: RoomLeaderboardEntry[]): void {
  state.leaderboard = leaderboard;
  state.status = 'ended';
}

// null pour un hôte non-joueur : il n'apparaît jamais dans `players` (jamais de score/réponse
// à afficher pour lui). Les vues qui l'appellent (PlayerView) ne sont de toute façon jamais
// affichées à un hôte non-joueur (cf. RoomPlay.svelte, routage par isHost/isPlaying).
export function you(): PublicPlayerView | null {
  if (!state.you) return null;
  return state.players.find((p) => p.id === state.you!.playerId) ?? null;
}

export function isHost(): boolean {
  return state.you?.isHost ?? false;
}

export function isPlaying(): boolean {
  return state.you?.isPlaying ?? false;
}
