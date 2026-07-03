<script lang="ts">
  // Bandeau de score/streak persistant (DESIGN_SYSTEM.md §5.6). Le joueur actif est signalé
  // par le bandeau de charnière ambre sous son bloc. La jauge de streak : 5 segments,
  // 3 allumés = x2, 5 allumés = x3 (GAME_DESIGN.md §6.2).
  import { t } from '../../lib/i18n';
  import type { PlayerSlot } from '../../lib/stores/gameStore.svelte';
  import { streakMultiplier } from '../../lib/domain/scoring';
  import Icon from '../../lib/components/Icon.svelte';

  interface Props {
    players: PlayerSlot[];
    activeIndex: number | null;
    // Classement de session en cours de partie (Lot 7 v2) : optionnel, absent des écrans
    // (calibration, tests) qui n'ont pas besoin du bouton d'ouverture.
    onopenleaderboard?: () => void;
  }

  const { players, activeIndex, onopenleaderboard }: Props = $props();

  function litSegments(streak: number): number {
    return Math.min(5, streak);
  }
</script>

<div class="score-bar">
  <div class="score-bar__players">
    {#each players as player, i (player.pseudo)}
      <div class="score-bar__player" class:score-bar__player--active={activeIndex === i}>
        <span class="score-bar__pseudo">{player.pseudo}</span>
        <span class="score-bar__score" data-numeric>{player.score}</span>
        <div class="score-bar__streak">
          <Icon name="lightning" size="sm" />
          <div class="score-bar__gauge">
            {#each { length: 5 } as _, s (s)}
              <span class="score-bar__segment" class:score-bar__segment--lit={s < litSegments(player.streak)}></span>
            {/each}
          </div>
          {#if streakMultiplier(player.streak) > 1}
            <span class="score-bar__multiplier">{t('score.multiplier', { value: streakMultiplier(player.streak) })}</span>
          {/if}
        </div>
        <div class="score-bar__hinge" aria-hidden="true"></div>
      </div>
    {/each}
  </div>

  {#if onopenleaderboard}
    <button type="button" class="score-bar__leaderboard-btn" onclick={onopenleaderboard} aria-label={t('leaderboard.open')}>
      <Icon name="stack" size="md" />
    </button>
  {/if}
</div>

<style>
  .score-bar {
    display: flex;
    align-items: stretch;
    gap: var(--gap-tight);
  }

  .score-bar__players {
    display: flex;
    gap: var(--gap-tight);
    flex: 1;
    min-width: 0;
    /* 4+ joueurs : le contenu défile horizontalement, jamais le body (mobile-first). */
    overflow-x: auto;
    scrollbar-width: thin;
  }

  .score-bar__leaderboard-btn {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: var(--touch-min);
    min-height: var(--touch-min);
    background: var(--flap);
    color: var(--flap-ink);
    border: none;
    border-radius: var(--radius-card);
    box-shadow: 0 0.1875rem 0 var(--hinge);
    cursor: pointer;
  }

  .score-bar__leaderboard-btn:active {
    transform: translateY(0.1875rem);
    box-shadow: 0 0 0 var(--hinge);
  }

  .score-bar__player {
    flex: 1 0 auto;
    min-width: 5.5rem;
    max-width: 9rem;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    padding: 0.625rem 0.75rem;
    background: var(--board-raised);
    border-radius: var(--radius-card);
    position: relative;
  }

  .score-bar__hinge {
    position: absolute;
    left: 0.5rem;
    right: 0.5rem;
    bottom: 0;
    height: 0.1875rem;
    border-radius: var(--radius-pill);
    background: transparent;
  }

  .score-bar__player--active .score-bar__hinge {
    background: var(--amber);
  }

  .score-bar__pseudo {
    font-family: var(--font-display);
    font-size: var(--fs-micro);
    color: var(--ink-mid);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .score-bar__score {
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: var(--fs-title);
    color: var(--flap-ink);
    background: var(--flap);
    border-radius: var(--radius-flap);
    padding: 0.1em 0.4em;
    align-self: flex-start;
    box-shadow: 0 0.125rem 0 var(--hinge);
  }

  .score-bar__streak {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    color: var(--amber-dim);
  }

  .score-bar__gauge {
    display: flex;
    gap: 0.1875rem;
  }

  .score-bar__segment {
    width: 0.375rem;
    height: 0.75rem;
    border-radius: var(--radius-flap);
    background: var(--amber-dim);
  }

  .score-bar__segment--lit {
    background: var(--amber);
  }

  .score-bar__multiplier {
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: var(--fs-micro);
    color: var(--amber);
  }
</style>
