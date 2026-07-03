<script lang="ts">
  // Squelette de chargement (jamais de texte "..."). Rangée de palettes grisées qui
  // matche la layout cible (CLAUDE.md, DESIGN_SYSTEM.md §6 reduced-motion : version statique).
  import { t } from '../i18n';

  interface Props {
    rows?: number;
  }

  const { rows = 3 }: Props = $props();
</script>

<div class="skeleton" role="status" aria-label={t('common.loading')}>
  {#each { length: rows } as _, i (i)}
    <div class="skeleton__row"></div>
  {/each}
</div>

<style>
  .skeleton {
    display: flex;
    flex-direction: column;
    gap: var(--gap);
  }

  .skeleton__row {
    height: 2.75rem;
    border-radius: var(--radius-flap);
    background: var(--board-raised);
    border: 1px solid var(--hinge);
    position: relative;
    overflow: hidden;
  }

  @media (prefers-reduced-motion: no-preference) {
    .skeleton__row::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, transparent, var(--amber-dim), transparent);
      opacity: 0.25;
      animation: skeleton-sweep 1.2s ease-in-out infinite;
    }
  }

  @keyframes skeleton-sweep {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(100%);
    }
  }
</style>
