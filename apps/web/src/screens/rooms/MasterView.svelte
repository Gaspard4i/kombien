<script lang="ts">
  // Manette du maître de jeu (Lot 9, GAME_DESIGN_V2.md §6) : le MJ répond comme n'importe quel
  // joueur (même zone de réponse) et pilote en plus le rythme de la partie (mj:next/mj:skip).
  // Ne voit JAMAIS la bonne réponse avant question:results (§6.1) -- room:state ne renvoie que
  // hasAnswered par joueur, jamais la réponse elle-même ni la vérité terrain.
  import { t, getLang } from '../../lib/i18n';
  import { getRoomState } from '../../lib/ws/roomStore.svelte';
  import type { RoomConnection } from '../../lib/ws/roomClient';
  import { binaryAnswerPayload, ordreAnswerPayload, duelAnswerPayload } from '../../lib/ws/roomClient';
  import type { Unit } from '../../lib/domain/units';
  import Card from '../../lib/components/Card.svelte';
  import Button from '../../lib/components/Button.svelte';
  import AnswerTimer from '../../lib/components/AnswerTimer.svelte';
  import Leaderboard from '../../lib/components/Leaderboard.svelte';
  import Icon from '../../lib/components/Icon.svelte';
  import BinaireAnswer from '../game/BinaireAnswer.svelte';
  import OrdreDeGrandeurAnswer from '../game/OrdreDeGrandeurAnswer.svelte';
  import DuelAnswer from '../game/DuelAnswer.svelte';
  import RoomRevealPanel from './RoomRevealPanel.svelte';

  interface Props {
    connection: RoomConnection | null;
  }

  const { connection }: Props = $props();

  const room = getRoomState();

  let hasAnsweredLocally = $state(false);

  $effect(() => {
    void room.question?.questionIndex;
    hasAnsweredLocally = false;
  });

  function secondsUntil(endsAt: number): number {
    return Math.max(1, Math.round((endsAt - Date.now()) / 1000));
  }

  function handleBinaire(answer: 'yes' | 'no'): void {
    hasAnsweredLocally = true;
    connection?.answer(binaryAnswerPayload(answer));
  }

  function handleOrdre(unit: Unit): void {
    hasAnsweredLocally = true;
    connection?.answer(ordreAnswerPayload(unit));
  }

  function handleDuel(value: number, unit: Unit): void {
    hasAnsweredLocally = true;
    connection?.answer(duelAnswerPayload(value, unit));
  }

  function handleSkip(): void {
    connection?.mjSkip();
  }

  function handleNext(): void {
    connection?.mjNext();
  }

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
</script>

<div class="master-view">
  {#if room.status === 'question' && room.question}
    {@const q = room.question}
    <Card>
      <p class="master-view__question">
        {getLang() === 'en' ? q.textEn : q.textFr}
      </p>
    </Card>

    {#key q.questionIndex}
      <!-- onexpire no-op : la clôture réelle vient du serveur (question:results). -->
      <AnswerTimer totalSeconds={secondsUntil(q.endsAt)} onexpire={() => {}} />
    {/key}

    <p class="master-view__answered-count">
      {t('room.screen.answered_count', { answered: answeredCount, total: connectedCount })}
    </p>

    {#if hasAnsweredLocally}
      <p class="master-view__waiting" role="status">
        <Icon name="check" size="md" />
        {t('room.master.you_answered')}
      </p>
      <p class="master-view__hint">{t('room.master.no_spoiler')}</p>
    {:else if room.mode === 'binaire'}
      <BinaireAnswer onanswer={handleBinaire} />
    {:else if room.mode === 'ordre_de_grandeur'}
      <OrdreDeGrandeurAnswer onanswer={handleOrdre} />
    {:else if room.mode === 'duel'}
      <DuelAnswer onanswer={handleDuel} />
    {/if}

    <Button variant="ghost" fullWidth onclick={handleSkip}>
      <Icon name="caret-right" size="md" />
      {t('room.master.skip')}
    </Button>
  {:else if room.status === 'results' && room.results}
    <h2 class="master-view__results-title">{t('room.screen.results_title')}</h2>
    <RoomRevealPanel durationSeconds={room.results.durationSeconds} lang={getLang()} />

    <Leaderboard entries={leaderboardEntries} variant="compact" />

    <Button variant="primary" fullWidth onclick={handleNext}>
      <Icon name="caret-right" size="md" />
      {t('room.master.next')}
    </Button>
  {:else if room.status === 'ended'}
    <h2 class="master-view__results-title">{t('room.screen.game_over')}</h2>
    <Leaderboard
      entries={room.leaderboard.map((entry, i) => ({
        pseudo: entry.pseudo,
        score: entry.score,
        bestStreak: 0,
        isWinner: i === 0,
      }))}
      variant="final"
    />
  {/if}
</div>

<style>
  .master-view {
    display: flex;
    flex-direction: column;
    gap: var(--gap);
  }

  .master-view__question {
    font-family: var(--font-display);
    font-size: var(--fs-lead);
    font-weight: 500;
    color: var(--ink-hi);
    margin: 0;
  }

  .master-view__answered-count {
    text-align: center;
    font-family: var(--font-mono);
    font-size: var(--fs-micro);
    color: var(--ink-mid);
    margin: 0;
  }

  .master-view__waiting {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--gap-tight);
    text-align: center;
    color: var(--ink-mid);
    font-size: var(--fs-body);
    margin: 0;
  }

  .master-view__hint {
    text-align: center;
    color: var(--ink-mid);
    font-size: var(--fs-micro);
    margin: 0;
  }

  .master-view__results-title {
    font-family: var(--font-display);
    font-size: var(--fs-heading);
    font-weight: 700;
    color: var(--ink-hi);
    margin: 0 0 var(--gap-tight) 0;
  }
</style>
