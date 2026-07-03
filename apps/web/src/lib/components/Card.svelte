<script lang="ts">
  // Panneau d'annonce (DESIGN_SYSTEM.md §5.5) : surface board-raised, charnière soulignée,
  // relief net. Pas de "card blanche arrondie" (interdit §9.2).
  import type { Snippet } from 'svelte';

  interface Props {
    children: Snippet;
  }

  const { children }: Props = $props();
</script>

<div class="card">
  {@render children()}
</div>

<style>
  .card {
    background: var(--board-raised);
    border-top: 0.125rem solid var(--hinge);
    border-radius: var(--radius-card);
    box-shadow: 0 0.25rem 0 var(--hinge);
    padding: var(--pad-card);
  }
</style>
