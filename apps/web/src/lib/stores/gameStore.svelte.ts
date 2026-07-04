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
  // Seuil calibré du mode Binaire (Lot 4 v2, GAME_DESIGN_V2.md §3.5) : paramètre de
  // partie ÉPHÉMÈRE, jamais persisté, recalculé une fois en début de partie (jamais
  // réévalué manche après manche). `null` = pas de calibration (autre mode, ou
  // calibration non effectuée) -> repli sur threshold_seconds de la catégorie.
  calibratedThresholdSeconds: number | null;
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
  // Questions différenciées (Lot 3 v2, GAME_DESIGN_V2.md §5.1) : chaque joueur reçoit, à
  // chaque manche, une question distincte tirée du même pool, plutôt que la même question
  // pour tous (défaut v1). Obligatoire (toujours true) en mode 'per_player' (§2.4 : les
  // pools eux-mêmes diffèrent, donc les questions ne peuvent pas être communes) ; option
  // cochable indépendamment avec les 3 autres modes de thème.
  differentiatedQuestions: boolean;
  // Timer de réponse pass-and-play (v2.1) : secondes accordées à chaque joueur pour
  // répondre, `null` = pas de limite (désactivé au setup).
  answerTimerSeconds: number | null;
}

export interface GameState {
  config: GameConfig | null;
  players: PlayerSlot[] | null;
  // v2.1 : une manche = UNE question (plus de bloc de questionsPerRound). roundNumber sert
  // directement de roundIndex pour le scoring serveur (RawAnswer.roundIndex, domain/game.ts
  // qui ne connaît déjà pas la notion de "taille" de manche — aucun changement backend requis).
  roundNumber: number;
  chooserIndex: number;
  // Fin de partie assouplie (Lot 5 v2, GAME_DESIGN_V2.md §4.2) : dernière manche COMPLETE
  // (tous les joueurs ont répondu à LA question de cette manche), mise à jour uniquement
  // par markRoundComplete(). 0 = aucune manche complète encore (arrêt en 1ère manche ->
  // partie annulée).
  lastCompleteRoundNumber: number;
  // Question de la manche en cours, une par joueur (index aligné sur PlayerSlot[]). En
  // mode commun (défaut v1), toutes les entrées pointent vers la même Question ; en mode
  // différencié (§5.1), chaque joueur porte la sienne — cf. currentQuestion().
  questions: Question[];
}

function emptyPlayer(pseudo: string): PlayerSlot {
  return { pseudo, answers: [], score: 0, streak: 0, bestStreak: 0, calibratedThresholdSeconds: null };
}

let state = $state<GameState>({
  config: null,
  players: null,
  roundNumber: 1,
  chooserIndex: 0,
  lastCompleteRoundNumber: 0,
  questions: [],
});

export function getGameState(): GameState {
  return state;
}

export function startGame(config: GameConfig, pseudos: string[]): void {
  state.config = config;
  state.players = pseudos.map(emptyPlayer);
  state.roundNumber = 1;
  state.chooserIndex = 0;
  state.lastCompleteRoundNumber = 0;
  state.questions = [];
}

/**
 * Question de la manche en cours (v2.1 : une manche = une question). Questions communes
 * (défaut v1) : une seule question, dupliquée pour chaque joueur (toutes les entrées sont
 * identiques). Questions différenciées (§5.1) : une question distincte par joueur, index
 * aligné sur PlayerSlot[] (même ordre que GET /questions/distinct).
 */
export function setRoundQuestion(questions: Question[]): void {
  state.questions = questions;
}

// isDifferentiated() se déduit du config plutôt que d'un état runtime séparé (v1 avait deux
// structures parallèles questions/perPlayerQuestions ; v2.1 unifie sur un seul tableau
// `questions` toujours de longueur playerCount, cf. setRoundQuestion).
export function isDifferentiated(): boolean {
  return state.config?.differentiatedQuestions ?? false;
}

/**
 * Question courante pour un joueur donné : en mode commun, toutes les entrées de
 * state.questions sont la même Question (playerIndex n'a pas d'effet) ; en mode
 * différencié, chaque joueur porte la sienne à son propre index.
 */
export function currentQuestion(playerIndex = 0): Question | null {
  return state.questions[playerIndex] ?? null;
}

export function playerCount(): number {
  return state.players?.length ?? 0;
}

/**
 * Enregistre le seuil calibré d'un joueur (Lot 4 v2, GAME_DESIGN_V2.md §3.5) : calculé
 * une fois par CalibrationScreen avant la 1ère manche du mode Binaire, jamais réévalué
 * ensuite. Paramètre de partie éphémère (pas de $state persisté au-delà de gameStore).
 */
export function setCalibratedThreshold(playerIndex: number, thresholdSeconds: number): void {
  const player = state.players?.[playerIndex];
  if (!player) return;
  player.calibratedThresholdSeconds = thresholdSeconds;
}

/**
 * Seuil binaire effectif pour un joueur (GAME_DESIGN_V2.md §3.5) : le seuil calibré du
 * joueur s'il a calibré, sinon repli sur threshold_seconds de la catégorie de la
 * question en cours (comportement v1, mode Binaire sans calibration).
 */
export function effectiveThreshold(playerIndex: number, categoryThresholdSeconds: number): number {
  return state.players?.[playerIndex]?.calibratedThresholdSeconds ?? categoryThresholdSeconds;
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

/**
 * Fin de partie assouplie (Lot 5 v2, GAME_DESIGN_V2.md §4.2) : à appeler dès que la manche en
 * cours vient de se terminer PROPREMENT (tous les joueurs ont répondu à LA question de cette
 * manche — v2.1, manche = question), AVANT de décider si la partie continue ou s'arrête ici
 * (cible de points atteinte, cf. Game.svelte::handleAllAnswered) — sinon une partie qui se
 * termine pile à la fin d'une manche perdrait à tort les points de cette dernière manche au
 * moment du scoring final.
 */
export function markRoundComplete(): void {
  state.lastCompleteRoundNumber = state.roundNumber;
}

/**
 * Chooser en rotation circulaire (GAME_DESIGN_V2.md §1.3) : le joueur i choisit la
 * catégorie du joueur i+1 mod N. Se réduit à l'alternance stricte v1 pour N=2. v2.1 : appelé
 * à CHAQUE question (une manche = une question), plus seulement tous les questionsPerRound.
 */
export function advanceRound(): void {
  state.roundNumber += 1;
  const n = state.players?.length ?? 1;
  state.chooserIndex = (state.chooserIndex + 1) % n;
  state.questions = [];
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
  state.lastCompleteRoundNumber = 0;
  state.questions = [];
}

/**
 * Fin de partie assouplie (Lot 5 v2, GAME_DESIGN_V2.md §4.2) : true si l'arrêt survient
 * pendant la toute première manche, avant qu'elle soit complète -> la partie doit être
 * annulée (pas d'écran de fin classé, retour accueil avec message explicite).
 */
export function isFirstRoundIncomplete(): boolean {
  return state.lastCompleteRoundNumber === 0;
}

/**
 * Réponses d'un joueur limitées aux manches COMPLETES (Lot 5 v2, §4.2 règles 2-3) : la
 * manche en cours, si elle est entamée mais pas terminée par tout le monde, est jetée
 * entièrement pour ce joueur — y compris s'il avait déjà répondu et marqué des points sur
 * cette manche. C'est ce tableau tronqué, et lui seul, qui doit être envoyé à POST /games ;
 * le serveur retronque par sécurité mais ne devrait jamais avoir à le faire si cette
 * fonction est utilisée côté client (cf. End.svelte).
 */
export function answersUpToLastCompleteRound(player: PlayerSlot): RawAnswer[] {
  return player.answers.filter((a) => a.roundIndex <= state.lastCompleteRoundNumber);
}
