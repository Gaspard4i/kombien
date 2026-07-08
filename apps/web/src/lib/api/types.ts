import type { Unit } from '../domain/units';
import type { GameMode } from '../domain/scoring';

export interface Category {
  id: number;
  slug: string;
  name_fr: string;
  name_en: string;
  threshold_seconds: number;
}

export interface Question {
  id: number;
  category_id: number;
  text_fr: string;
  text_en: string;
  duration_seconds: number;
}

// Calibration du mode Binaire (Lot 4 v2, GAME_DESIGN_V2.md §3) : pas de category_id,
// un seul pool dédié hors des catégories de jeu (GET /calibration/questions).
export interface CalibrationQuestion {
  id: number;
  text_fr: string;
  text_en: string;
  duration_seconds: number;
}

export interface CreateQuestionInput {
  text_fr: string;
  text_en?: string;
  duration: number;
  unit: Unit;
  category_slug: string;
  category_name_fr?: string;
  category_name_en?: string;
}

export interface CreateQuestionResult {
  id: number;
  category_id: number;
  text_fr: string;
  text_en: string;
  duration_seconds: number;
  status: 'pending';
}

export interface ReportQuestionResult {
  id: number;
  report_count: number;
}

// Réponse brute envoyée au backend — la vérité (score/exploits) est recalculée côté serveur.
// questionId permet au serveur de recharger duration_seconds/threshold_seconds depuis la
// table questions (anti-triche, API_CONTRACT.md) : les valeurs envoyées ci-dessous ne sont
// plus des sources de vérité, seulement l'affichage provisoire côté client.
export interface RawAnswer {
  mode: GameMode;
  questionId: number;
  roundIndex: number;
  responseTimeMs: number;
  durationSeconds: number;
  binaryAnswer?: 'yes' | 'no';
  thresholdSeconds?: number;
  chosenUnit?: Unit;
  estValue?: number;
  estUnit?: Unit;
  opponentEstValue?: number;
  opponentEstUnit?: Unit;
  // Timer de réponse expiré, pass-and-play (v2.1) : ce joueur n'a pas répondu dans le délai.
  // Duel uniquement (binaire/ordre traitent le timeout comme une réponse "no"/unité arbitraire
  // directement scorée à 0 côté client, cf Game.svelte::handleAnswerTimeout).
  noAnswer?: boolean;
}

export interface SubmitGamePlayer {
  pseudo: string;
  answers: RawAnswer[];
}

export interface SubmitGameInput {
  mode: GameMode;
  lang: 'fr' | 'en';
  end_condition?: 'points' | 'manual';
  target_score?: number;
  rounds_played?: number;
  players: SubmitGamePlayer[]; // 2..N joueurs (GAME_DESIGN_V2.md §1.3)
}

export interface SubmitGamePlayerResult {
  pseudo: string;
  score: number;
  accuracy: number;
  best_streak: number;
  is_winner: boolean;
  session_exploits: string[];
}

export interface SubmitGameResult {
  is_draw: boolean;
  // Fin de partie assouplie (Lot 5 v2, GAME_DESIGN_V2.md §4.2 règle 4) : true si le serveur
  // n'a trouvé aucune manche complète (payload vide au sens jeu — ne devrait jamais arriver
  // si le client n'envoie que answersUpToLastCompleteRound() et bloque déjà ce cas avant
  // d'appeler POST /games, cf. Game.svelte::handleStopGame). `players` est vide si true.
  cancelled: boolean;
  players: SubmitGamePlayerResult[];
}

// --- Rooms multi-écrans temps réel (Lot 9, API_CONTRACT.md) ---

export interface CreateRoomInput {
  categorySlugs: string[];
  mode: GameMode;
  questionCount?: number;
  timerSeconds?: number;
}

export interface CreateRoomResult {
  code: string;
  // À présenter par le créateur au premier join WS pour être authentifié comme hôte de la room
  // (§6.1, modèle Kahoot) -- jamais renvoyé par GET /rooms/:code.
  hostToken: string;
  qr: string; // data URL PNG
}

export type RoomLobbyStatus = 'lobby' | 'calibration' | 'question' | 'results' | 'ended';

export interface RoomInfo {
  code: string;
  mode: GameMode;
  status: RoomLobbyStatus;
  playerCount: number;
}
