<script lang="ts">
  // Écran de fin (GAME_DESIGN.md §9.5) : POST /games envoie les réponses BRUTES accumulées ;
  // le backend recalcule score/xp/badges (anti-triche, cf API_CONTRACT.md). L'affichage
  // n'utilise QUE la réponse serveur comme vérité, jamais le score provisoire du gameStore.
  import { onMount } from 'svelte';
  import { t, getLang } from '../lib/i18n';
  import { navigate } from '../lib/router/router.svelte';
  import { submitGame, ApiError } from '../lib/api/client';
  import type { SubmitGameResult } from '../lib/api/types';
  import { getGameState, resetGame } from '../lib/stores/gameStore.svelte';
  import AppShell from '../lib/components/AppShell.svelte';
  import Card from '../lib/components/Card.svelte';
  import Button from '../lib/components/Button.svelte';
  import Skeleton from '../lib/components/Skeleton.svelte';
  import ErrorMessage from '../lib/components/ErrorMessage.svelte';
  import Icon from '../lib/components/Icon.svelte';
  import KLogo from '../lib/components/KLogo.svelte';

  const game = getGameState();

  let submitting = $state(true);
  let submitError = $state<string | null>(null);
  let result = $state<SubmitGameResult | null>(null);

  onMount(async () => {
    const config = game.config;
    const players = game.players;
    if (!config || !players) {
      // Arrivée directe sur /end sans partie en cours : retour accueil.
      navigate({ name: 'home' });
      return;
    }

    try {
      result = await submitGame({
        mode: config.mode,
        lang: getLang(),
        end_condition: config.endCondition,
        target_score: config.endCondition === 'points' ? config.targetScore : undefined,
        rounds_played: game.roundNumber,
        players: [
          { pseudo: players[0].pseudo, answers: players[0].answers },
          { pseudo: players[1].pseudo, answers: players[1].answers },
        ],
      });
    } catch (err) {
      submitError = err instanceof ApiError ? t(`errors.${err.code}`) : t('errors.network_error');
    } finally {
      submitting = false;
    }
  });

  function handlePlayAgain(): void {
    resetGame();
    navigate({ name: 'setup' });
  }

  function handleBackHome(): void {
    resetGame();
    navigate({ name: 'home' });
  }
</script>

<AppShell>
  <header class="end__header">
    <KLogo size="title" />
  </header>

  {#if submitting}
    <p class="end__status">{t('end.submitting')}</p>
    <Skeleton rows={4} />
  {:else if submitError}
    <ErrorMessage message={submitError} />
    <Button variant="primary" fullWidth onclick={handleBackHome}>{t('end.back_home')}</Button>
  {:else if result}
    <h1 class="end__title">
      {#if result.is_draw}
        {t('end.draw')}
      {:else}
        {t('end.winner', { pseudo: result.players.find((p) => p.is_winner)?.pseudo ?? '' })}
      {/if}
    </h1>

    <div class="end__players">
      {#each result.players as player (player.pseudo)}
        <Card>
          <div class="end__player-head">
            <span class="end__pseudo">{player.pseudo}</span>
            {#if player.is_winner}
              <Icon name="seal" size="md" />
            {/if}
          </div>

          <dl class="end__stats">
            <div class="end__stat">
              <dt>{t('end.final_score')}</dt>
              <dd data-numeric>{player.score}</dd>
            </div>
            <div class="end__stat">
              <dt>{t('end.accuracy')}</dt>
              <dd data-numeric>{Math.round(player.accuracy * 100)}%</dd>
            </div>
            <div class="end__stat">
              <dt>{t('end.best_streak')}</dt>
              <dd data-numeric>{player.best_streak}</dd>
            </div>
            <div class="end__stat">
              <dt>{t('end.xp_gained')}</dt>
              <dd data-numeric>+{player.xp_gained}</dd>
            </div>
            <div class="end__stat">
              <dt>{t('leaderboard.level')}</dt>
              <dd data-numeric>{player.level}</dd>
            </div>
          </dl>

          <div class="end__badges">
            <span class="end__badges-title">{t('end.new_badges')}</span>
            {#if player.new_badges.length === 0}
              <p class="end__no-badges">{t('end.no_new_badges')}</p>
            {:else}
              <div class="end__badge-list">
                {#each player.new_badges as slug (slug)}
                  <div class="end__badge">
                    <Icon name="medal-military" size="md" />
                    <span>{t(`badges.${slug}`)}</span>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </Card>
      {/each}
    </div>

    <div class="end__actions">
      <Button variant="primary" fullWidth onclick={handlePlayAgain}>
        <Icon name="arrows-clockwise" size="md" />
        {t('end.play_again')}
      </Button>
      <Button variant="ghost" fullWidth onclick={handleBackHome}>
        {t('end.back_home')}
      </Button>
    </div>
  {/if}
</AppShell>

<style>
  .end__header {
    display: flex;
    justify-content: center;
  }

  .end__status {
    text-align: center;
    color: var(--ink-mid);
    font-size: var(--fs-body);
  }

  .end__title {
    font-family: var(--font-display);
    font-size: var(--fs-title);
    font-weight: 700;
    color: var(--amber);
    text-align: center;
  }

  .end__players {
    display: flex;
    flex-direction: column;
    gap: var(--gap);
  }

  .end__player-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: var(--amber);
    margin-bottom: var(--gap);
  }

  .end__pseudo {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--fs-heading);
    color: var(--ink-hi);
  }

  .end__stats {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--gap-tight) var(--gap);
    margin: 0 0 var(--gap-wide) 0;
  }

  .end__stat {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .end__stat dt {
    font-family: var(--font-mono);
    font-size: var(--fs-micro);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-mid);
  }

  .end__stat dd {
    margin: 0;
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: var(--fs-heading);
    color: var(--ink-hi);
  }

  .end__badges-title {
    font-family: var(--font-mono);
    font-size: var(--fs-label);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-mid);
  }

  .end__no-badges {
    color: var(--ink-lo);
    font-size: var(--fs-micro);
    margin: 0.375rem 0 0;
  }

  .end__badge-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--gap-tight);
    margin-top: 0.5rem;
  }

  .end__badge {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.625rem;
    background: var(--flap);
    color: var(--flap-ink);
    border-radius: var(--radius-pill);
    font-size: var(--fs-micro);
    font-weight: 700;
  }

  .end__actions {
    display: flex;
    flex-direction: column;
    gap: var(--gap);
  }
</style>
