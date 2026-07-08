<script lang="ts">
  // Écran principal (Lot 9, GAME_DESIGN_V2.md §6) : affichage partagé par tous les joueurs
  // (grand écran, projecteur...). Deux usages possibles selon `isHost` :
  // - hôte non-joueur (modèle Kahoot "je présente seulement") : ce même écran porte aussi les
  //   contrôles de partie (démarrer/suivant/passer) -- l'hôte pilote sans jouer.
  // - second écran/projecteur sans contrôle (isHost=false, ou aucune connexion fournie) :
  //   lecture seule pure, ne fait que refléter room:state/question:show/question:results.
  import { t, getLang } from '../../lib/i18n';
  import { getRoomState } from '../../lib/ws/roomStore.svelte';
  import type { RoomConnection } from '../../lib/ws/roomClient';
  import Card from '../../lib/components/Card.svelte';
  import Button from '../../lib/components/Button.svelte';
  import Leaderboard from '../../lib/components/Leaderboard.svelte';
  import Icon from '../../lib/components/Icon.svelte';
  import RoomRevealPanel from './RoomRevealPanel.svelte';

  interface Props {
    connection?: RoomConnection | null;
    isHost?: boolean;
  }

  const { connection = null, isHost = false }: Props = $props();

  const room = getRoomState();

  const answeredCount = $derived(room.players.filter((p) => p.hasAnswered).length);
  const connectedCount = $derived(room.players.filter((p) => p.connected).length);

  const leaderboardEntries = $derived(
    room.leaderboard.map((entry, i) => ({
      pseudo: entry.pseudo,
      score: entry.score,
      bestStreak: 0,
      isWinner: i === 0,
    })),
  );

  function handleStart(): void {
    connection?.mjStart();
  }

  function handleSkip(): void {
    connection?.mjSkip();
  }

  function handleNext(): void {
    connection?.mjNext();
  }
</script>

<div class="main-screen">
  {#if room.status === 'lobby' && isHost}
    <p class="main-screen__waiting" role="status">
      <Icon name="clock" size="md" />
      {t('room.screen.waiting_question')}
    </p>
    <Button variant="primary" fullWidth onclick={handleStart} disabled={room.players.length === 0}>
      <Icon name="hand-tap" size="md" />
      {t('room.lobby.start')}
    </Button>
  {:else if room.status === 'question' && room.question}
    {@const q = room.question}
    <Card>
      <p class="main-screen__question">
        {getLang() === 'en' ? q.textEn : q.textFr}
      </p>
    </Card>

    <p class="main-screen__waiting" role="status">
      <Icon name="hand-tap" size="md" />
      {t('room.screen.waiting_answers')}
    </p>
    <p class="main-screen__answered-count">
      {t('room.screen.answered_count', { answered: answeredCount, total: connectedCount })}
    </p>

    {#if isHost}
      <Button variant="ghost" fullWidth onclick={handleSkip}>
        <Icon name="caret-right" size="md" />
        {t('room.master.skip')}
      </Button>
    {/if}
  {:else if room.status === 'results' && room.results}
    <h2 class="main-screen__title">{t('room.screen.results_title')}</h2>
    <RoomRevealPanel durationSeconds={room.results.durationSeconds} lang={getLang()} />

    <h3 class="main-screen__subtitle">{t('room.screen.leaderboard_title')}</h3>
    <Leaderboard entries={leaderboardEntries} variant="compact" />

    {#if isHost}
      <Button variant="primary" fullWidth onclick={handleNext}>
        <Icon name="caret-right" size="md" />
        {t('room.master.next')}
      </Button>
    {/if}
  {:else if room.status === 'ended'}
    <h2 class="main-screen__title">{t('room.screen.game_over')}</h2>
    <h3 class="main-screen__subtitle">{t('room.screen.final_leaderboard')}</h3>
    <Leaderboard
      entries={room.leaderboard.map((entry, i) => ({
        pseudo: entry.pseudo,
        score: entry.score,
        bestStreak: 0,
        isWinner: i === 0,
      }))}
      variant="final"
    />
  {:else}
    <p class="main-screen__waiting" role="status">
      <Icon name="clock" size="md" />
      {t('room.screen.waiting_question')}
    </p>
  {/if}
</div>

<style>
  .main-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--gap-wide);
    width: 100%;
    text-align: center;
  }

  .main-screen__question {
    font-family: var(--font-display);
    font-size: var(--fs-title);
    font-weight: 500;
    color: var(--ink-hi);
    margin: 0;
  }

  .main-screen__waiting {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--gap-tight);
    color: var(--ink-mid);
    font-size: var(--fs-lead);
  }

  .main-screen__answered-count {
    font-family: var(--font-mono);
    font-size: var(--fs-body);
    color: var(--ink-mid);
    margin: 0;
  }

  .main-screen__title {
    font-family: var(--font-display);
    font-size: var(--fs-title);
    font-weight: 700;
    color: var(--ink-hi);
    margin: 0;
  }

  .main-screen__subtitle {
    font-family: var(--font-mono);
    font-size: var(--fs-label);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-mid);
    margin: 0;
    width: 100%;
    text-align: left;
  }
</style>
