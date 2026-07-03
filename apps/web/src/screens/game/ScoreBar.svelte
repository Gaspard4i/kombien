<script lang="ts">
  // Bandeau de score/streak persistant (DESIGN_SYSTEM.md §5.6). Le joueur actif est signalé
  // par le bandeau de charnière ambre sous son bloc. La jauge de streak : 5 segments,
  // 3 allumés = x2, 5 allumés = x3 (GAME_DESIGN.md §6.2).
  import { t } from '../../lib/i18n';
  import type { PlayerSlot } from '../../lib/stores/gameStore.svelte';
  import { streakMultiplier } from '../../lib/domain/scoring';
  import Icon from '../../lib/components/Icon.svelte';
  import SplitFlap from '../../lib/components/SplitFlap.svelte';

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

  // Casse de série : détecte le passage d'un streak >= 3 (multiplicateur actif) à 0 pour
  // déclencher le flash --signal et le retour des segments (DESIGN_SYSTEM.md §5.6). On
  // mémorise le streak précédent par joueur ; le flash est armé à la retombée puis désarmé
  // après l'animation CSS. Init vide -> rempli au premier effect (pas de capture de valeur
  // initiale de `players`, cf. svelte state_referenced_locally).
  let previousStreaks = $state<number[]>([]);
  let breaking = $state<boolean[]>([]);

  $effect(() => {
    players.forEach((p, i) => {
      const prev = previousStreaks[i];
      if (prev !== undefined && prev >= 3 && p.streak === 0) {
        breaking[i] = true;
        setTimeout(() => (breaking[i] = false), 360);
      }
      previousStreaks[i] = p.streak;
    });
  });
</script>

<div class="score-bar">
  <div class="score-bar__players">
    {#each players as player, i (player.pseudo)}
      {@const multiplier = streakMultiplier(player.streak)}
      <div
        class="score-bar__player"
        class:score-bar__player--active={activeIndex === i}
        class:score-bar__player--x3={multiplier >= 3}
        class:score-bar__player--breaking={breaking[i]}
      >
        <span class="score-bar__pseudo">{player.pseudo}</span>
        <!-- Score en mini split-flap : le chiffre "monte" en claquant à chaque manche
             gagnée (DESIGN_SYSTEM.md §5.6), pas de cascade (stagger=false). -->
        <div class="score-bar__score">
          <SplitFlap value={String(player.score)} size="score" stagger={false} spins={6} />
        </div>
        <div class="score-bar__streak" class:score-bar__streak--on={multiplier > 1}>
          <Icon name="lightning" size="sm" />
          <div class="score-bar__gauge">
            {#each { length: 5 } as _, s (s)}
              <span class="score-bar__segment" class:score-bar__segment--lit={s < litSegments(player.streak)}></span>
            {/each}
          </div>
          {#if multiplier > 1}
            <span class="score-bar__multiplier">{t('score.multiplier', { value: multiplier })}</span>
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

  /* Le score vit sur une palette : le SplitFlap intérieur (size label) porte déjà le fond
     crème et la charnière ; ce wrapper ne fait que le cadrer à gauche. */
  .score-bar__score {
    align-self: flex-start;
  }

  .score-bar__streak {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    color: var(--amber-dim);
  }

  .score-bar__streak--on {
    color: var(--amber);
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
    transition: background var(--dur-flap) var(--ease-flap);
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

  /* ×3 : pulse ambre discret sur le bloc joueur (le "en feu" du DESIGN_SYSTEM §5.6). */
  .score-bar__player--x3 {
    animation: streak-pulse 1.4s var(--ease-out) infinite;
  }

  @keyframes streak-pulse {
    0%,
    100% {
      box-shadow: 0 0 0 0 transparent;
    }
    50% {
      box-shadow: 0 0 0 0.125rem var(--amber-dim);
    }
  }

  /* Casse de série : flash rouge signal bref sur le bloc + segments qui retombent
     (géré par le passage à --lit=false, déjà animé via .score-bar__segment). */
  .score-bar__player--breaking {
    animation: streak-break 0.36s var(--ease-flap);
  }

  @keyframes streak-break {
    0% {
      box-shadow: 0 0 0 0.125rem var(--signal);
    }
    100% {
      box-shadow: 0 0 0 0 transparent;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .score-bar__player--x3,
    .score-bar__player--breaking {
      animation: none;
    }
    /* Conserve l'état x3 lisible sans mouvement : liseré statique. */
    .score-bar__player--x3 {
      box-shadow: 0 0 0 0.125rem var(--amber-dim);
    }
    .score-bar__segment {
      transition: none;
    }
  }
</style>
