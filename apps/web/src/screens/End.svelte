<script lang="ts">
  // Écran de fin (GAME_DESIGN.md §9.5) : POST /games envoie les réponses BRUTES accumulées ;
  // le backend recalcule score/streak/exploits (anti-triche, cf API_CONTRACT.md). L'affichage
  // n'utilise QUE la réponse serveur comme vérité, jamais le score provisoire du gameStore.
  // session_exploits est un feedback de fin de partie non persistant (v2 lot 0 : plus d'XP/
  // niveau/badges cumulés, cf PLAN_V2.md).
  import { onMount } from 'svelte';
  import { t, getLang } from '../lib/i18n';
  import { navigate } from '../lib/router/router.svelte';
  import { submitGame, ApiError } from '../lib/api/client';
  import type { SubmitGameResult } from '../lib/api/types';
  import { getGameState, resetGame, answersUpToLastCompleteRound } from '../lib/stores/gameStore.svelte';
  import AppShell from '../lib/components/AppShell.svelte';
  import Card from '../lib/components/Card.svelte';
  import Button from '../lib/components/Button.svelte';
  import Skeleton from '../lib/components/Skeleton.svelte';
  import ErrorMessage from '../lib/components/ErrorMessage.svelte';
  import Icon from '../lib/components/Icon.svelte';
  import KLogo from '../lib/components/KLogo.svelte';
  import Leaderboard from '../lib/components/Leaderboard.svelte';
  import SplitFlap from '../lib/components/SplitFlap.svelte';

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
        // Fin de partie assouplie (Lot 5 v2, GAME_DESIGN_V2.md §4.2) : seules les réponses
        // des manches COMPLETES sont envoyées — une manche entamée mais pas terminée par
        // tout le monde ne doit compter pour personne, y compris ceux déjà passés dessus.
        players: players.map((p) => ({ pseudo: p.pseudo, answers: answersUpToLastCompleteRound(p) })),
      });
      // Garde-fou défensif : ne devrait jamais arriver (Game.svelte bloque déjà ce cas avant
      // de naviguer vers /end), mais si le serveur renvoie malgré tout "annulée", pas d'écran
      // de fin classé (GAME_DESIGN_V2.md §4.2 règle 4).
      if (result.cancelled) {
        resetGame();
        navigate({ name: 'home', cancelledGame: true });
        return;
      }
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

  // Vainqueur unique, co-vainqueurs à égalité de tête (GAME_DESIGN_V2.md §1.3), ou match
  // nul général (is_draw serveur, tous à égalité).
  function endTitle(r: SubmitGameResult): string {
    if (r.is_draw) return t('end.draw');
    const winners = r.players.filter((p) => p.is_winner);
    if (winners.length === 1) return t('end.winner', { pseudo: winners[0]!.pseudo });
    return t('end.co_winners', { pseudos: winners.map((w) => w.pseudo).join(', ') });
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
    <h1 class="end__title">{endTitle(result)}</h1>

    <Leaderboard
      variant="final"
      entries={result.players.map((p) => ({
        pseudo: p.pseudo,
        score: p.score,
        bestStreak: p.best_streak,
        accuracy: p.accuracy,
        isWinner: p.is_winner,
      }))}
    />

    <div class="end__players">
      {#each [...result.players].sort((a, b) => b.score - a.score) as player (player.pseudo)}
        <Card>
          <div class="end__player-head">
            <span class="end__pseudo">{player.pseudo}</span>
            {#if player.is_winner}
              <Icon name="seal" size="md" />
            {/if}
          </div>

          <!-- Score final : le grand claquement de la vérité de la partie (DESIGN_SYSTEM.md
               §5.3 en version réduite). Il "monte" jusqu'au total au montage de l'écran. -->
          <div class="end__score">
            <span class="end__score-label">{t('end.final_score')}</span>
            <div class="end__score-flap">
              <SplitFlap value={String(player.score)} size="title" stagger={false} spins={8} />
            </div>
          </div>

          <!-- Chiffres du tableau : chaque stat vit sur une palette crème (§9.1). -->
          <dl class="end__stats">
            <div class="end__stat">
              <dt>{t('end.accuracy')}</dt>
              <dd class="end__stat-flap" data-numeric>{Math.round(player.accuracy * 100)}%</dd>
            </div>
            <div class="end__stat">
              <dt>{t('end.best_streak')}</dt>
              <dd class="end__stat-flap end__stat-flap--streak" data-numeric>
                <Icon name="lightning" size="sm" />
                {player.best_streak}
              </dd>
            </div>
          </dl>

          <div class="end__badges">
            <span class="end__badges-title">{t('end.session_exploits')}</span>
            {#if player.session_exploits.length === 0}
              <p class="end__no-badges">{t('end.no_exploits')}</p>
            {:else}
              <!-- Palettes de récompense estampillées (DESIGN_SYSTEM.md §5.7) : palette crème
                   carrée, glyphe centré, label dessous, liseré ambre. -->
              <div class="end__badge-list">
                {#each player.session_exploits as slug (slug)}
                  <div class="end__badge">
                    <span class="end__badge-stamp">
                      <Icon name="medal-military" size="md" />
                    </span>
                    <span class="end__badge-name">{t(`exploits.${slug}`)}</span>
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

  .end__score {
    display: flex;
    flex-direction: column;
    gap: var(--gap-tight);
    margin-bottom: var(--gap-wide);
  }

  .end__score-label {
    font-family: var(--font-mono);
    font-size: var(--fs-micro);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-mid);
  }

  .end__score-flap {
    display: flex;
  }

  .end__stats {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--gap);
    margin: 0 0 var(--gap-wide) 0;
  }

  .end__stat {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .end__stat dt {
    font-family: var(--font-mono);
    font-size: var(--fs-micro);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-mid);
  }

  /* Palette crème : la donnée chiffrée vit sur le "papier" du tableau, charnière médiane
     simulée par le gradient (DESIGN_SYSTEM.md §5.0). */
  .end__stat-flap {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    margin: 0;
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: var(--fs-heading);
    color: var(--flap-ink);
    background-image: linear-gradient(
      var(--flap) 0 calc(50% - 0.0625rem),
      var(--hinge) 50%,
      var(--flap) calc(50% + 0.0625rem) 100%
    );
    border-radius: var(--radius-flap);
    box-shadow: 0 0.125rem 0 var(--hinge);
    padding: 0.35rem 0.6rem;
  }

  .end__stat-flap--streak {
    color: var(--amber-ink);
    background-image: linear-gradient(
      var(--amber) 0 calc(50% - 0.0625rem),
      var(--hinge) 50%,
      var(--amber) calc(50% + 0.0625rem) 100%
    );
    box-shadow: 0 0.125rem 0 var(--amber-dim);
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
    gap: var(--gap);
    margin-top: 0.625rem;
  }

  /* Palette de récompense (DESIGN_SYSTEM.md §5.7) : carré crème estampillé, liseré ambre,
     nom de l'exploit en label mono dessous. */
  .end__badge {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.375rem;
    max-width: 6rem;
    text-align: center;
  }

  .end__badge-stamp {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 3rem;
    height: 3rem;
    color: var(--flap-ink);
    background-image: linear-gradient(
      var(--flap) 0 calc(50% - 0.0625rem),
      var(--hinge) 50%,
      var(--flap) calc(50% + 0.0625rem) 100%
    );
    border: 0.125rem solid var(--amber);
    border-radius: var(--radius-card);
    box-shadow: 0 0.125rem 0 var(--hinge);
  }

  .end__badge-name {
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: var(--fs-micro);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--ink-hi);
    line-height: 1.2;
  }

  .end__actions {
    display: flex;
    flex-direction: column;
    gap: var(--gap);
  }
</style>
