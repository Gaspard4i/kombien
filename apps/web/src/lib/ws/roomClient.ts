// Client WS des rooms multi-écrans (Lot 9). Un seul canal `GET /rooms/ws` sert les rôles hôte
// (présente et/ou joue, pilote toujours la partie) et joueur — cf docs/API_CONTRACT.md. Ce
// module ne contient aucune logique de vue : il connecte, (re)envoie `join`, pousse les
// messages reçus dans roomStore, et expose les émetteurs (answer/mj:start/mj:next/mj:skip).
//
// Reconnexion (PLAN_V2.md) : le protocole n'a PAS de message serveur->client "heartbeat"
// documenté (cf API_CONTRACT.md, table des messages serveur->client) -- pas de ping applicatif
// à émettre ici. La détection de coupure repose sur l'événement `close`/`error` du WebSocket
// natif ; à la reconnexion on renvoie `join` avec le playerId persisté pour reprendre sa place
// (score/rôle inchangés côté serveur, cf domain/room.ts::reconnectPlayer).

import {
  applyGameEnd,
  applyQuestionResults,
  applyQuestionShow,
  applyRoomState,
  resetRoomState,
  setConnection,
} from './roomStore.svelte';
import type { AnswerMessage, ClientMessage, ServerMessage } from './protocol';
import type { Unit } from '../domain/units';

const WS_BASE = import.meta.env.VITE_WS_BASE ?? 'ws://localhost:3000';

const PLAYER_ID_PREFIX = 'kombien:room-player:';

function playerIdStorageKey(code: string): string {
  return `${PLAYER_ID_PREFIX}${code.toUpperCase()}`;
}

function getStoredPlayerId(code: string): string | null {
  return localStorage.getItem(playerIdStorageKey(code));
}

function storePlayerId(code: string, playerId: string): void {
  localStorage.setItem(playerIdStorageKey(code), playerId);
}

const MAX_RECONNECT_DELAY_MS = 8000;
const BASE_RECONNECT_DELAY_MS = 500;

export interface RoomConnection {
  answer(payload: Omit<AnswerMessage, 'type'>): void;
  mjStart(): void;
  mjNext(): void;
  mjSkip(): void;
  close(): void;
}

export interface ConnectToRoomOptions {
  // Hôte (créateur de la room) : hostToken reçu à POST /rooms, présenté au premier join pour
  // être authentifié comme hôte (§6.1, modèle Kahoot). Sans effet pour un joueur ordinaire.
  hostToken?: string;
  // Joue en plus de présenter (true) ou présente seulement (false). Sans effet si ce joueur
  // ne s'avère pas être l'hôte.
  isPlaying?: boolean;
}

/**
 * Ouvre (ou rouvre) la connexion à une room et rejoint-la avec `pseudo`. Le playerId, s'il
 * existe déjà en localStorage pour ce code, est renvoyé automatiquement (reconnexion) : le
 * pseudo n'est alors utilisé qu'en repli si le serveur ne connaît plus cet id (TTL expiré).
 * `hostToken`/`isPlaying` ne sont envoyés qu'au premier join -- une reconnexion ultérieure
 * renvoie le playerId déjà attribué, le rôle serveur (isHost/isPlaying) ne change plus.
 */
export function connectToRoom(code: string, pseudo: string, options: ConnectToRoomOptions = {}): RoomConnection {
  const upperCode = code.toUpperCase();
  let socket: WebSocket | null = null;
  let closedByCaller = false;
  let reconnectAttempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function send(message: ClientMessage): void {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }

  function scheduleReconnect(): void {
    if (closedByCaller) return;
    setConnection('reconnecting');
    const delay = Math.min(BASE_RECONNECT_DELAY_MS * 2 ** reconnectAttempt, MAX_RECONNECT_DELAY_MS);
    reconnectAttempt += 1;
    reconnectTimer = setTimeout(open, delay);
  }

  function handleMessage(event: MessageEvent): void {
    let msg: ServerMessage;
    try {
      msg = JSON.parse(event.data as string) as ServerMessage;
    } catch {
      return;
    }

    switch (msg.type) {
      case 'room:state':
        reconnectAttempt = 0;
        storePlayerId(upperCode, msg.you.playerId);
        applyRoomState(msg);
        break;
      case 'question:show':
        applyQuestionShow(msg);
        break;
      case 'question:results':
        applyQuestionResults(msg);
        break;
      case 'game:end':
        applyGameEnd(msg.leaderboard);
        break;
      case 'error':
        // room_not_found / room_service_unavailable : erreurs définitives, pas de retry
        // (retenter ne résoudra rien -- le code est invalide ou Redis est en panne). Les
        // autres codes (already_answered, not_host, invalid_message...) sont des
        // rejets de message ponctuels, pas des coupures : on ne touche pas à `connection`.
        if (msg.code === 'room_not_found' || msg.code === 'room_service_unavailable') {
          closedByCaller = true;
          setConnection('error', msg.code);
          socket?.close();
        }
        break;
    }
  }

  function open(): void {
    setConnection(reconnectAttempt > 0 ? 'reconnecting' : 'connecting');
    socket = new WebSocket(`${WS_BASE}/rooms/ws`);

    socket.addEventListener('open', () => {
      const storedPlayerId = getStoredPlayerId(upperCode);
      send({
        type: 'join',
        code: upperCode,
        pseudo,
        playerId: storedPlayerId ?? undefined,
        hostToken: options.hostToken,
        isPlaying: options.isPlaying,
      });
    });

    socket.addEventListener('message', handleMessage);

    socket.addEventListener('close', () => {
      if (closedByCaller) return;
      scheduleReconnect();
    });

    socket.addEventListener('error', () => {
      socket?.close();
    });
  }

  open();

  return {
    answer(payload) {
      send({ type: 'answer', ...payload });
    },
    mjStart() {
      send({ type: 'mj:start' });
    },
    mjNext() {
      send({ type: 'mj:next' });
    },
    mjSkip() {
      send({ type: 'mj:skip' });
    },
    close() {
      closedByCaller = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
      resetRoomState();
    },
  };
}

// Réponse brute pour le mode Binaire, envoyée via connection.answer().
export function binaryAnswerPayload(binaryAnswer: 'yes' | 'no'): Omit<AnswerMessage, 'type'> {
  return { binaryAnswer };
}

export function ordreAnswerPayload(chosenUnit: Unit): Omit<AnswerMessage, 'type'> {
  return { chosenUnit };
}

export function duelAnswerPayload(estValue: number, estUnit: Unit): Omit<AnswerMessage, 'type'> {
  return { estValue, estUnit };
}
