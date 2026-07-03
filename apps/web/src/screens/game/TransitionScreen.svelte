<script lang="ts">
  // Écran pass-and-play (DESIGN_SYSTEM.md §5.4) : masque le contenu suivant tant que le
  // bouton n'est pas pressé (anti-triche visuelle). Bandeau de charnière ambre en repère.
  import { t } from '../../lib/i18n';
  import Button from '../../lib/components/Button.svelte';
  import Icon from '../../lib/components/Icon.svelte';

  interface Props {
    pseudo: string;
    role: 'answer' | 'choose_category' | 'estimate';
    onready: () => void;
  }

  const { pseudo, role, onready }: Props = $props();

  const roleKey = $derived(
    role === 'answer' ? 'transition.role_answer' : role === 'choose_category' ? 'transition.role_choose_category' : 'transition.role_estimate',
  );
</script>

<div class="transition">
  <div class="transition__hinge-bar" aria-hidden="true"></div>

  <div class="transition__content">
    <p class="transition__hint">{t('transition.pass_hint')}</p>

    <div class="transition__panel">
      <span class="transition__label">{t('transition.your_turn')}</span>
      <span class="transition__pseudo">{pseudo}</span>
    </div>

    <p class="transition__role">{t(roleKey)}</p>

    <Icon name="hand-tap" size="lg" />
  </div>

  <Button variant="primary" fullWidth onclick={onready}>
    {t('transition.ready')} · {pseudo}
  </Button>
</div>

<style>
  .transition {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: stretch;
    gap: var(--gap-wide);
    padding: var(--gap-wide);
    padding-top: max(var(--gap-wide), env(safe-area-inset-top));
    padding-bottom: max(var(--gap-wide), env(safe-area-inset-bottom));
    background: var(--board);
    width: 100%;
    max-width: 30rem;
    margin: 0 auto;
  }

  .transition__hinge-bar {
    height: 0.25rem;
    background: var(--amber);
    border-radius: var(--radius-pill);
    flex-shrink: 0;
  }

  .transition__content {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--gap);
    text-align: center;
    color: var(--ink-hi);
  }

  .transition__hint {
    color: var(--ink-mid);
    font-family: var(--font-mono);
    font-size: var(--fs-label);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .transition__panel {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: var(--pad-card) var(--gap-wide);
    background: var(--board-raised);
    border-radius: var(--radius-card);
    box-shadow: 0 0.25rem 0 var(--hinge);
  }

  .transition__label {
    font-family: var(--font-display);
    font-size: var(--fs-title);
    font-weight: 700;
    color: var(--amber);
    letter-spacing: 0.02em;
  }

  .transition__pseudo {
    font-family: var(--font-mono);
    font-size: var(--fs-heading);
    font-weight: 700;
    color: var(--ink-hi);
  }

  .transition__role {
    color: var(--ink-mid);
    font-size: var(--fs-lead);
  }
</style>
