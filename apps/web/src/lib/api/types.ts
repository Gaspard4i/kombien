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
  players: [SubmitGamePlayer, SubmitGamePlayer];
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
  players: [SubmitGamePlayerResult, SubmitGamePlayerResult];
}
