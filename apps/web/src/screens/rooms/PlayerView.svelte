<script lang="ts">
  // Appareil joueur (Lot 9, GAME_DESIGN_V2.md §6) : répond à la question en cours (le timer
  // dérive de endsAt, échéance serveur -- le client n'affiche qu'un décompte, la clôture
  // réelle vient de question:results). Ne voit jamais sa propre bonne/mauvaise réponse tant
  // que question:results n'est pas arrivé (§6.1, jamais de fuite avant révélation).
  import { t, getLang } from '../../lib/i18n';
  import { getRoomState, you } from '../../lib/ws/roomStore.svelte';
  import type { RoomConnection } from '../../lib/ws/roomClient';
  import { binaryAnswerPayload, ordreAnswerPayload, duelAnswerPayload } from '../../lib/ws/roomClient';
  import type { Unit } from '../../lib/domain/units';
  import Card from '../../lib/components/Card.svelte';
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

  // Une seule réponse acceptée par joueur et par question (already_answered sinon, §6.1) --
  // ce garde-fou local évite un aller-retour serveur inutile en cas de double tap.
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

  const myResult = $derived(
    room.results?.results.find((r) => r.playerId === room.you?.playerId) ?? null,
  );

  const leaderboardEntries = $derived(
    room.leaderboard.map((entry) => ({
      pseudo: entry.pseudo,
      score: entry.score,
      bestStreak: 0,
      isWinner: entry.playerId === room.leaderboard[0]?.playerId,
    })),
  );
</script>

<div class="player-view">
  {#if room.status === 'question' && room.question}
    {@const q = room.question}
    <Card>
      <p class="player-view__question">
        {getLang() === 'en' ? q.textEn : q.textFr}
      </p>
    </Card>

    {#key q.questionIndex}
      <!-- onexpire no-op : la clôture réelle vient du serveur (question:results), le timer
           client n'est qu'un affichage dérivé de endsAt (API_CONTRACT.md §Rooms). -->
      <AnswerTimer totalSeconds={secondsUntil(q.endsAt)} onexpire={() => {}} />
    {/key}

    {#if hasAnsweredLocally || you()?.hasAnswered}
      <p class="player-view__waiting" role="status">
        <Icon name="check" size="md" />
        {t('room.player.answer_recorded')}
      </p>
    {:else if room.mode === 'binaire'}
      <BinaireAnswer onanswer={handleBinaire} />
    {:else if room.mode === 'ordre_de_grandeur'}
      <OrdreDeGrandeurAnswer onanswer={handleOrdre} />
    {:else if room.mode === 'duel'}
      <DuelAnswer onanswer={handleDuel} />
    {/if}
  {:else if room.status === 'results' && room.results}
    <h2 class="player-view__results-title">{t('room.screen.results_title')}</h2>
    <RoomRevealPanel durationSeconds={room.results.durationSeconds} lang={getLang()} />

    {#if myResult}
      <Card>
        <p class="player-view__your-result">
          {t('room.player.your_result')}
          <span class="player-view__points" class:player-view__points--zero={myResult.points === 0}>
            {t('room.player.your_points', { points: myResult.points })}
          </span>
        </p>
        <p class="player-view__score">{t('room.player.your_score', { score: myResult.scoreAfter })}</p>
      </Card>
    {/if}

    <Leaderboard entries={leaderboardEntries} variant="compact" />

    <p class="player-view__waiting" role="status">{t('room.player.waiting_next')}</p>
  {:else if room.status === 'ended'}
    <h2 class="player-view__results-title">{t('room.screen.game_over')}</h2>
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
    <p class="player-view__waiting" role="status">{t('room.player.waiting_start')}</p>
  {/if}
</div>

<style>
  .player-view {
    display: flex;
    flex-direction: column;
    gap: var(--gap);
  }

  .player-view__question {
    font-family: var(--font-display);
    font-size: var(--fs-lead);
    font-weight: 500;
    color: var(--ink-hi);
    margin: 0;
  }

  .player-view__waiting {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--gap-tight);
    text-align: center;
    color: var(--ink-mid);
    font-size: var(--fs-body);
  }

  .player-view__results-title {
    font-family: var(--font-display);
    font-size: var(--fs-heading);
    font-weight: 700;
    color: var(--ink-hi);
    margin: 0 0 var(--gap-tight) 0;
  }

  .player-view__your-result {
    display: flex;
    align-items: center;
    gap: var(--gap-tight);
    margin: 0;
    font-size: var(--fs-body);
    color: var(--ink-hi);
  }

  .player-view__points {
    font-family: var(--font-mono);
    font-weight: 700;
    color: var(--amber-ink);
    background: var(--amber);
    border-radius: var(--radius-flap);
    padding: 0.1em 0.5em;
  }

  .player-view__points--zero {
    color: var(--flap-ink);
    background: var(--flap);
  }

  .player-view__score {
    margin: var(--gap-tight) 0 0 0;
    font-family: var(--font-mono);
    font-size: var(--fs-body);
    color: var(--ink-mid);
  }
</style>
