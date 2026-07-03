<script lang="ts">
  // Calibration du mode Binaire (Lot 4 v2, GAME_DESIGN_V2.md §3) : avant la 1ère manche,
  // chaque joueur répond "longtemps"/"pas longtemps" à 5 questions d'un pool dédié, hors
  // catégories de jeu, SANS connaître la vraie durée (comme en jeu normal). Aucun scoring,
  // aucun streak — pur étalonnage. Le seuil individuel (deriveThreshold, moyenne géométrique
  // des bornes observées) est calculé côté client dès que le joueur a fini ses 5 réponses,
  // puis stocké dans gameStore (calibratedThresholdSeconds) : jamais transmis au serveur
  // avant le scoring de fin de partie (POST /games).
  import { onMount } from 'svelte';
  import { t, getLang } from '../../lib/i18n';
  import { getCalibrationQuestions, ApiError } from '../../lib/api/client';
  import type { CalibrationQuestion } from '../../lib/api/types';
  import { deriveThreshold, type CalibrationAnswer } from '../../lib/domain/calibration';
  import { setCalibratedThreshold } from '../../lib/stores/gameStore.svelte';
  import Card from '../../lib/components/Card.svelte';
  import Skeleton from '../../lib/components/Skeleton.svelte';
  import ErrorMessage from '../../lib/components/ErrorMessage.svelte';
  import Icon from '../../lib/components/Icon.svelte';
  import TransitionScreen from './TransitionScreen.svelte';
  import BinaireAnswer from './BinaireAnswer.svelte';

  interface Props {
    pseudos: string[];
    categoryThresholdSeconds: number;
    oncomplete: () => void;
  }

  const { pseudos, categoryThresholdSeconds, oncomplete }: Props = $props();

  type Step =
    | { name: 'loading' }
    | { name: 'load-error'; message: string }
    | { name: 'player-transition'; playerIndex: number }
    | { name: 'question'; playerIndex: number; questionIndex: number };

  let step = $state<Step>({ name: 'loading' });
  let questions = $state<CalibrationQuestion[]>([]);
  // Réponses en cours du joueur actif (réinitialisées à chaque changement de joueur).
  let currentAnswers: CalibrationAnswer[] = [];

  onMount(async () => {
    try {
      questions = await getCalibrationQuestions();
      step = { name: 'player-transition', playerIndex: 0 };
    } catch (err) {
      const message = err instanceof ApiError ? t(`errors.${err.code}`) : t('errors.unknown_error');
      step = { name: 'load-error', message };
    }
  });

  function handleTransitionReady(playerIndex: number): void {
    currentAnswers = [];
    step = { name: 'question', playerIndex, questionIndex: 0 };
  }

  function handleAnswer(playerIndex: number, questionIndex: number, answer: 'yes' | 'no'): void {
    const question = questions[questionIndex]!;
    currentAnswers.push({ durationSeconds: question.duration_seconds, answer });

    const nextQuestionIndex = questionIndex + 1;
    if (nextQuestionIndex < questions.length) {
      step = { name: 'question', playerIndex, questionIndex: nextQuestionIndex };
      return;
    }

    // Dernière question de ce joueur : dérive et enregistre son seuil individuel.
    const threshold = deriveThreshold(currentAnswers, categoryThresholdSeconds);
    setCalibratedThreshold(playerIndex, threshold);

    const nextPlayerIndex = playerIndex + 1;
    if (nextPlayerIndex < pseudos.length) {
      step = { name: 'player-transition', playerIndex: nextPlayerIndex };
      return;
    }

    oncomplete();
  }
</script>

{#if step.name === 'loading'}
  <Skeleton rows={4} />
{:else if step.name === 'load-error'}
  <ErrorMessage message={step.message} />
{:else if step.name === 'player-transition'}
  {@const playerIndex = step.playerIndex}
  <TransitionScreen
    pseudo={pseudos[playerIndex]!}
    role="answer"
    onready={() => handleTransitionReady(playerIndex)}
  />
{:else if step.name === 'question'}
  {@const { playerIndex, questionIndex } = step}
  {@const question = questions[questionIndex]!}
  <div class="calibration">
    <div class="calibration__head">
      <Icon name="clock" size="md" />
      <span class="calibration__label">{t('calibration.label')}</span>
      <span class="calibration__progress">{t('calibration.progress', { current: questionIndex + 1, total: questions.length })}</span>
    </div>

    <Card>
      <p class="calibration__text">{getLang() === 'en' ? question.text_en : question.text_fr}</p>
      <p class="calibration__prompt">{t('question.binaire_prompt')}</p>
    </Card>

    <BinaireAnswer onanswer={(answer) => handleAnswer(playerIndex, questionIndex, answer)} />
  </div>
{/if}

<style>
  .calibration {
    display: flex;
    flex-direction: column;
    gap: var(--gap);
  }

  .calibration__head {
    display: flex;
    align-items: center;
    gap: var(--gap-tight);
    color: var(--amber);
  }

  .calibration__label {
    font-family: var(--font-mono);
    font-size: var(--fs-label);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    flex: 1;
  }

  .calibration__progress {
    font-family: var(--font-mono);
    font-size: var(--fs-label);
    color: var(--ink-mid);
  }

  .calibration__text {
    font-family: var(--font-display);
    font-size: var(--fs-lead);
    font-weight: 500;
    color: var(--ink-hi);
    margin-bottom: var(--gap);
  }

  .calibration__prompt {
    font-family: var(--font-display);
    font-size: var(--fs-body);
    color: var(--ink-mid);
  }
</style>
