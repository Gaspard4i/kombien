// Protocole de messages WebSocket des rooms multi-écrans (Lot 9). Types purs, partagés entre
// le transport (routes/rooms-ws.ts) et sa documentation (docs/API_CONTRACT.md). Chaque message
// porte un `type` discriminant — un seul canal `GET /rooms/ws` sert tous les rôles (écran
// principal, manette MJ, appareil joueur), c'est le CONTENU des messages serveur->client qui
// diffère selon ce que le rôle a le droit de voir (§6.1 : jamais de fuite des réponses avant
// révélation, y compris au MJ pour ses propres réponses).

import type { UnitSlug } from './units.ts';
import type { GameMode } from './streak.ts';
import type { BinaryAnswer } from './scoring.ts';
import type { RoomStatus } from './room.ts';

// ---- Client -> serveur ----

export interface JoinMessage {
  type: 'join';
  code: string;
  pseudo: string;
  // Reconnexion (PLAN_V2) : si le client a déjà un playerId (stocké côté front après un
  // premier join), il le renvoie pour reprendre sa place plutôt que d'en créer une nouvelle.
  playerId?: string;
}

// Réponse brute d'un joueur à la question en cours. Mêmes champs que RawAnswer (domain/game.ts)
// hors questionId/roundIndex/durationSeconds : la room CONNAÎT déjà la question courante
// (vérité terrain chargée côté serveur à la création de la room, cf. RoomQuestionRef), le
// client n'a donc rien à déclarer dessus — anti-triche identique au pass-and-play, renforcé
// puisqu'ici même roundIndex/questionId ne sont jamais lus depuis le client.
export interface AnswerMessage {
  type: 'answer';
  binaryAnswer?: BinaryAnswer;
  chosenUnit?: UnitSlug;
  estValue?: number;
  estUnit?: UnitSlug;
}

export interface MjStartMessage {
  type: 'mj:start';
}

// Passe à la question suivante sans attendre les retardataires (§6.3, "disponible à tout
// moment, y compris avant expiration, pour débloquer un joueur AFK"). Envoyé par le MJ
// pendant la phase question (clôt) ou pendant la phase results (avance).
export interface MjNextMessage {
  type: 'mj:next';
}

// Alias explicite de mj:next pendant la phase question ("passer à la suite" avant expiration
// du timer, §6.3) — distingué de mj:next (phase results -> question suivante) uniquement
// pour la lisibilité du protocole côté front ; le serveur traite les deux de façon équivalente
// selon la phase courante.
export interface MjSkipMessage {
  type: 'mj:skip';
}

export type ClientMessage = JoinMessage | AnswerMessage | MjStartMessage | MjNextMessage | MjSkipMessage;

// ---- Serveur -> client ----

// Vue joueur exposée dans room:state : jamais les réponses, seulement identité/statut/score.
export interface PublicPlayerView {
  id: string;
  pseudo: string;
  isGameMaster: boolean;
  connected: boolean;
  score: number;
  hasAnswered: boolean; // pendant la phase question, sans révéler LA réponse
}

// Diffusé après join/leave/toute mutation de la liste de joueurs, et en resync de
// reconnexion. `you` indique au destinataire lequel des `players` est lui-même (id stable
// côté client pour se retrouver dans la liste après un re-render).
export interface RoomStateMessage {
  type: 'room:state';
  code: string;
  mode: GameMode;
  status: RoomStatus;
  timerSeconds: number;
  players: PublicPlayerView[];
  you: { playerId: string; isGameMaster: boolean };
}

// Affichage de la question courante. `endsAt` (timestamp epoch ms) permet au client de
// calculer son propre décompte visuel SANS piloter la clôture (échéance absolue, cf.
// GAME_DESIGN_V2.md §5bis — même principe que AnswerTimer.svelte, mais c'est le SERVEUR qui
// clôt à expiration, le client ne fait qu'afficher).
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
  // Révélation (§6.3) : c'est seulement À CE STADE que la vraie réponse peut être montrée.
  binaryAnswer?: BinaryAnswer;
  chosenUnit?: UnitSlug;
  estValue?: number;
  estUnit?: UnitSlug;
  noAnswer: boolean;
}

export interface QuestionResultsMessage {
  type: 'question:results';
  questionIndex: number;
  durationSeconds: number; // vraie durée, révélée (split-flap côté front)
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
  | 'invalid_message';

export interface ErrorMessage {
  type: 'error';
  code: RoomErrorCode;
}

export type ServerMessage =
  | RoomStateMessage
  | QuestionShowMessage
  | QuestionResultsMessage
  | GameEndMessage
  | ErrorMessage;
