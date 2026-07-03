<script lang="ts">
  // Orchestrateur de la manche (GAME_DESIGN.md §9.2-§9.4). Machine d'état locale :
  // category-pick (chooser choisit) -> loading (tirage des questions) -> pour chaque
  // question : transition/answer par joueur (ou par estimation en duel) -> reveal -> question
  // suivante ou manche suivante. Le score affiché est provisoire (lib/domain/scoring.ts) ;
  // la vérité vient de POST /games à la fin de la partie (End.svelte).
  import { onMount } from 'svelte';
  import { t, getLang } from '../../lib/i18n';
  import { navigate } from '../../lib/router/router.svelte';
  import { getCategories, getCategoryQuestions, ApiError } from '../../lib/api/client';
  import type { Category, RawAnswer } from '../../lib/api/types';
  import { toSeconds, type Unit } from '../../lib/domain/units';
  import { scoreBinaire, scoreOrdreDeGrandeur, scoreDuel, type RoundOutcome } from '../../lib/domain/scoring';
  import {
    getGameState,
    setRoundQuestions,
    currentQuestion,
    recordAnswer,
    advanceQuestion,
    advanceRound,
    isEndConditionMet,
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
    | { name: 'answer-transition'; playerIndex: 0 | 1 }
    | { name: 'answer'; playerIndex: 0 | 1 }
    | { name: 'reveal' };

  const game = getGameState();

  let step = $state<Step>({ name: 'loading-questions' });
  let allCategories = $state<Category[]>([]);
  let currentCategory = $state<Category>(game.config!.category);

  // Réponses brutes de la question en cours, en attente de révélation.
  let pendingAnswerA = $state<RawAnswer | null>(null);
  let pendingAnswerB = $state<RawAnswer | null>(null);
  let pendingOutcomeA = $state<RoundOutcome | null>(null);
  let pendingOutcomeB = $state<RoundOutcome | null>(null);

  // Horodatage de début de réponse (temps de réaction, cf RawAnswer.responseTimeMs) ;
  // pas de $state, ce n'est pas affiché, seulement lu au moment de construire la réponse.
  let answerStartedAt = 0;

  onMount(async () => {
    // Manche 1 : la catégorie est déjà choisie via Setup, pas de category-pick.
    await loadRoundQuestions(currentCategory);
  });

  async function loadRoundQuestions(category: Category): Promise<void> {
    step = { name: 'loading-questions' };
    try {
      const questions = await getCategoryQuestions(category.slug, game.config!.questionsPerRound);
      setRoundQuestions(questions);
      beginQuestion();
    } catch (err) {
      const message = err instanceof ApiError ? t(`errors.${err.code}`) : t('errors.unknown_error');
      step = { name: 'load-error', message };
    }
  }

  function chooserPseudo(): string {
    return game.players![game.chooserIndex].pseudo;
  }

  function answererPseudo(): string {
    const answererIndex = game.chooserIndex === 0 ? 1 : 0;
    return game.players![answererIndex].pseudo;
  }

  function beginQuestion(): void {
    pendingAnswerA = null;
    pendingAnswerB = null;
    pendingOutcomeA = null;
    pendingOutcomeB = null;
    step = { name: 'answer-transition', playerIndex: 0 };
  }

  function handleTransitionReady(playerIndex: 0 | 1): void {
    answerStartedAt = Date.now();
    step = { name: 'answer', playerIndex };
  }

  function buildRawAnswer(extra: Partial<RawAnswer>): RawAnswer {
    const q = currentQuestion()!;
    return {
      mode: game.config!.mode,
      roundIndex: game.roundNumber,
      responseTimeMs: Date.now() - answerStartedAt,
      durationSeconds: q.duration_seconds,
      ...extra,
    };
  }

  function handleBinaireAnswer(playerIndex: 0 | 1, answer: 'yes' | 'no'): void {
    const q = currentQuestion()!;
    const raw = buildRawAnswer({ binaryAnswer: answer, thresholdSeconds: currentCategory.threshold_seconds });
    const outcome = scoreBinaire(answer, q.duration_seconds, currentCategory.threshold_seconds);
    commitAnswer(playerIndex, raw, outcome);
  }

  function handleOrdreAnswer(playerIndex: 0 | 1, unit: Unit): void {
    const q = currentQuestion()!;
    const raw = buildRawAnswer({ chosenUnit: unit });
    const outcome = scoreOrdreDeGrandeur(unit, q.duration_seconds);
    commitAnswer(playerIndex, raw, outcome);
  }

  function handleDuelAnswer(playerIndex: 0 | 1, value: number, unit: Unit): void {
    const raw = buildRawAnswer({ estValue: value, estUnit: unit });

    if (playerIndex === 0) {
      pendingAnswerA = raw;
      step = { name: 'answer-transition', playerIndex: 1 };
      return;
    }

    // Deuxième joueur : les deux estimations sont connues, on peut scorer le duel.
    const q = currentQuestion()!;
    const secondsA = toSeconds(pendingAnswerA!.estValue!, pendingAnswerA!.estUnit!);
    const secondsB = toSeconds(value, unit);
    const outcomeA = scoreDuel(secondsA, secondsB, q.duration_seconds);
    const outcomeB = scoreDuel(secondsB, secondsA, q.duration_seconds);

    const finalAnswerA: RawAnswer = { ...pendingAnswerA!, opponentEstValue: value, opponentEstUnit: unit };
    const finalAnswerB: RawAnswer = { ...raw, opponentEstValue: pendingAnswerA!.estValue, opponentEstUnit: pendingAnswerA!.estUnit };

    pendingAnswerA = finalAnswerA;
    pendingAnswerB = finalAnswerB;
    pendingOutcomeA = outcomeA;
    pendingOutcomeB = outcomeB;
    recordAnswer(0, finalAnswerA, outcomeA.points, outcomeA.isGoodAnswer);
    recordAnswer(1, finalAnswerB, outcomeB.points, outcomeB.isGoodAnswer);
    step = { name: 'reveal' };
  }

  function commitAnswer(playerIndex: 0 | 1, raw: RawAnswer, outcome: RoundOutcome): void {
    recordAnswer(playerIndex, raw, outcome.points, outcome.isGoodAnswer);
    if (playerIndex === 0) {
      pendingAnswerA = raw;
      pendingOutcomeA = outcome;
      step = { name: 'answer-transition', playerIndex: 1 };
    } else {
      pendingAnswerB = raw;
      pendingOutcomeB = outcome;
      step = { name: 'reveal' };
    }
  }

  function handleDuelAnswerFor(playerIndex: 0 | 1): (value: number, unit: Unit) => void {
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
    if (allCategories.length === 0) {
      // On a la catégorie initiale (Setup) mais il faut la liste complète pour le choix
      // croisé de la manche 2+ -> chargée une seule fois, en différé.
      allCategories = await getCategories();
    }
    step = { name: 'category-transition' };
  }

  function handleCategoryTransitionReady(): void {
    step = { name: 'category-pick' };
  }

  async function handleCategoryConfirm(category: Category): Promise<void> {
    currentCategory = category;
    await loadRoundQuestions(category);
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
      <Card>
        <div class="game__question-head">
          <span class="game__tag">{t(`modes.${game.config!.mode}`)}</span>
          <span class="game__tag">{getLang() === 'en' ? currentCategory.name_en : currentCategory.name_fr}</span>
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
    {:else if step.name === 'reveal' && question && pendingOutcomeA && pendingOutcomeB}
      <RevealPanel
        questionId={question.id}
        lang={getLang()}
        durationSeconds={question.duration_seconds}
        players={[
          { pseudo: game.players![0].pseudo, isGoodAnswer: pendingOutcomeA.isGoodAnswer, points: pendingOutcomeA.points },
          { pseudo: game.players![1].pseudo, isGoodAnswer: pendingOutcomeB.isGoodAnswer, points: pendingOutcomeB.points },
        ]}
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
