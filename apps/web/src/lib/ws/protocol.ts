// Protocole de messages WebSocket des rooms multi-écrans (Lot 9), aligné 1:1 sur
// apps/api/src/domain/room-protocol.ts et docs/API_CONTRACT.md. Types dupliqués côté front
// (pas de partage de code entre apps/api et apps/web dans ce monorepo, cf CLAUDE.md) : toute
// évolution du protocole backend doit être répercutée ici manuellement.

import type { Unit } from '../domain/units';
import type { GameMode } from '../domain/scoring';

export type BinaryAnswer = 'yes' | 'no';

// lobby/question/results/ended : les 4 statuts pilotés côté transport aujourd'hui. 'calibration'
// existe dans RoomStatus côté backend mais n'est pas encore branché sur startGame (API_CONTRACT.md
// "Calibration Binaire en room") -> jamais reçu en pratique, pas de vue front pour ce statut.
export type RoomStatus = 'lobby' | 'calibration' | 'question' | 'results' | 'ended';

// ---- Client -> serveur ----

export interface JoinMessage {
  type: 'join';
  code: string;
  pseudo: string;
  playerId?: string;
}

export interface AnswerMessage {
  type: 'answer';
  binaryAnswer?: BinaryAnswer;
  chosenUnit?: Unit;
  estValue?: number;
  estUnit?: Unit;
}

export interface MjStartMessage {
  type: 'mj:start';
}

export interface MjNextMessage {
  type: 'mj:next';
}

export interface MjSkipMessage {
  type: 'mj:skip';
}

export type ClientMessage = JoinMessage | AnswerMessage | MjStartMessage | MjNextMessage | MjSkipMessage;

// ---- Serveur -> client ----

export interface PublicPlayerView {
  id: string;
  pseudo: string;
  isGameMaster: boolean;
  connected: boolean;
  score: number;
  hasAnswered: boolean;
}

export interface RoomStateMessage {
  type: 'room:state';
  code: string;
  mode: GameMode;
  status: RoomStatus;
  timerSeconds: number;
  players: PublicPlayerView[];
  you: { playerId: string; isGameMaster: boolean };
}

export interface QuestionShowMessage {
  type: 'question:show';
  questionIndex: number;
  questionId: number;
  textFr: string;
  textEn: string;
  endsAt: number;
}

export interface QuestionResultPlayerView {
  playerId: string;
  pseudo: string;
  points: number;
  scoreAfter: number;
  binaryAnswer?: BinaryAnswer;
  chosenUnit?: Unit;
  estValue?: number;
  estUnit?: Unit;
  noAnswer: boolean;
}

export interface QuestionResultsMessage {
  type: 'question:results';
  questionIndex: number;
  durationSeconds: number;
  results: QuestionResultPlayerView[];
  leaderboard: { playerId: string; pseudo: string; score: number }[];
}

export interface GameEndMessage {
  type: 'game:end';
  leaderboard: { playerId: string; pseudo: string; score: number }[];
}

export type RoomErrorCode =
  | 'room_not_found'
  | 'unknown_player'
  | 'not_in_question'
  | 'already_answered'
  | 'not_game_master'
  | 'invalid_message'
  // Erreurs de transport côté client uniquement (jamais envoyées par le serveur) : la
  // connexion elle-même a échoué, ou Redis est indisponible (503 sur POST/GET /rooms,
  // rencontré avant même l'ouverture du WS).
  | 'room_service_unavailable'
  | 'connection_lost';

export interface ErrorMessage {
  type: 'error';
  code: RoomErrorCode;
}

export type ServerMessage = RoomStateMessage | QuestionShowMessage | QuestionResultsMessage | GameEndMessage | ErrorMessage;
