<script lang="ts">
  // Écran pass-and-play (DESIGN_SYSTEM.md §5.4) : masque le contenu suivant tant que le
  // bouton n'est pas pressé (anti-triche visuelle). Bandeau de charnière ambre en repère.
  import { t } from '../../lib/i18n';
  import Button from '../../lib/components/Button.svelte';
  import Icon from '../../lib/components/Icon.svelte';
  import SplitFlap from '../../lib/components/SplitFlap.svelte';

  interface Props {
    pseudo: string;
    role: 'answer' | 'choose_category' | 'estimate';
    onready: () => void;
  }

  const { pseudo, role, onready }: Props = $props();

  const roleKey = $derived(
    role === 'answer' ? 'transition.role_answer' : role === 'choose_category' ? 'transition.role_choose_category' : 'transition.role_estimate',
  );

  // Le pseudo déroule en palettes (DESIGN_SYSTEM.md §5.4) : le changement de main EST le
  // claquement du tableau qui change d'affichage. MAJUSCULES car les rouleaux ne portent
  // que [0-9 A-Z] (langage split-flap) ; troncature défensive pour ne pas déborder l'écran.
  const flapPseudo = $derived(pseudo.toUpperCase().slice(0, 12));
</script>

<div class="transition">
  <div class="transition__hinge-bar" aria-hidden="true"></div>

  <div class="transition__content">
    <p class="transition__hint">{t('transition.pass_hint')}</p>

    <div class="transition__panel">
      <span class="transition__label">{t('transition.your_turn')}</span>
      <div class="transition__pseudo-board">
        <SplitFlap value={flapPseudo} size="title" stagger={true} spins={8} />
      </div>
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
    align-items: center;
    gap: var(--gap);
    padding: var(--pad-card) var(--gap-wide);
    background: var(--board-raised);
    border-top: 0.125rem solid var(--hinge);
    border-radius: var(--radius-card);
    box-shadow: 0 0.25rem 0 var(--hinge);
    max-width: 100%;
  }

  .transition__label {
    font-family: var(--font-mono);
    font-size: var(--fs-label);
    font-weight: 700;
    color: var(--amber);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  /* Rangée de palettes du pseudo : peut déborder sur les pseudos longs -> défile,
     jamais le body (mobile-first, DESIGN_SYSTEM.md §7). */
  .transition__pseudo-board {
    display: flex;
    justify-content: center;
    max-width: 100%;
    overflow-x: auto;
  }

  .transition__role {
    color: var(--ink-mid);
    font-size: var(--fs-lead);
  }
</style>
