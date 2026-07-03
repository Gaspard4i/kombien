<script lang="ts">
  // Révélation de la durée réelle (DESIGN_SYSTEM.md §5.3) : LE moment fort. Affiche le
  // split-flap plein écran puis, sous chaque joueur, si sa réponse était correcte et les
  // points provisoires gagnés (le score définitif vient de POST /games, cf gameStore).
  import { t } from '../../lib/i18n';
  import { formatSplitFlapDuration } from '../../lib/domain/formatDuration';
  import { reportQuestion } from '../../lib/api/client';
  import SplitFlap from '../../lib/components/SplitFlap.svelte';
  import Button from '../../lib/components/Button.svelte';
  import Icon from '../../lib/components/Icon.svelte';

  interface PlayerReveal {
    pseudo: string;
    isGoodAnswer: boolean;
    points: number;
    // Questions différenciées (Lot 3, GAME_DESIGN_V2.md §5) : présent seulement quand la
    // durée de CE joueur diffère de `durationSeconds` (sa propre question). Absent en mode
    // commun -> un seul split-flap partagé reste LE moment fort (comportement v1 inchangé).
    ownDurationSeconds?: number;
  }

  interface Props {
    questionId: number;
    lang: 'fr' | 'en';
    durationSeconds: number;
    players: PlayerReveal[];
    isLastQuestionOfRound: boolean;
    onnext: () => void;
  }

  const { questionId, lang, durationSeconds, players, isLastQuestionOfRound, onnext }: Props = $props();

  // Différencié ssi au moins un joueur porte sa propre durée (sinon tous répondent à la
  // même question -> un seul split-flap géant partagé, comportement v1).
  const isDifferentiated = $derived(players.some((p) => p.ownDurationSeconds !== undefined));
  const formatted = $derived(formatSplitFlapDuration(durationSeconds, lang));

  function playerFormatted(player: PlayerReveal): string {
    return formatSplitFlapDuration(player.ownDurationSeconds ?? durationSeconds, lang);
  }

  // Le signalement est réinitialisé à chaque nouvelle question (nouvelle questionId).
  let reportState = $state<'idle' | 'submitting' | 'done' | 'error'>('idle');
  $effect(() => {
    void questionId;
    reportState = 'idle';
  });

  async function handleReport(): Promise<void> {
    reportState = 'submitting';
    try {
      await reportQuestion(questionId);
      reportState = 'done';
    } catch {
      reportState = 'error';
    }
  }
</script>

<div class="reveal">
  <span class="reveal__label">{t('reveal.real_duration')}</span>

  {#if !isDifferentiated}
    <!-- Questions communes (v1) : LE moment fort, un seul split-flap partagé. -->
    <div class="reveal__flap">
      <SplitFlap value={formatted} size="mega" />
    </div>
  {/if}

  <div class="reveal__players">
    {#each players as player (player.pseudo)}
      <div class="reveal__player" class:reveal__player--correct={player.isGoodAnswer} class:reveal__player--incorrect={!player.isGoodAnswer}>
        {#if isDifferentiated}
          <!-- Questions différenciées (Lot 3, GAME_DESIGN_V2.md §5) : plus de durée unique à
               révéler en tête -> chaque joueur voit la sienne, juste au-dessus de son résultat. -->
          <div class="reveal__player-flap">
            <SplitFlap value={playerFormatted(player)} size="title" />
          </div>
        {/if}
        <span class="reveal__pseudo">{player.pseudo}</span>
        <span class="reveal__result">
          <Icon name={player.isGoodAnswer ? 'check' : 'warning'} size="sm" />
          {t(player.isGoodAnswer ? 'reveal.correct' : 'reveal.incorrect')}
        </span>
        <span class="reveal__points" data-numeric>{t('reveal.points_earned', { points: player.points })}</span>
      </div>
    {/each}
  </div>

  <Button variant="primary" fullWidth onclick={onnext}>
    {t(isLastQuestionOfRound ? 'reveal.next_round' : 'reveal.next_question')}
  </Button>

  <div class="reveal__report">
    {#if reportState === 'done'}
      <p class="reveal__report-status reveal__report-status--ok">
        <Icon name="check" size="sm" />
        {t('contribute.report_success')}
      </p>
    {:else if reportState === 'error'}
      <p class="reveal__report-status reveal__report-status--error">
        <Icon name="warning" size="sm" />
        {t('contribute.report_error')}
      </p>
    {:else}
      <Button variant="ghost" fullWidth disabled={reportState === 'submitting'} onclick={handleReport}>
        <Icon name="warning" size="sm" />
        {t('contribute.report_button')}
      </Button>
    {/if}
  </div>
</div>

<style>
  .reveal {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--gap-wide);
    width: 100%;
  }

  .reveal__label {
    font-family: var(--font-mono);
    font-size: var(--fs-label);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-mid);
  }

  .reveal__flap {
    display: flex;
    justify-content: center;
    max-width: 100%;
  }

  .reveal__players {
    display: flex;
    flex-direction: column;
    gap: var(--gap-tight);
    width: 100%;
  }

  .reveal__player {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--gap-tight);
    padding: 0.625rem 0.75rem;
    background: var(--board-raised);
    border-radius: var(--radius-card);
    border-left: 0.1875rem solid transparent;
  }

  .reveal__player--correct {
    border-left-color: var(--go);
  }

  .reveal__player-flap {
    display: flex;
    justify-content: center;
    width: 100%;
    order: -1;
    margin-bottom: 0.25rem;
  }

  .reveal__player--incorrect {
    border-left-color: var(--signal);
  }

  .reveal__pseudo {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--fs-body);
    color: var(--ink-hi);
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .reveal__result {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: var(--fs-micro);
    color: var(--ink-mid);
  }

  .reveal__player--correct .reveal__result {
    color: var(--go);
  }

  .reveal__player--incorrect .reveal__result {
    color: var(--signal);
  }

  .reveal__points {
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: var(--fs-body);
    color: var(--amber);
  }

  .reveal__report {
    width: 100%;
  }

  .reveal__report-status {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    margin: 0;
    font-size: var(--fs-micro);
    color: var(--ink-mid);
  }

  .reveal__report-status--ok {
    color: var(--go);
  }

  .reveal__report-status--error {
    color: var(--signal);
  }
</style>
