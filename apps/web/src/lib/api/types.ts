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

export interface LeaderboardGlobalEntry {
  pseudo: string;
  xp: number;
  level: number;
}

export interface LeaderboardCategoryEntry {
  pseudo: string;
  total_score: number;
}

export interface Badge {
  slug: string;
  name_fr: string;
  name_en: string;
  description_fr: string;
  description_en: string;
  unlocked_at: string;
}

export interface PlayerProfile {
  pseudo: string;
  xp: number;
  level: number;
  games_played: number;
  duels_won: number;
  created_at: string;
  badges: Badge[];
  stats: {
    games: number;
    total_score: number;
    best_streak: number;
    avg_accuracy: number;
    wins: number;
  };
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

// Réponse brute envoyée au backend — la vérité (score/xp/badges) est recalculée côté serveur.
export interface RawAnswer {
  mode: GameMode;
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
  xp_gained: number;
  xp_total: number;
  level: number;
  new_badges: string[];
}

export interface SubmitGameResult {
  game_id: number;
  is_draw: boolean;
  players: [SubmitGamePlayerResult, SubmitGamePlayerResult];
}
