import type { GameMode } from '../domain/scoring';
import { nextStreak, streakMultiplier } from '../domain/scoring';
import type { Category, Question, RawAnswer } from '../api/types';

export type EndCondition = 'points' | 'manual';

// Modes de sélection de thème (GAME_DESIGN_V2.md §2) : le croisement v1 (rotation)
// reste le défaut, les 4 autres sont des options choisies au setup.
export type ThemeSelectionMode = 'rotation' | 'global' | 'vote' | 'multi' | 'per_player';

export interface ThemeSelection {
  mode: ThemeSelectionMode;
  // 'global' et 'vote' se résolvent tous deux, avant la partie, en UNE catégorie
  // fixe pour toutes les manches (GAME_DESIGN_V2.md §2.1-2.2) : le vote détermine
  // simplement comment cette catégorie unique est choisie, l'état runtime est identique.
  fixedCategory?: Category;
  // 'multi' : union de catégories active pour toute la partie (GAME_DESIGN_V2.md §2.3).
  multiCategories?: Category[];
  // 'per_player' : catégories propres à chaque joueur, index aligné sur PlayerSlot[]
  // (GAME_DESIGN_V2.md §2.4).
  perPlayerCategories?: Category[][];
}

export interface PlayerSlot {
  pseudo: string;
  answers: RawAnswer[];
  score: number;
  streak: number;
  bestStreak: number;
}

export interface GameConfig {
  mode: GameMode;
  // Catégorie initiale (manche 1) : n'a de sens qu'en mode rotation (le croisement
  // v1 choisit la catégorie de la manche 1 au setup, cf. Setup.svelte). Les autres
  // modes tirent leur pool de `themeSelection`, jamais de ce champ.
  category: Category;
  themeSelection: ThemeSelection;
  endCondition: EndCondition;
  targetScore: number;
  questionsPerRound: number;
  // Questions différenciées (Lot 3 v2, GAME_DESIGN_V2.md §5.1) : chaque joueur reçoit, à
  // chaque tour de la manche, une question distincte tirée du même pool, plutôt que la
  // même question pour tous (défaut v1). Obligatoire (toujours true) en mode 'per_player'
  // (§2.4 : les pools eux-mêmes diffèrent, donc les questions ne peuvent pas être
  // communes) ; option cochable indépendamment avec les 3 autres modes de thème.
  differentiatedQuestions: boolean;
}

export interface GameState {
  config: GameConfig | null;
  players: PlayerSlot[] | null;
  roundNumber: number;
  chooserIndex: number;
  // Questions communes (défaut v1) : un seul jeu de questions partagé par tous les joueurs.
  questions: Question[];
  // Questions différenciées (§5.1) : un jeu de questions PAR joueur, index aligné sur
  // PlayerSlot[]. `questionIndex` reste commun (même tour de manche pour tout le monde),
  // seule la question réellement affichée diffère — cf. currentQuestionFor().
  perPlayerQuestions: Question[][] | null;
  questionIndex: number;
}

function emptyPlayer(pseudo: string): PlayerSlot {
  return { pseudo, answers: [], score: 0, streak: 0, bestStreak: 0 };
}

let state = $state<GameState>({
  config: null,
  players: null,
  roundNumber: 1,
  chooserIndex: 0,
  questions: [],
  perPlayerQuestions: null,
  questionIndex: 0,
});

export function getGameState(): GameState {
  return state;
}

export function startGame(config: GameConfig, pseudos: string[]): void {
  state.config = config;
  state.players = pseudos.map(emptyPlayer);
  state.roundNumber = 1;
  state.chooserIndex = 0;
  state.questions = [];
  state.perPlayerQuestions = null;
  state.questionIndex = 0;
}

/** Questions communes (défaut v1) : un seul jeu de questions partagé par tous les joueurs. */
export function setRoundQuestions(questions: Question[]): void {
  state.questions = questions;
  state.perPlayerQuestions = null;
  state.questionIndex = 0;
}

/**
 * Questions différenciées (Lot 3, GAME_DESIGN_V2.md §5.1) : un jeu de questions PAR joueur,
 * index aligné sur PlayerSlot[] (même ordre que la réponse de GET /questions/distinct).
 */
export function setPerPlayerRoundQuestions(perPlayerQuestions: Question[][]): void {
  state.questions = [];
  state.perPlayerQuestions = perPlayerQuestions;
  state.questionIndex = 0;
}

export function isDifferentiated(): boolean {
  return state.perPlayerQuestions !== null;
}

/**
 * Question courante pour un joueur donné : en mode commun, la même pour tout le monde
 * (playerIndex ignoré) ; en mode différencié, celle de SON tableau à l'index de tour
 * courant (§5.1 : questionIndex reste commun, seule la question diffère par joueur).
 */
export function currentQuestion(playerIndex = 0): Question | null {
  if (state.perPlayerQuestions) {
    return state.perPlayerQuestions[playerIndex]?.[state.questionIndex] ?? null;
  }
  return state.questions[state.questionIndex] ?? null;
}

/** Nombre de questions de la manche en cours, quel que soit le mode (commun/différencié). */
export function roundQuestionCount(): number {
  if (state.perPlayerQuestions) {
    return state.perPlayerQuestions[0]?.length ?? 0;
  }
  return state.questions.length;
}

export function playerCount(): number {
  return state.players?.length ?? 0;
}

/** Applique le résultat d'une réponse (points de base déjà calculés) à un joueur. */
export function recordAnswer(playerIndex: number, answer: RawAnswer, basePoints: number, isGoodAnswer: boolean): void {
  const player = state.players?.[playerIndex];
  if (!player) return;

  player.answers.push(answer);
  const newStreak = nextStreak(player.streak, isGoodAnswer);
  const multiplier = streakMultiplier(newStreak);
  player.score += basePoints * multiplier;
  player.streak = newStreak;
  player.bestStreak = Math.max(player.bestStreak, newStreak);
}

export function advanceQuestion(): boolean {
  if (state.questionIndex + 1 < roundQuestionCount()) {
    state.questionIndex += 1;
    return true;
  }
  return false;
}

/**
 * Chooser en rotation circulaire (GAME_DESIGN_V2.md §1.3) : le joueur i choisit la
 * catégorie du joueur i+1 mod N. Se réduit à l'alternance stricte v1 pour N=2.
 */
export function advanceRound(): void {
  state.roundNumber += 1;
  const n = state.players?.length ?? 1;
  state.chooserIndex = (state.chooserIndex + 1) % n;
  state.questions = [];
  state.perPlayerQuestions = null;
  state.questionIndex = 0;
}

/**
 * Slugs de catégories formant le pool actif de tirage pour la manche en cours, selon
 * le mode de sélection de thème (GAME_DESIGN_V2.md §2.6). `null` signifie "pas de pool
 * pré-déterminé" : c'est le cas du mode rotation, où la catégorie est choisie manche
 * après manche via CategoryPick (Game.svelte gère ce cas séparément).
 *
 * Le pool renvoyé est l'UNION des thèmes actifs (mode 'multi' et 'per_player' tirent tous
 * deux dans une union de catégories, cf. GAME_DESIGN_V2.md §2.3-2.4) : ce que fait ce pool
 * une fois résolu (questions communes ou différenciées par joueur, Lot 3 §5.1) est décidé
 * séparément par `GameConfig.differentiatedQuestions` (cf. Game.svelte, qui choisit entre
 * getQuestionsForCategories et getDistinctQuestionsForPlayers selon ce flag).
 */
export function activeCategorySlugs(selection: ThemeSelection): string[] | null {
  switch (selection.mode) {
    case 'rotation':
      return null;
    case 'global':
    case 'vote':
      return selection.fixedCategory ? [selection.fixedCategory.slug] : null;
    case 'multi':
      return selection.multiCategories?.map((c) => c.slug) ?? null;
    case 'per_player':
      return selection.perPlayerCategories?.flat().map((c) => c.slug) ?? null;
  }
}

/**
 * Les questions différenciées sont OBLIGATOIRES en mode 'per_player' (GAME_DESIGN_V2.md
 * §2.4 et §5.1 : les pools eux-mêmes diffèrent par joueur, "questions communes" n'a pas de
 * sens par construction). Avec les 3 autres modes de thème, c'est une option cochable au
 * setup (GameConfig.differentiatedQuestions).
 */
export function isDifferentiationForced(selection: ThemeSelection): boolean {
  return selection.mode === 'per_player';
}

export function isEndConditionMet(): boolean {
  if (!state.config || !state.players) return false;
  if (state.config.endCondition !== 'points') return false;
  return state.players.some((p) => p.score >= state.config!.targetScore);
}

export function resetGame(): void {
  state.config = null;
  state.players = null;
  state.roundNumber = 1;
  state.chooserIndex = 0;
  state.questions = [];
  state.perPlayerQuestions = null;
  state.questionIndex = 0;
}
