<script lang="ts">
  // Logo (DESIGN_SYSTEM.md §5.8) : le K en palette autonome, posé avant "ombien" en ink-hi.
  import { t } from '../i18n';

  interface Props {
    size?: 'display' | 'title';
  }

  const { size = 'display' }: Props = $props();
</script>

<div class="k-logo k-logo--{size}">
  <span class="k-logo__k" aria-hidden="true">K</span>
  <span class="k-logo__rest">{t('app.name').slice(1)}</span>
</div>

<style>
  .k-logo {
    display: inline-flex;
    align-items: center;
    gap: 0.15em;
    font-family: var(--font-display);
    font-weight: 700;
    letter-spacing: -0.01em;
    color: var(--ink-hi);
  }

  .k-logo__k {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--board-raised);
    color: var(--flap);
    border-radius: var(--radius-flap);
    box-shadow: 0 0.125rem 0 var(--hinge);
    background-image: linear-gradient(
      var(--board-raised) 0 calc(50% - 0.0625rem),
      var(--hinge) 50%,
      var(--board-raised) calc(50% + 0.0625rem) 100%
    );
    width: 1.2em;
    height: 1.2em;
  }

  .k-logo--display {
    font-size: var(--fs-display);
  }

  .k-logo--title {
    font-size: var(--fs-title);
  }
</style>
