<script lang="ts">
  // Mode Ordre de grandeur (DESIGN_SYSTEM.md §5.5/§7) : grille de mini-palettes, 2 colonnes
  // en base -> 4 en sm -> 7 en md. L'unité choisie passe en ambre.
  import { t } from '../../lib/i18n';
  import { UNITS, type Unit } from '../../lib/domain/units';

  interface Props {
    onanswer: (unit: Unit) => void;
  }

  const { onanswer }: Props = $props();

  let selected = $state<Unit | null>(null);

  function pick(unit: Unit): void {
    selected = unit;
    onanswer(unit);
  }
</script>

<div class="ordre">
  <div class="ordre__grid">
    {#each UNITS as unit (unit)}
      <button
        type="button"
        class="ordre__unit"
        class:ordre__unit--selected={selected === unit}
        onclick={() => pick(unit)}
      >
        {t(`units.${unit}`)}
      </button>
    {/each}
  </div>
</div>

<style>
  .ordre__grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--gap-tight);
  }

  @media (min-width: 640px) {
    .ordre__grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  @media (min-width: 768px) {
    .ordre__grid {
      grid-template-columns: repeat(7, 1fr);
    }
  }

  .ordre__unit {
    min-height: var(--touch-min);
    padding: 0.5rem 0.5rem;
    background: var(--flap);
    color: var(--flap-ink);
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: var(--fs-label);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    border: none;
    border-radius: var(--radius-flap);
    box-shadow: 0 0.125rem 0 var(--hinge);
    cursor: pointer;
    transition: transform var(--dur-quick) var(--ease-flap), box-shadow var(--dur-quick) var(--ease-flap);
  }

  .ordre__unit--selected {
    background: var(--amber);
    color: var(--amber-ink);
    box-shadow: 0 0.125rem 0 var(--amber-dim);
  }

  .ordre__unit:active {
    transform: translateY(0.125rem);
  }

  @media (prefers-reduced-motion: reduce) {
    .ordre__unit {
      transition: none;
    }
  }
</style>
