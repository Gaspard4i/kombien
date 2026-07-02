// Streaks et multiplicateur — GAME_DESIGN §6.

export type GameMode = 'binaire' | 'ordre_de_grandeur' | 'duel';

// §6.2 — multiplicateur selon le streak APRÈS incrémentation de la question courante.
export function multiplier(streak: number): number {
  if (streak >= 5) return 3;
  if (streak >= 3) return 2;
  return 1;
}

// §6.1 — définition de « bonne réponse » (compte pour le streak) par mode.
export interface AnswerOutcome {
  mode: GameMode;
  basePoints: number; // points de base de ce joueur sur la question
  opponentBasePoints?: number; // requis en duel
}

export function isGoodAnswer(outcome: AnswerOutcome): boolean {
  switch (outcome.mode) {
    case 'binaire':
      // Réponse correcte = 1 pt marqué.
      return outcome.basePoints >= 1;
    case 'ordre_de_grandeur':
      // Exacte OU adjacente : >= 1 pt. L'échec à 0 casse la série.
      return outcome.basePoints >= 1;
    case 'duel':
      // Gagner OU égaliser : marquer >= 1 pt ET >= adversaire. Perdre (0) casse.
      return outcome.basePoints > 0 && outcome.basePoints >= (outcome.opponentBasePoints ?? 0);
  }
}

export interface StreakStep {
  newStreak: number;
  finalPoints: number;
  goodAnswer: boolean;
}

// Applique une réponse à l'état de streak courant et calcule les points finaux.
// - bonne réponse : streak += 1, points_finaux = basePoints * multiplicateur(nouveau streak)
// - sinon         : streak = 0, points_finaux = basePoints * 1 (0 sauf duel perdu à 0 -> 0)
export function applyAnswer(currentStreak: number, outcome: AnswerOutcome): StreakStep {
  const good = isGoodAnswer(outcome);
  if (good) {
    const newStreak = currentStreak + 1;
    return {
      newStreak,
      finalPoints: outcome.basePoints * multiplier(newStreak),
      goodAnswer: true,
    };
  }
  return {
    newStreak: 0,
    finalPoints: outcome.basePoints, // ×1 ; basePoints vaut 0 pour une non-bonne réponse
    goodAnswer: false,
  };
}
