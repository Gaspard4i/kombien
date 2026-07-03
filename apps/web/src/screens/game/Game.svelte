<script lang="ts">
  // Orchestrateur de la manche (GAME_DESIGN.md §9.2-§9.4, GAME_DESIGN_V2.md §1.3 pour N
  // joueurs). Machine d'état locale : category-pick (chooser choisit) -> loading (tirage des
  // questions) -> pour chaque question : transition/answer EN BOUCLE pour chacun des N joueurs
  // (ou par estimation en duel) -> reveal -> question suivante ou manche suivante. Le score
  // affiché est provisoire (lib/domain/scoring.ts) ; la vérité vient de POST /games à la fin
  // de la partie (End.svelte).
  import { onMount } from 'svelte';
  import { t, getLang } from '../../lib/i18n';
  import { navigate } from '../../lib/router/router.svelte';
  import { getCategories, getCategoryQuestions, getQuestionsForCategories, ApiError } from '../../lib/api/client';
  import type { Category, Question, RawAnswer } from '../../lib/api/types';
  import { toSeconds, type Unit } from '../../lib/domain/units';
  import { scoreBinaire, scoreOrdreDeGrandeur, scoreDuelRanked, type RoundOutcome } from '../../lib/domain/scoring';
  import {
    getGameState,
    setRoundQuestions,
    currentQuestion,
    recordAnswer,
    advanceQuestion,
    advanceRound,
    isEndConditionMet,
    activeCategorySlugs,
  } from '../../lib/stores/gameStore.svelte';
  import AppShell from '../../lib/components/AppShell.svelte';
  import Card from '../../lib/components/Card.svelte';
  import Skeleton from '../../lib/components/Skeleton.svelte';
  import ErrorMessage from '../../lib/components/ErrorMessage.svelte';
  import Button from '../../lib/components/Button.svelte';
  import TransitionScreen from './TransitionScreen.svelte';
  import ScoreBar from './ScoreBar.svelte';
  import CategoryPick from './CategoryPick.svelte';
  import BinaireAnswer from './BinaireAnswer.svelte';
  import OrdreDeGrandeurAnswer from './OrdreDeGrandeurAnswer.svelte';
  import DuelAnswer from './DuelAnswer.svelte';
  import RevealPanel from './RevealPanel.svelte';

  type Step =
    | { name: 'category-transition' }
    | { name: 'category-pick' }
    | { name: 'loading-questions' }
    | { name: 'load-error'; message: string }
    | { name: 'answer-transition'; playerIndex: number }
    | { name: 'answer'; playerIndex: number }
    | { name: 'reveal' };

  const game = getGameState();

  // Slugs actifs déterminés par le mode de sélection de thème (GAME_DESIGN_V2.md §2.6) :
  // non-null pour global/vote/multi/per_player (pool fixe, pas de CategoryPick manche
  // après manche) ; null pour rotation (croisement v1, catégorie choisie à chaque manche).
  const fixedActiveSlugs = activeCategorySlugs(game.config!.themeSelection);

  let step = $state<Step>({ name: 'loading-questions' });
  let allCategories = $state<Category[]>([]);
  let currentCategory = $state<Category>(game.config!.category);

  // Réponses brutes + résultats provisoires de la question en cours, un par joueur, en
  // attente de révélation. Index aligné sur game.players.
  let pendingAnswers = $state<(RawAnswer | null)[]>([]);
  let pendingOutcomes = $state<(RoundOutcome | null)[]>([]);

  // Horodatage de début de réponse (temps de réaction, cf RawAnswer.responseTimeMs) ;
  // pas de $state, ce n'est pas affiché, seulement lu au moment de construire la réponse.
  let answerStartedAt = 0;

  onMount(async () => {
    // Pool de catégories connu à l'avance pour tout mode hors rotation (résolution du
    // tag/seuil par question via category_id, cf categoryForQuestion ci-dessous).
    if (fixedActiveSlugs) {
      allCategories = await getCategories();
    }
    // Manche 1 : la catégorie (ou le pool) est déjà choisie via Setup, pas de category-pick.
    await loadRoundQuestions();
  });

  // Résout la catégorie réelle d'une question par son category_id (nécessaire en mode
  // multi/per_player où plusieurs catégories sont actives simultanément dans une même
  // manche) ; retombe sur currentCategory si non trouvée (mode rotation/global/vote,
  // une seule catégorie active, toujours currentCategory).
  function categoryForQuestion(question: Question): Category {
    return allCategories.find((c) => c.id === question.category_id) ?? currentCategory;
  }

  // Tirage de la manche (GAME_DESIGN_V2.md §2.6) : catégorie unique (rotation/global/
  // vote, ancien endpoint) ou union de catégories (multi/per_player, nouvel endpoint).
  async function loadRoundQuestions(): Promise<void> {
    step = { name: 'loading-questions' };
    try {
      const questions = fixedActiveSlugs
        ? await getQuestionsForCategories(fixedActiveSlugs, game.config!.questionsPerRound)
        : await getCategoryQuestions(currentCategory.slug, game.config!.questionsPerRound);
      setRoundQuestions(questions);
      beginQuestion();
    } catch (err) {
      const message = err instanceof ApiError ? t(`errors.${err.code}`) : t('errors.unknown_error');
      step = { name: 'load-error', message };
    }
  }

  function playerCount(): number {
    return game.players?.length ?? 0;
  }

  // Rotation circulaire (GAME_DESIGN_V2.md §1.3) : le chooser choisit pour le joueur suivant.
  function chooserPseudo(): string {
    return game.players![game.chooserIndex].pseudo;
  }

  function answererPseudo(): string {
    const answererIndex = (game.chooserIndex + 1) % playerCount();
    return game.players![answererIndex].pseudo;
  }

  function beginQuestion(): void {
    pendingAnswers = game.players!.map(() => null);
    pendingOutcomes = game.players!.map(() => null);
    step = { name: 'answer-transition', playerIndex: 0 };
  }

  function handleTransitionReady(playerIndex: number): void {
    answerStartedAt = Date.now();
    step = { name: 'answer', playerIndex };
  }

  function buildRawAnswer(extra: Partial<RawAnswer>): RawAnswer {
    const q = currentQuestion()!;
    return {
      mode: game.config!.mode,
      questionId: q.id,
      roundIndex: game.roundNumber,
      responseTimeMs: Date.now() - answerStartedAt,
      durationSeconds: q.duration_seconds,
      ...extra,
    };
  }

  function goToNextPlayerOrReveal(playerIndex: number): void {
    const nextIndex = playerIndex + 1;
    if (nextIndex < playerCount()) {
      step = { name: 'answer-transition', playerIndex: nextIndex };
    } else {
      step = { name: 'reveal' };
    }
  }

  function handleBinaireAnswer(playerIndex: number, answer: 'yes' | 'no'): void {
    const q = currentQuestion()!;
    // categoryForQuestion : en mode multi/per_player, chaque question de la manche peut
    // venir d'une catégorie différente, donc d'un seuil différent (GAME_DESIGN_V2.md §2.3-2.4).
    const threshold = categoryForQuestion(q).threshold_seconds;
    const raw = buildRawAnswer({ binaryAnswer: answer, thresholdSeconds: threshold });
    const outcome = scoreBinaire(answer, q.duration_seconds, threshold);
    commitAnswer(playerIndex, raw, outcome);
  }

  function handleOrdreAnswer(playerIndex: number, unit: Unit): void {
    const q = currentQuestion()!;
    const raw = buildRawAnswer({ chosenUnit: unit });
    const outcome = scoreOrdreDeGrandeur(unit, q.duration_seconds);
    commitAnswer(playerIndex, raw, outcome);
  }

  // Duel : chaque joueur saisit son estimation ; on ne connaît le classement qu'une fois
  // que TOUS ont répondu (GAME_DESIGN_V2.md §1.3 : classement par rang d'écart à N joueurs).
  function handleDuelAnswer(playerIndex: number, value: number, unit: Unit): void {
    const raw = buildRawAnswer({ estValue: value, estUnit: unit });
    pendingAnswers[playerIndex] = raw;

    const nextIndex = playerIndex + 1;
    if (nextIndex < playerCount()) {
      step = { name: 'answer-transition', playerIndex: nextIndex };
      return;
    }

    // Dernier joueur : toutes les estimations sont connues, on calcule le classement.
    const q = currentQuestion()!;
    const estimateSeconds = pendingAnswers.map((a) => toSeconds(a!.estValue!, a!.estUnit!));
    const outcomes = scoreDuelRanked(estimateSeconds, q.duration_seconds);

    // opponentEstValue/opponentEstUnit (contrat v1, un seul adversaire) n'a de sens qu'à
    // 2 joueurs ; au-delà, le serveur recalcule le classement à N joueurs par questionId.
    if (playerCount() === 2) {
      pendingAnswers = pendingAnswers.map((a, i) => {
        const opponent = pendingAnswers[1 - i]!;
        return { ...a!, opponentEstValue: opponent.estValue, opponentEstUnit: opponent.estUnit };
      });
    }
    pendingOutcomes = outcomes;
    pendingAnswers.forEach((a, i) => recordAnswer(i, a!, outcomes[i]!.points, outcomes[i]!.isGoodAnswer));
    step = { name: 'reveal' };
  }

  function commitAnswer(playerIndex: number, raw: RawAnswer, outcome: RoundOutcome): void {
    recordAnswer(playerIndex, raw, outcome.points, outcome.isGoodAnswer);
    pendingAnswers[playerIndex] = raw;
    pendingOutcomes[playerIndex] = outcome;
    goToNextPlayerOrReveal(playerIndex);
  }

  function handleDuelAnswerFor(playerIndex: number): (value: number, unit: Unit) => void {
    return (value, unit) => handleDuelAnswer(playerIndex, value, unit);
  }

  async function handleNext(): Promise<void> {
    const hasMoreQuestions = advanceQuestion();
    if (hasMoreQuestions) {
      beginQuestion();
      return;
    }

    // Fin de manche (GAME_DESIGN.md §9.4) : en mode "points", on vérifie la cible ici.
    // En mode "manual", pas d'arrêt automatique : le joueur clique "Terminer la partie".
    if (game.config!.endCondition === 'points' && isEndConditionMet()) {
      navigate({ name: 'end' });
      return;
    }

    advanceRound();

    // Mode rotation uniquement : la catégorie est choisie manche après manche via
    // CategoryPick (GAME_DESIGN_V2.md §2.5). Les autres modes ont un pool fixe résolu
    // au setup (fixedActiveSlugs) -> pas de category-pick, on retire directement.
    if (!fixedActiveSlugs) {
      if (allCategories.length === 0) {
        // On a la catégorie initiale (Setup) mais il faut la liste complète pour le choix
        // croisé de la manche 2+ -> chargée une seule fois, en différé.
        allCategories = await getCategories();
      }
      step = { name: 'category-transition' };
      return;
    }

    await loadRoundQuestions();
  }

  function handleCategoryTransitionReady(): void {
    step = { name: 'category-pick' };
  }

  async function handleCategoryConfirm(category: Category): Promise<void> {
    currentCategory = category;
    await loadRoundQuestions();
  }

  function handleQuitGame(): void {
    if (window.confirm(t('common.quit_game_confirm'))) {
      navigate({ name: 'home' });
    }
  }

  function handleStopManual(): void {
    navigate({ name: 'end' });
  }

  const question = $derived(currentQuestion());
  const isLastQuestionOfRound = $derived(game.questionIndex + 1 >= game.questions.length);
  const revealPlayers = $derived(
    game.players && pendingOutcomes.every((o) => o !== null)
      ? game.players.map((p, i) => ({
          pseudo: p.pseudo,
          isGoodAnswer: pendingOutcomes[i]!.isGoodAnswer,
          points: pendingOutcomes[i]!.points,
        }))
      : null,
  );
</script>

<AppShell>
  {#if step.name === 'category-transition'}
    <TransitionScreen
      pseudo={chooserPseudo()}
      role="choose_category"
      onready={handleCategoryTransitionReady}
    />
  {:else if step.name === 'category-pick'}
    <CategoryPick
      chooserPseudo={chooserPseudo()}
      answererPseudo={answererPseudo()}
      categories={allCategories}
      onconfirm={handleCategoryConfirm}
    />
  {:else}
    <header class="game__header">
      <span class="game__round">{t('round.label', { number: game.roundNumber })}</span>
      <div class="game__header-actions">
        {#if game.config!.endCondition === 'manual' && step.name === 'reveal'}
          <Button variant="secondary" onclick={handleStopManual}>{t('common.end_game')}</Button>
        {/if}
        <Button variant="ghost" onclick={handleQuitGame}>{t('nav.back')}</Button>
      </div>
    </header>

    {#if game.players}
      <ScoreBar
        players={game.players}
        activeIndex={step.name === 'answer' || step.name === 'answer-transition' ? step.playerIndex : null}
      />
    {/if}

    {#if step.name === 'loading-questions'}
      <Skeleton rows={4} />
    {:else if step.name === 'load-error'}
      <ErrorMessage message={step.message} />
    {:else if step.name === 'answer-transition'}
      {@const transitionPlayerIndex = step.playerIndex}
      <TransitionScreen
        pseudo={game.players![transitionPlayerIndex].pseudo}
        role={game.config!.mode === 'duel' ? 'estimate' : 'answer'}
        onready={() => handleTransitionReady(transitionPlayerIndex)}
      />
    {:else if step.name === 'answer' && question}
      {@const answerPlayerIndex = step.playerIndex}
      {@const questionCategory = categoryForQuestion(question)}
      <Card>
        <div class="game__question-head">
          <span class="game__tag">{t(`modes.${game.config!.mode}`)}</span>
          <span class="game__tag">{getLang() === 'en' ? questionCategory.name_en : questionCategory.name_fr}</span>
        </div>
        <p class="game__question-text">
          {getLang() === 'en' ? question.text_en : question.text_fr}
        </p>
        <p class="game__prompt">
          {t(game.config!.mode === 'binaire' ? 'question.binaire_prompt' : game.config!.mode === 'ordre_de_grandeur' ? 'question.ordre_prompt' : 'question.duel_prompt')}
        </p>
      </Card>

      {#if game.config!.mode === 'binaire'}
        <BinaireAnswer onanswer={(answer) => handleBinaireAnswer(answerPlayerIndex, answer)} />
      {:else if game.config!.mode === 'ordre_de_grandeur'}
        <OrdreDeGrandeurAnswer onanswer={(unit) => handleOrdreAnswer(answerPlayerIndex, unit)} />
      {:else}
        <DuelAnswer onanswer={handleDuelAnswerFor(answerPlayerIndex)} />
      {/if}
    {:else if step.name === 'reveal' && question && revealPlayers}
      <RevealPanel
        questionId={question.id}
        lang={getLang()}
        durationSeconds={question.duration_seconds}
        players={revealPlayers}
        {isLastQuestionOfRound}
        onnext={handleNext}
      />
    {/if}
  {/if}
</AppShell>

<style>
  .game__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .game__round {
    font-family: var(--font-mono);
    font-size: var(--fs-label);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-mid);
  }

  .game__header-actions {
    display: flex;
    gap: var(--gap-tight);
  }

  .game__question-head {
    display: flex;
    gap: var(--gap-tight);
    margin-bottom: var(--gap);
  }

  .game__tag {
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: var(--fs-micro);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--amber-ink);
    background: var(--amber-dim);
    padding: 0.25rem 0.5rem;
    border-radius: var(--radius-pill);
  }

  .game__question-text {
    font-family: var(--font-display);
    font-size: var(--fs-lead);
    font-weight: 500;
    color: var(--ink-hi);
    margin-bottom: var(--gap);
  }

  .game__prompt {
    font-family: var(--font-display);
    font-size: var(--fs-body);
    color: var(--ink-mid);
  }
</style>
