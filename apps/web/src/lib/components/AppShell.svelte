<script lang="ts">
  // Conteneur de jeu : colonne étroite façon téléphone (max 30rem), même sur desktop
  // (DESIGN_SYSTEM.md §7). Le caisson --board déborde et remplit le reste de l'écran.
  import type { Snippet } from 'svelte';

  interface Props {
    children: Snippet;
  }

  const { children }: Props = $props();
</script>

<div class="shell">
  <main class="shell__content">
    {@render children()}
  </main>
</div>

<style>
  .shell {
    min-height: 100dvh;
    display: flex;
    justify-content: center;
    background: var(--board);
  }

  .shell__content {
    width: 100%;
    max-width: 30rem;
    display: flex;
    flex-direction: column;
    padding: var(--gap-wide);
    padding-top: max(var(--gap-wide), env(safe-area-inset-top));
    padding-bottom: max(var(--gap-wide), env(safe-area-inset-bottom));
    padding-left: max(var(--gap-wide), env(safe-area-inset-left));
    padding-right: max(var(--gap-wide), env(safe-area-inset-right));
    gap: var(--gap-wide);
  }
</style>
