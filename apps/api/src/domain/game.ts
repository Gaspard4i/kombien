// Agrégation d'une partie complète côté serveur : à partir des réponses brutes
// de chaque joueur, recalcule score final, précision, meilleur streak et
// données par-réponse nécessaires à l'évaluation des exploits de session.
// Fonctions pures (pas d'I/O) — GAME_DESIGN §3-§9.

import { type UnitSlug, toSeconds } from './units.ts';
import {
  scoreBinary,
  scoreMagnitude,
  scoreDuelRanked,
  type BinaryAnswer,
  type DuelEstimate,
} from './scoring.ts';
import { applyAnswer, type GameMode } from './streak.ts';
import type { PlayedAnswer } from './exploits.ts';

// Réponse brute d'un joueur à une question, selon le mode. questionId permet
// au service appelant de recharger la vérité terrain (durationSeconds,
// thresholdSeconds) depuis la DB plutôt que de faire confiance au client.
export interface RawAnswer {
  mode: GameMode;
  questionId: number;
  roundIndex: number;
  responseTimeMs: number;
  durationSeconds: number;

  // binaire
  binaryAnswer?: BinaryAnswer;
  thresholdSeconds?: number;

  // ordre de grandeur
  chosenUnit?: UnitSlug;

  // duel (perspective de CE joueur) : estimation propre + estimations de TOUS les autres
  // joueurs sur la même question (GAME_DESIGN_V2.md §1.3, classement par rang d'écart à N
  // joueurs). opponentEstValue/opponentEstUnit (contrat v1, un seul adversaire) restent
  // acceptés en alias du cas N=2 pour compatibilité, mais opponentEstimates est la source
  // de vérité dès que présente.
  estValue?: number;
  estUnit?: UnitSlug;
  opponentEstValue?: number;
  opponentEstUnit?: UnitSlug;
  opponentEstimates?: DuelEstimate[];
}

// Normalise les adversaires d'une réponse duel en liste, quel que soit le format
// d'entrée (v1 un seul adversaire, ou v2 liste explicite pour N joueurs).
function resolveOpponentEstimates(raw: RawAnswer): DuelEstimate[] {
  if (raw.opponentEstimates) return raw.opponentEstimates;
  if (raw.opponentEstValue !== undefined && raw.opponentEstUnit !== undefined) {
    return [{ value: raw.opponentEstValue, unit: raw.opponentEstUnit }];
  }
  return [];
}

export interface PlayerRun {
  answers: RawAnswer[];
}

export interface PlayerComputed {
  finalScore: number;
  goodAnswers: number;
  totalAnswers: number;
  accuracy: number; // 0..1
  bestStreak: number;
  duelsWon: number; // duels gagnés (2 pts) dans cette partie
  playedAnswers: PlayedAnswer[]; // pour l'évaluation des exploits
}

// Calcule le résultat d'un joueur en rejouant ses réponses dans l'ordre.
// Le streak persiste sur toute la partie (à travers les manches).
export function computePlayerRun(run: PlayerRun): PlayerComputed {
  let streak = 0;
  let bestStreak = 0;
  let finalScore = 0;
  let goodAnswers = 0;
  let duelsWon = 0;
  const playedAnswers: PlayedAnswer[] = [];

  for (const raw of run.answers) {
    let basePoints = 0;
    let opponentBasePoints = 0;
    let exactMagnitude = false;
    let wonDuel = false;
    let duelErrorSeconds = 0;

    if (raw.mode === 'binaire') {
      const r = scoreBinary(raw.binaryAnswer!, raw.thresholdSeconds!, raw.durationSeconds);
      basePoints = r.points;
    } else if (raw.mode === 'ordre_de_grandeur') {
      const r = scoreMagnitude(raw.chosenUnit!, raw.durationSeconds);
      basePoints = r.points;
      exactMagnitude = r.exact;
    } else {
      // durationSeconds porté explicitement : en mode différencié (GAME_DESIGN_V2.md §5),
      // chaque joueur a sa propre question donc sa propre durée réelle. En mode "questions
      // communes" toutes les durées sont identiques, scoreDuelRanked s'y réduit à l'écart
      // absolu v1 (cf. commentaire scoring.ts).
      const self: DuelEstimate = { value: raw.estValue!, unit: raw.estUnit!, durationSeconds: raw.durationSeconds };
      const opponents = resolveOpponentEstimates(raw);
      const estimates = [self, ...opponents];
      const points = scoreDuelRanked(estimates, raw.durationSeconds);
      basePoints = points[0]!;
      // Le meilleur des points adverses détermine si CE joueur a "gagné ou égalisé"
      // (§6.1 : bonne réponse duel = marquer >= aux autres). Généralise le cas 1
      // adversaire (v1) où opponentBasePoints est simplement l'unique autre point.
      opponentBasePoints = points.length > 1 ? Math.max(...points.slice(1)) : 0;
      duelErrorSeconds = Math.abs(toSeconds(self.value, self.unit) - raw.durationSeconds);
      wonDuel = basePoints === 2;
      if (wonDuel) duelsWon += 1;
    }

    const step = applyAnswer(streak, {
      mode: raw.mode,
      basePoints,
      opponentBasePoints,
    });
    streak = step.newStreak;
    if (streak > bestStreak) bestStreak = streak;
    finalScore += step.finalPoints;
    if (step.goodAnswer) goodAnswers += 1;

    playedAnswers.push({
      mode: raw.mode,
      roundIndex: raw.roundIndex,
      responseTimeMs: raw.responseTimeMs,
      goodAnswer: step.goodAnswer,
      exactMagnitude,
      wonDuel,
      durationSeconds: raw.durationSeconds,
      duelErrorSeconds,
      streakAfter: streak,
    });
  }

  const totalAnswers = run.answers.length;
  const accuracy = totalAnswers === 0 ? 0 : goodAnswers / totalAnswers;

  return {
    finalScore,
    goodAnswers,
    totalAnswers,
    accuracy,
    bestStreak,
    duelsWon,
    playedAnswers,
  };
}

// Fin de partie assouplie (GAME_DESIGN_V2.md §4) : un arrêt en cours de manche annule
// entièrement cette manche pour tous les joueurs (score ET streak reviennent à l'état de
// la dernière manche COMPLETE). "Manche complète" = tous les joueurs ont le même nombre de
// réponses pour ce roundIndex (le serveur ne connaît pas questionsPerRound, mais il connaît
// le nombre de joueurs : un round incomplet se voit à un déséquilibre entre joueurs).
//
// Robuste même si le client envoie déjà les réponses tronquées (cas nominal, cf.
// gameStore.svelte.ts) : ce cas ne trouve alors aucun round incomplet et ne tronque rien.
export interface TruncateResult {
  // Réponses par joueur, tronquées au dernier round complet (même ordre que l'entrée).
  players: RawAnswer[][];
  // true si AUCUNE manche complète n'a pu être établie (arrêt pendant la toute première
  // manche, GAME_DESIGN_V2.md §4.2 règle 4) : la partie doit être traitée comme annulée.
  cancelled: boolean;
}

export function truncateToLastCompleteRound(playersAnswers: RawAnswer[][]): TruncateResult {
  // Un joueur totalement absent de la partie (aucune réponse nulle part) n'entre jamais en
  // jeu au sens de cette vérification : il ne peut pas, à lui seul, invalider une manche à
  // laquelle il n'a jamais participé (payload dégénéré, jamais produit par gameStore.svelte.ts
  // en pratique — tous les joueurs répondent forcément à chaque round joué).
  const activePlayerIndices = playersAnswers
    .map((answers, i) => (answers.length > 0 ? i : -1))
    .filter((i) => i >= 0);

  // Personne n'a jamais répondu (pas d'arrêt en cours de manche à proprement parler, juste
  // une partie sans réponse) : rien à tronquer, laisse le calcul normal produire son 0-0.
  if (activePlayerIndices.length === 0) {
    return { players: playersAnswers, cancelled: false };
  }

  // Compte, par roundIndex, le nombre de réponses de chaque joueur ACTIF.
  const countsByRound = new Map<number, Map<number, number>>();
  activePlayerIndices.forEach((playerIndex) => {
    for (const a of playersAnswers[playerIndex]!) {
      const counts = countsByRound.get(a.roundIndex) ?? new Map<number, number>();
      counts.set(playerIndex, (counts.get(playerIndex) ?? 0) + 1);
      countsByRound.set(a.roundIndex, counts);
    }
  });

  // Un round est complet ssi tous les joueurs actifs y ont répondu, avec le même nombre de
  // réponses (le nombre exact de questions de la manche n'a pas besoin d'être connu du
  // serveur, seule l'égalité entre joueurs actifs importe).
  const completeRoundIndices = [...countsByRound.entries()]
    .filter(([, counts]) => {
      if (counts.size !== activePlayerIndices.length) return false;
      const values = [...counts.values()];
      return values.every((c) => c === values[0]);
    })
    .map(([roundIndex]) => roundIndex);

  if (completeRoundIndices.length === 0) {
    return { players: playersAnswers.map(() => []), cancelled: true };
  }

  const lastCompleteRound = Math.max(...completeRoundIndices);
  return {
    players: playersAnswers.map((answers) => answers.filter((a) => a.roundIndex <= lastCompleteRound)),
    cancelled: false,
  };
}

// Détermine le(s) vainqueur(s) d'une partie à N joueurs (GAME_DESIGN_V2.md §1.3) : le(s)
// joueur(s) au score le plus élevé gagnent. isDraw = true seulement si TOUS les joueurs
// sont à égalité (match nul général) ; une égalité de tête entre certains joueurs seulement
// (co-vainqueurs) n'est pas un match nul. Se réduit exactement au comportement v1 pour 2
// joueurs (isDraw ssi les deux scores sont égaux).
export interface WinnerResult {
  winnerIndices: number[]; // indices des joueurs au score le plus élevé (1 ou plusieurs)
  isDraw: boolean; // true ssi égalité générale (tous les joueurs à égalité)
}

export function decideWinners(scores: number[]): WinnerResult {
  const maxScore = Math.max(...scores);
  const winnerIndices = scores.reduce<number[]>((acc, s, i) => {
    if (s === maxScore) acc.push(i);
    return acc;
  }, []);
  const isDraw = winnerIndices.length === scores.length && scores.length > 1;
  return { winnerIndices, isDraw };
}
