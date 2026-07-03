<script lang="ts">
  // Mode Duel (DESIGN_SYSTEM.md §5.5) : champ numérique façon palette vide + sélecteur d'unité.
  import { t } from '../../lib/i18n';
  import { UNITS, type Unit } from '../../lib/domain/units';
  import Button from '../../lib/components/Button.svelte';

  interface Props {
    onanswer: (value: number, unit: Unit) => void;
  }

  const { onanswer }: Props = $props();

  // bind:value sur un <input type="number"> coerce en number (undefined si vide/invalide) :
  // https://svelte.dev/docs/svelte/bind — un $state('') désynchronise le binding.
  let value = $state<number | undefined>(undefined);
  let unit = $state<Unit>('minute');

  const canValidate = $derived(value !== undefined && value > 0);

  function handleValidate(): void {
    if (!canValidate) return;
    onanswer(value!, unit);
  }
</script>

<div class="duel">
  <div class="duel__field">
    <label class="duel__label" for="duel-value">{t('question.duel_value_label')}</label>
    <input
      id="duel-value"
      class="duel__input"
      type="number"
      inputmode="decimal"
      min="0"
      step="any"
      placeholder={t('question.duel_value_placeholder')}
      bind:value
    />
  </div>

  <div class="duel__field">
    <span class="duel__label">{t('question.duel_unit_label')}</span>
    <div class="duel__unit-grid">
      {#each UNITS as u (u)}
        <button
          type="button"
          class="duel__unit"
          class:duel__unit--selected={unit === u}
          onclick={() => (unit = u)}
        >
          {t(`units.${u}`)}
        </button>
      {/each}
    </div>
  </div>

  <Button variant="primary" fullWidth disabled={!canValidate} onclick={handleValidate}>
    {t('question.validate')}
  </Button>
</div>

<style>
  .duel {
    display: flex;
    flex-direction: column;
    gap: var(--gap-wide);
  }

  .duel__field {
    display: flex;
    flex-direction: column;
    gap: var(--gap-tight);
  }

  .duel__label {
    font-family: var(--font-mono);
    font-size: var(--fs-label);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-mid);
  }

  .duel__input {
    min-height: 3.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--flap);
    color: var(--flap-ink);
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: var(--fs-title);
    border: none;
    border-radius: var(--radius-flap);
    box-shadow: 0 0.125rem 0 var(--hinge);
    text-align: center;
  }

  .duel__input::placeholder {
    color: var(--ink-lo);
  }

  .duel__unit-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--gap-tight);
  }

  @media (min-width: 640px) {
    .duel__unit-grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  @media (min-width: 768px) {
    .duel__unit-grid {
      grid-template-columns: repeat(7, 1fr);
    }
  }

  .duel__unit {
    min-height: var(--touch-min);
    padding: 0.5rem;
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
  }

  .duel__unit--selected {
    background: var(--amber);
    color: var(--amber-ink);
    box-shadow: 0 0.125rem 0 var(--amber-dim);
  }
</style>
