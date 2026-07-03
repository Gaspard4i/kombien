<script lang="ts">
  // Mode Binaire (DESIGN_SYSTEM.md §5.5) : deux grands boutons pleine largeur empilés.
  import { t } from '../../lib/i18n';

  interface Props {
    onanswer: (answer: 'yes' | 'no') => void;
  }

  const { onanswer }: Props = $props();
</script>

<div class="binaire">
  <button type="button" class="binaire__btn binaire__btn--yes" onclick={() => onanswer('yes')}>
    {t('question.binaire_yes')}
  </button>
  <button type="button" class="binaire__btn binaire__btn--no" onclick={() => onanswer('no')}>
    {t('question.binaire_no')}
  </button>
</div>

<style>
  .binaire {
    display: flex;
    flex-direction: column;
    gap: var(--gap);
  }

  .binaire__btn {
    min-height: 3.5rem;
    width: 100%;
    padding: 0.75rem 1.25rem;
    border: none;
    border-radius: var(--radius-flap);
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--fs-body);
    letter-spacing: 0.04em;
    cursor: pointer;
    transition: transform var(--dur-quick) var(--ease-flap), box-shadow var(--dur-quick) var(--ease-flap);
  }

  .binaire__btn--yes {
    background: var(--amber);
    color: var(--amber-ink);
    box-shadow: 0 0.1875rem 0 var(--amber-dim);
  }

  .binaire__btn--no {
    background: var(--flap);
    color: var(--flap-ink);
    box-shadow: 0 0.1875rem 0 var(--hinge);
  }

  .binaire__btn:active {
    transform: translateY(0.1875rem);
    box-shadow: 0 0 0 var(--hinge);
  }

  @media (prefers-reduced-motion: reduce) {
    .binaire__btn {
      transition: none;
    }
  }
</style>
