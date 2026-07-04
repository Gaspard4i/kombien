<script lang="ts">
  // Timer de réponse en pass-and-play (v2.1) : jauge de palettes qui s'éteignent une à une,
  // cohérente avec le split-flap (DESIGN_SYSTEM.md §5) plutôt qu'un spinner générique.
  // Compte à rebours en secondes entières affiché en chiffres, toujours lisible même avec
  // prefers-reduced-motion (la jauge devient alors un simple décompte de segments, sans
  // transition animée, pour rester lisible sans mouvement anxiogène).
  import { onDestroy } from 'svelte';
  import { t } from '../i18n';
  import Icon from './Icon.svelte';

  interface Props {
    totalSeconds: number;
    // Appelé une seule fois, à expiration exacte du délai.
    onexpire: () => void;
  }

  const { totalSeconds, onexpire }: Props = $props();

  const SEGMENTS = 10;
  const TICK_MS = 100;
  // totalSeconds est un $props() : le lire directement dans une const au top-level déclenche
  // state_referenced_locally (Svelte lit la valeur "gelée" au lieu de suivre les changements).
  // On passe par une fonction non réactive pour capturer explicitement la valeur au montage —
  // le composant est de toute façon recréé à chaque question via {#key} côté Game.svelte, donc
  // totalSeconds ne change jamais après ce calcul initial.
  function initialTotalMs(): number {
    return totalSeconds * 1000;
  }

  const deadline = Date.now() + initialTotalMs();

  let remainingMs = $state(initialTotalMs());
  let expired = false;

  const remainingSeconds = $derived(Math.max(0, Math.ceil(remainingMs / 1000)));
  const litSegments = $derived(Math.max(0, Math.ceil((remainingMs / (totalSeconds * 1000)) * SEGMENTS)));
  const urgent = $derived(remainingSeconds <= Math.min(3, totalSeconds));

  const interval = setInterval(() => {
    remainingMs = Math.max(0, deadline - Date.now());
    if (remainingMs === 0 && !expired) {
      expired = true;
      clearInterval(interval);
      onexpire();
    }
  }, TICK_MS);

  onDestroy(() => clearInterval(interval));
</script>

<div class="answer-timer" class:answer-timer--urgent={urgent}>
  <Icon name="clock" size="sm" />
  <div class="answer-timer__gauge" aria-hidden="true">
    {#each { length: SEGMENTS } as _, s (s)}
      <span class="answer-timer__segment" class:answer-timer__segment--lit={s < litSegments}></span>
    {/each}
  </div>
  <!-- aria-live limité à la seconde entière (pas au tick de 100ms) : évite de spammer les
       lecteurs d'écran, cf remainingSeconds ($derived, ne change qu'une fois par seconde). -->
  <span class="answer-timer__seconds" data-numeric aria-live="polite">
    {t('game.timer_seconds', { seconds: remainingSeconds })}
  </span>
</div>

<style>
  .answer-timer {
    display: flex;
    align-items: center;
    gap: var(--gap-tight);
    color: var(--ink-mid);
  }

  .answer-timer--urgent {
    color: var(--signal);
  }

  .answer-timer__gauge {
    display: flex;
    gap: 0.1875rem;
    flex: 1;
  }

  .answer-timer__segment {
    flex: 1;
    height: 0.5rem;
    border-radius: var(--radius-flap);
    background: var(--amber-dim);
    transition: background var(--dur-flap) var(--ease-flap);
  }

  .answer-timer__segment--lit {
    background: var(--amber);
  }

  .answer-timer--urgent .answer-timer__segment--lit {
    background: var(--signal);
  }

  .answer-timer__seconds {
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: var(--fs-label);
    min-width: 2.5em;
    text-align: right;
  }

  @media (prefers-reduced-motion: reduce) {
    .answer-timer__segment {
      transition: none;
    }
  }
</style>
