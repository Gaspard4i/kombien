<script lang="ts">
  // Classement de session consultable EN COURS de partie (Lot 7 v2, GAME_DESIGN_V2.md §0.1/
  // §6.5) : overlay plein écran, focus trap, scroll interne au panneau (jamais le body).
  // Premier dialog modal du projet -> pas de primitive Modal générique existante à réutiliser,
  // ce composant sert de référence si un futur overlay en a besoin.
  import { onMount } from 'svelte';
  import { t } from '../i18n';
  import type { LeaderboardEntry } from './Leaderboard.svelte';
  import Leaderboard from './Leaderboard.svelte';
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';

  interface Props {
    entries: LeaderboardEntry[];
    onclose: () => void;
  }

  const { entries, onclose }: Props = $props();

  let panelEl: HTMLDivElement | undefined;

  function focusableElements(): HTMLElement[] {
    if (!panelEl) return [];
    return Array.from(panelEl.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])'));
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      onclose();
      return;
    }
    if (event.key !== 'Tab') return;

    // Focus trap : empêche Tab/Shift+Tab de sortir du panneau tant qu'il est ouvert.
    const focusable = focusableElements();
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  onMount(() => {
    focusableElements()[0]?.focus();
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="overlay">
  <button
    type="button"
    class="overlay__backdrop"
    aria-label={t('leaderboard.close')}
    onclick={onclose}
  ></button>

  <div class="overlay__panel" bind:this={panelEl} role="dialog" aria-modal="true" aria-labelledby="leaderboard-title">
    <header class="overlay__header">
      <h2 id="leaderboard-title" class="overlay__title">{t('leaderboard.in_progress_title')}</h2>
      <Button variant="ghost" ariaLabel={t('leaderboard.close')} onclick={onclose}>
        <Icon name="x" size="md" />
      </Button>
    </header>

    <div class="overlay__scroll">
      <Leaderboard {entries} variant="compact" />
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 20;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }

  @media (min-width: 40rem) {
    .overlay {
      align-items: center;
    }
  }

  .overlay__backdrop {
    position: absolute;
    inset: 0;
    background: rgb(10 11 13 / 70%);
    border: none;
    padding: 0;
    cursor: pointer;
  }

  .overlay__panel {
    position: relative;
    width: 100%;
    max-width: 30rem;
    max-height: min(85dvh, 40rem);
    display: flex;
    flex-direction: column;
    background: var(--board);
    border-top: 0.125rem solid var(--amber);
    border-radius: var(--radius-card) var(--radius-card) 0 0;
    box-shadow: 0 -0.25rem 0 var(--hinge);
    padding: var(--gap-wide);
    gap: var(--gap);
  }

  @media (min-width: 40rem) {
    .overlay__panel {
      border-radius: var(--radius-card);
      box-shadow: 0 0.25rem 0 var(--hinge);
    }
  }

  .overlay__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }

  .overlay__title {
    font-family: var(--font-display);
    font-size: var(--fs-heading);
    font-weight: 700;
    color: var(--amber);
  }

  .overlay__scroll {
    overflow-y: auto;
    /* Scroll interne au panneau uniquement (mobile-first : jamais le body qui bouge
       derrière l'overlay). */
    overscroll-behavior: contain;
  }
</style>
