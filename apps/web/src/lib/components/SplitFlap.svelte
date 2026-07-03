<script lang="ts">
  // Le composant signature (DESIGN_SYSTEM.md §5.3) : une rangée de rouleaux qui claquent
  // en cascade jusqu'à la valeur finale. Réutilisé en version réduite pour score/streak
  // (une seule ligne, pas de cascade -> passer `stagger={false}`).
  import { onDestroy } from 'svelte';

  interface Props {
    /** Chaîne cible, un caractère = un rouleau (espaces inclus). */
    value: string;
    size?: 'mega' | 'title' | 'score' | 'label';
    /** Cascade gauche->droite (révélation de durée) ou tous les rouleaux ensemble (score/streak). */
    stagger?: boolean;
    /** Nombre de palettes parcourues avant de se figer (théâtral mais borné). */
    spins?: number;
  }

  const { value, size = 'mega', stagger = true, spins = 10 }: Props = $props();

  const REEL_CHARS = '0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  function randomChar(): string {
    return REEL_CHARS[Math.floor(Math.random() * REEL_CHARS.length)];
  }

  // Rempli immédiatement par le $effect ci-dessous (animate(value) au montage) : pas besoin
  // de dériver la longueur initiale de la prop ici.
  let displayed = $state<string[]>([]);
  let settled = $state<boolean[]>([]);
  let flashing = $state(false);
  let reducedMotion = $state(false);

  const timers: number[] = [];

  function clearTimers(): void {
    for (const id of timers) clearTimeout(id);
    timers.length = 0;
  }

  function animate(target: string): void {
    clearTimers();
    flashing = false;
    const chars = Array.from(target);
    displayed = chars.map(() => ' ');
    settled = chars.map(() => false);

    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotion = mql.matches;

    if (reducedMotion) {
      // Cross-fade simple : l'info reste, la mécanique s'efface (DESIGN_SYSTEM.md §6).
      const id = window.setTimeout(() => {
        displayed = chars;
        settled = chars.map(() => true);
        flashing = true;
        const flashId = window.setTimeout(() => (flashing = false), 120);
        timers.push(flashId);
      }, 160);
      timers.push(id);
      return;
    }

    const durFlap = 120;
    const flapStagger = stagger ? 70 : 0;

    chars.forEach((finalChar, reelIndex) => {
      const reelSpins = Math.max(6, Math.min(14, spins)) + Math.floor(Math.random() * 4);
      const startDelay = reelIndex * flapStagger;

      for (let spin = 0; spin < reelSpins; spin++) {
        const id = window.setTimeout(
          () => {
            displayed[reelIndex] = spin === reelSpins - 1 ? finalChar : randomChar();
            if (spin === reelSpins - 1) {
              settled[reelIndex] = true;
              if (reelIndex === chars.length - 1) {
                flashing = true;
                const flashId = window.setTimeout(() => (flashing = false), 180);
                timers.push(flashId);
              }
            }
          },
          startDelay + spin * durFlap,
        );
        timers.push(id);
      }
    });
  }

  $effect(() => {
    animate(value);
  });

  onDestroy(clearTimers);
</script>

<div class="split-flap split-flap--{size}" class:split-flap--flash={flashing} role="status" aria-live="polite">
  <span class="split-flap__sr-only">{value}</span>
  <div class="split-flap__reels" aria-hidden="true">
    {#each displayed as char, i (i)}
      <span class="split-flap__reel" class:split-flap__reel--settled={settled[i]}>
        {char === ' ' ? ' ' : char}
      </span>
    {/each}
  </div>
</div>

<style>
  .split-flap {
    display: inline-flex;
  }

  .split-flap__sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
  }

  .split-flap__reels {
    display: flex;
    gap: 0.125rem;
    perspective: 20rem;
    overflow-x: auto;
    max-width: 100%;
  }

  .split-flap__reel {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-mono);
    font-weight: 700;
    line-height: 1;
    color: var(--flap-ink);
    background-image: linear-gradient(
      var(--flap) 0 calc(50% - 0.0625rem),
      var(--hinge) 50%,
      var(--flap) calc(50% + 0.0625rem) 100%
    );
    border-radius: var(--radius-flap);
    box-shadow: 0 0.125rem 0 var(--hinge);
    transform-origin: center;
    transition: transform var(--dur-flap) var(--ease-flap);
  }

  @media (prefers-reduced-motion: no-preference) {
    .split-flap__reel:not(.split-flap__reel--settled) {
      animation: flap-turn var(--dur-flap) var(--ease-flap);
    }
  }

  @keyframes flap-turn {
    0% {
      transform: rotateX(0deg);
    }
    50% {
      transform: rotateX(-90deg);
    }
    100% {
      transform: rotateX(0deg);
    }
  }

  .split-flap--flash .split-flap__reel {
    box-shadow: 0 0.125rem 0 var(--hinge), 0 0 0.75rem 0.125rem var(--amber);
    transition: box-shadow 180ms var(--ease-out);
  }

  .split-flap--mega .split-flap__reel {
    font-size: clamp(2.5rem, 12vw, var(--fs-mega));
    min-width: 1.1em;
    padding: 0.05em 0.1em;
  }

  .split-flap--title .split-flap__reel {
    font-size: var(--fs-title);
    min-width: 1.1em;
    padding: 0.1em 0.15em;
  }

  /* Score de la barre de jeu : entre title et label, dimensionné pour le bloc joueur. */
  .split-flap--score .split-flap__reel {
    font-size: var(--fs-heading);
    min-width: 0.85em;
    padding: 0.08em 0.14em;
  }

  .split-flap--label .split-flap__reel {
    font-size: var(--fs-label);
    min-width: 1em;
    padding: 0.2em 0.3em;
  }

  @media (prefers-reduced-motion: reduce) {
    .split-flap__reel {
      transition: opacity 160ms ease;
    }
  }
</style>
