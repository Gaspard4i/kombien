<script lang="ts">
  // Boutons (DESIGN_SYSTEM.md §5.1). Le variant "primary" est l'action forte (Valider,
  // Révéler, Commencer) ; "choice" est réservé aux gros boutons de réponse pleine largeur.
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'choice';
    type?: 'button' | 'submit';
    disabled?: boolean;
    fullWidth?: boolean;
    onclick?: (event: MouseEvent) => void;
    children: Snippet;
    // Nécessaire quand le bouton ne contient qu'une Icon (aria-hidden, DESIGN_SYSTEM.md §4) :
    // sans texte visible, le bouton n'aurait sinon aucun nom accessible (WCAG 4.1.2).
    ariaLabel?: string;
  }

  const {
    variant = 'primary',
    type = 'button',
    disabled = false,
    fullWidth = false,
    onclick,
    children,
    ariaLabel,
  }: Props = $props();
</script>

<button
  {type}
  {disabled}
  class="btn btn--{variant}"
  class:btn--full={fullWidth}
  aria-label={ariaLabel}
  {onclick}
>
  {@render children()}
</button>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--gap-tight);
    min-height: var(--touch-min);
    min-width: var(--touch-min);
    padding: 0.75rem 1.25rem;
    border-radius: var(--radius-flap);
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--fs-body);
    letter-spacing: 0.04em;
    border: none;
    cursor: pointer;
    transition: transform var(--dur-quick) var(--ease-flap), box-shadow var(--dur-quick) var(--ease-flap);
  }

  .btn--full {
    width: 100%;
  }

  .btn:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .btn--primary {
    background: var(--amber);
    color: var(--amber-ink);
    box-shadow: 0 0.1875rem 0 var(--amber-dim);
  }

  .btn--primary:active:not(:disabled) {
    transform: translateY(0.1875rem);
    box-shadow: 0 0 0 var(--amber-dim);
  }

  .btn--secondary {
    background: var(--flap);
    color: var(--flap-ink);
    box-shadow: 0 0.1875rem 0 var(--hinge);
  }

  .btn--secondary:active:not(:disabled) {
    transform: translateY(0.1875rem);
    box-shadow: 0 0 0 var(--hinge);
  }

  .btn--ghost {
    background: transparent;
    color: var(--ink-hi);
    border: 1px solid var(--ink-lo);
  }

  .btn--ghost:active:not(:disabled) {
    background: var(--board-raised);
  }

  .btn--destructive {
    background: transparent;
    color: var(--signal);
    border: 1px solid var(--signal);
  }

  .btn--destructive:hover:not(:disabled),
  .btn--destructive:active:not(:disabled) {
    background: var(--signal);
    color: var(--signal-ink);
  }

  .btn--choice {
    background: var(--flap);
    color: var(--flap-ink);
    box-shadow: 0 0.1875rem 0 var(--hinge);
    min-height: 3.5rem;
    font-family: var(--font-mono);
    font-size: var(--fs-lead);
    width: 100%;
  }

  .btn--choice:active:not(:disabled) {
    transform: translateY(0.1875rem);
    box-shadow: 0 0 0 var(--hinge);
  }

  @media (prefers-reduced-motion: reduce) {
    .btn {
      transition: none;
    }
  }
</style>
