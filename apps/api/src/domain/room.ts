// Rooms multi-écrans temps réel (Lot 9, PLAN_V2.md + GAME_DESIGN_V2.md §6). État et
// transitions PURS (pas d'I/O, pas de Redis, pas de WS) : le transport (services/room-ws.ts)
// se contente de charger un RoomState, appeler ces fonctions, puis persister/broadcaster le
// résultat. Réutilise le scoring existant (domain/game.ts, domain/scoring.ts) round par
// round — une room ne réimplémente jamais le calcul de points.

import type { GameMode } from './streak.ts';
import type { RawAnswer } from './game.ts';

export type RoomStatus = 'lobby' | 'calibration' | 'question' | 'results' | 'ended';

export interface RoomPlayer {
  id: string;
  pseudo: string;
  // Hôte = créateur de la room (celui qui a POST /rooms), authentifié via hostToken au join
  // -- plus "le premier connecté" (ancien modèle isGameMaster). Un seul hôte par room, décidé
  // une fois pour toutes à la création (RoomState.hostToken), jamais réattribué au premier
  // arrivant. L'hôte peut ne pas jouer (isPlaying=false, modèle Kahoot : écran de présentation
  // + contrôleur) : il pilote toujours la partie (mj:start/next/skip), mais un hôte non-joueur
  // ne répond jamais et n'entre dans aucun calcul de jeu (voir allConnectedPlayersAnswered,
  // closeQuestion, computeLeaderboard ci-dessous).
  isHost: boolean;
  isPlaying: boolean;
  connected: boolean;
  score: number;
}

export interface RoomQuestionRef {
  questionId: number;
  roundIndex: number;
  durationSeconds: number; // vérité terrain déjà chargée par le service appelant (anti-triche)
  textFr: string;
  textEn: string;
}

// État complet d'une room, sérialisable tel quel en snapshot Redis (room:{code}:state).
export interface RoomState {
  code: string;
  mode: GameMode;
  status: RoomStatus;
  timerSeconds: number; // configurable au setup, 10s par défaut (§6.2)
  // Secret généré à la création (room-service.ts::createRoom), jamais exposé aux clients sauf
  // au créateur dans la réponse POST /rooms (hostToken). C'est la preuve que le premier `join`
  // qui le présente est bien le créateur -- décidé une fois pour toutes, jamais réattribué au
  // premier connecté (ancien modèle, cf. RoomPlayer.isHost).
  hostToken: string;
  hostAssigned: boolean; // un seul hôte par room, même si le créateur rejoint après d'autres joueurs
  players: RoomPlayer[];
  questionIndex: number; // index dans la liste de questions de la room, -1 avant le début
  currentQuestion: RoomQuestionRef | null;
  // Réponses brutes reçues pour la question en cours, une par joueur ayant répondu.
  // Jamais exposée aux clients avant results (§6.1 : le MJ ne voit jamais les réponses
  // des autres avant révélation, y compris les siennes ne lui donnent pas d'avantage).
  pendingAnswers: Map<string, RawAnswer>;
  // Dernier résultat de question calculé (pour resync results/game:end), null sinon.
  lastResults: QuestionResultEntry[] | null;
}

export function createRoomState(code: string, mode: GameMode, timerSeconds: number, hostToken: string): RoomState {
  return {
    code,
    mode,
    status: 'lobby',
    timerSeconds,
    hostToken,
    hostAssigned: false,
    players: [],
    questionIndex: -1,
    currentQuestion: null,
    pendingAnswers: new Map(),
    lastResults: null,
  };
}

export interface JoinResult {
  state: RoomState;
  player: RoomPlayer;
}

export interface JoinOptions {
  // Présenté par le créateur au premier join (récupéré depuis la réponse POST /rooms) : ne
  // fait de ce joueur l'hôte que s'il correspond au token de la room ET qu'aucun hôte n'a
  // encore été assigné (un seul hôte par room, jamais réattribué à un join ultérieur).
  hostToken?: string;
  // Choix de l'hôte à l'entrée : présente seulement (false) ou joue aussi (true, défaut). Sans
  // effet si ce joueur ne s'avère pas être l'hôte (hostToken absent/incorrect).
  isPlaying?: boolean;
}

// Rejoindre le lobby : l'hôte est le créateur de la room (authentifié par hostToken), pas "le
// premier connecté" (§ modèle Kahoot). Un hôte peut choisir de ne pas jouer (isPlaying=false)
// -- écran de présentation + contrôleur, jamais dans le classement ni dans les calculs de jeu
// (voir allConnectedPlayersAnswered/closeQuestion/computeLeaderboard). Un pseudo qui revient
// (même id) reconnecte sa place plutôt que d'en créer une nouvelle (voir reconnectPlayer).
export function joinRoom(state: RoomState, playerId: string, pseudo: string, options: JoinOptions = {}): JoinResult {
  const becomesHost = !state.hostAssigned && options.hostToken !== undefined && options.hostToken === state.hostToken;
  const player: RoomPlayer = {
    id: playerId,
    pseudo,
    isHost: becomesHost,
    isPlaying: becomesHost ? (options.isPlaying ?? true) : true,
    connected: true,
    score: 0,
  };
  return {
    state: {
      ...state,
      hostAssigned: state.hostAssigned || becomesHost,
      players: [...state.players, player],
    },
    player,
  };
}

// Reconnexion (PLAN_V2.md, snapshot) : un joueur déjà présent (même id) revient après une
// coupure — on le marque connecté sans toucher à son score ni à son rôle d'hôte. Renvoie null
// si l'id est inconnu de cette room (le joueur doit alors rejoindre via joinRoom).
export function reconnectPlayer(state: RoomState, playerId: string): RoomState | null {
  const exists = state.players.some((p) => p.id === playerId);
  if (!exists) return null;
  return {
    ...state,
    players: state.players.map((p) => (p.id === playerId ? { ...p, connected: true } : p)),
  };
}

export function disconnectPlayer(state: RoomState, playerId: string): RoomState {
  return {
    ...state,
    players: state.players.map((p) => (p.id === playerId ? { ...p, connected: false } : p)),
  };
}

// L'hôte (qu'il joue ou non) pilote toujours la partie -- un hôte déconnecté n'empêche jamais
// la partie de continuer (pas de transfert de rôle documenté par GAME_DESIGN_V2.md, un hôte
// déconnecté peut revenir sur le même id via reconnectPlayer). Un hôte non-joueur, lui, ne
// bloque jamais la clôture d'une question puisqu'il n'est jamais attendu (voir
// allConnectedPlayersAnswered ci-dessous).

// Démarre la partie (mj:start) : verrouille la liste de joueurs, passe à la première question.
// `questions` est la liste ordonnée des questions déjà tirées et validées par le service
// appelant (chaque RoomQuestionRef porte déjà sa vérité terrain serveur).
export function startGame(state: RoomState, firstQuestion: RoomQuestionRef): RoomState {
  return {
    ...state,
    status: 'question',
    questionIndex: 0,
    currentQuestion: firstQuestion,
    pendingAnswers: new Map(),
    lastResults: null,
  };
}

export type SubmitAnswerError = 'not_in_question' | 'already_answered' | 'unknown_player' | 'not_playing';

export interface SubmitAnswerResult {
  state: RoomState;
  error?: SubmitAnswerError;
}

// Enregistre la réponse brute d'un joueur pour la question en cours (une seule par joueur —
// un second envoi est ignoré, pas d'écrasement silencieux qui permettrait de "corriger" une
// réponse après avoir vu une fuite d'information). Un hôte non-joueur (isPlaying=false) n'a
// pas de zone de réponse côté client, mais on refuse aussi côté serveur par sécurité
// (not_playing) plutôt que de faire confiance au client.
export function submitAnswer(state: RoomState, playerId: string, answer: RawAnswer): SubmitAnswerResult {
  if (state.status !== 'question' || !state.currentQuestion) {
    return { state, error: 'not_in_question' };
  }
  const player = state.players.find((p) => p.id === playerId);
  if (!player) {
    return { state, error: 'unknown_player' };
  }
  if (!player.isPlaying) {
    return { state, error: 'not_playing' };
  }
  if (state.pendingAnswers.has(playerId)) {
    return { state, error: 'already_answered' };
  }
  const pendingAnswers = new Map(state.pendingAnswers);
  pendingAnswers.set(playerId, answer);
  return { state: { ...state, pendingAnswers } };
}

// §6.3 — la question se clôt quand tous les joueurs JOUANTS et CONNECTÉS ont répondu. Un hôte
// non-joueur n'est jamais attendu (il ne répond jamais) ; un joueur déconnecté ne bloque jamais
// la partie non plus (il rejouera avec noAnswer s'il ne revient pas à temps, cf. buildNoAnswer
// ci-dessous).
export function allConnectedPlayersAnswered(state: RoomState): boolean {
  const connected = state.players.filter((p) => p.isPlaying && p.connected);
  if (connected.length === 0) return false;
  return connected.every((p) => state.pendingAnswers.has(p.id));
}

// Complète les réponses manquantes par une non-réponse (timer expiré OU skip MJ, §6.2) :
// traitée exactement comme en pass-and-play v2.1 — Binaire/Ordre de grandeur 0 pt, Duel écart
// infini. mode/questionId/roundIndex/durationSeconds sont connus de la room (vérité serveur) ;
// seuls les champs spécifiques au mode sont absents pour ces joueurs.
function buildNoAnswer(state: RoomState): RawAnswer {
  const q = state.currentQuestion!;
  return {
    mode: state.mode,
    questionId: q.questionId,
    roundIndex: q.roundIndex,
    responseTimeMs: state.timerSeconds * 1000,
    durationSeconds: q.durationSeconds,
    noAnswer: true,
  };
}

export interface QuestionResultEntry {
  playerId: string;
  pseudo: string;
  points: number; // points de CETTE question (avant streak, cf. applyAnswer côté service)
  scoreAfter: number; // score cumulé de session après cette question
  answer: RawAnswer;
}

export interface CloseQuestionResult {
  state: RoomState;
  results: QuestionResultEntry[];
}

// Clôture la question en cours (§6.3, trois déclencheurs équivalents : tous ont répondu, timer
// expiré, ou skip MJ) : complète les non-répondants, calcule le résultat via `scorePlayer`
// (fonction injectée par le service appelant, qui réutilise domain/game.ts computePlayerRun
// pour rester sur le domaine pur déjà testé), puis passe en statut "results". Ne connaît pas
// la question suivante — c'est advanceToNextQuestion qui le fait, décision distincte du MJ ou
// du serveur (§6.3 : "puis question suivante", un pas séparé côté protocole).
// Un hôte non-joueur n'a jamais de résultat de question (jamais de réponse, jamais de score) --
// exclu ici en amont plutôt que scoré à 0 pt, pour ne jamais apparaître dans les résultats ni
// casser un streak qui n'existe pas pour lui.
export function closeQuestion(
  state: RoomState,
  scorePlayer: (playerId: string, answer: RawAnswer) => number,
): CloseQuestionResult {
  const noAnswer = buildNoAnswer(state);
  const results: QuestionResultEntry[] = state.players
    .filter((p) => p.isPlaying)
    .map((p) => {
      const answer = state.pendingAnswers.get(p.id) ?? noAnswer;
      const points = scorePlayer(p.id, answer);
      return { playerId: p.id, pseudo: p.pseudo, points, scoreAfter: p.score + points, answer };
    });

  const players = state.players.map((p) => {
    const entry = results.find((r) => r.playerId === p.id);
    return entry ? { ...p, score: entry.scoreAfter } : p;
  });

  return {
    state: { ...state, status: 'results', players, lastResults: results },
    results,
  };
}

// Avance à la question suivante (ou termine la partie si `nextQuestion` est null — pool
// épuisé ou dernière manche jouée, décidé par le service appelant qui connaît la liste
// complète des questions de la room).
export function advanceToNextQuestion(state: RoomState, nextQuestion: RoomQuestionRef | null): RoomState {
  if (!nextQuestion) {
    return { ...state, status: 'ended', currentQuestion: null, pendingAnswers: new Map() };
  }
  return {
    ...state,
    status: 'question',
    questionIndex: state.questionIndex + 1,
    currentQuestion: nextQuestion,
    pendingAnswers: new Map(),
    lastResults: null,
  };
}

// Classement de session (§6.5), dérivé des scores déjà tenus à jour dans state.players à
// chaque closeQuestion — pas de recalcul, juste un tri stable par score décroissant (le
// Sorted Set Redis, cf. services/room-store.ts, donne la même chose gratuitement côté
// persistance ; cette fonction est la version pure utilisée pour construire les messages
// room:state/game:end sans dépendre du transport).
export interface LeaderboardEntry {
  playerId: string;
  pseudo: string;
  score: number;
}

// Un hôte non-joueur n'a jamais de score et n'apparaît jamais dans le classement (§6.1 : ce
// n'est pas un participant, seulement un écran de présentation + contrôleur).
export function computeLeaderboard(state: RoomState): LeaderboardEntry[] {
  return state.players
    .filter((p) => p.isPlaying)
    .sort((a, b) => b.score - a.score)
    .map((p) => ({ playerId: p.id, pseudo: p.pseudo, score: p.score }));
}
