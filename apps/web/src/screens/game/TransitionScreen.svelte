<script lang="ts">
  // Écran pass-and-play (DESIGN_SYSTEM.md §5.4) : masque le contenu suivant tant que le
  // joueur n'a pas confirmé être prêt (anti-triche visuelle). Bandeau de charnière ambre en
  // repère. v2.1 : TOUT l'écran est tapable (pas seulement le bouton, pénible à viser à
  // chaque manche) — le bouton visuel reste affiché comme repère au centre (zone du pouce),
  // mais un tap n'importe où sur l'écran confirme. Reste instantané (pas de délai ajouté),
  // pas de timer ici (le joueur doit pouvoir prendre l'appareil tranquillement, cf
  // GAME_DESIGN_V2.md §9 v2.1 : le timer de réponse ne s'applique qu'à l'écran de réponse).
  import { t } from '../../lib/i18n';
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

  function handleKeydown(event: KeyboardEvent): void {
    // Le rôle "button" natif gère déjà Enter/Espace au clic, mais un <div role="button">
    // ne le fait pas nativement : on le reproduit explicitement (WAI-ARIA button pattern).
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onready();
    }
  }
</script>

<div
  class="transition"
  role="button"
  tabindex="0"
  aria-label={`${t('transition.ready')} · ${pseudo} — ${t(roleKey)}`}
  onclick={onready}
  onkeydown={handleKeydown}
>
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

    <!-- Repère visuel central (zone du pouce) : le tap sur TOUT l'écran confirme déjà (voir
         le div racine), ce bouton n'est qu'un affordance visuelle, pas un second élément
         interactif (aria-hidden : évite un doublon dans l'arbre d'accessibilité). -->
    <div class="transition__cta" aria-hidden="true">
      <Icon name="hand-tap" size="lg" />
      <span class="transition__cta-label">{t('transition.ready')}</span>
    </div>
  </div>
</div>

<style>
  .transition {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: stretch;
    gap: var(--gap-wide);
    padding: var(--gap-wide);
    padding-top: max(var(--gap-wide), env(safe-area-inset-top));
    padding-bottom: max(var(--gap-wide), env(safe-area-inset-bottom));
    background: var(--board);
    width: 100%;
    max-width: 30rem;
    margin: 0 auto;
    cursor: pointer;
    border: none;
    /* Focus clavier visible (WCAG 2.4.7) : liseré ambre, jamais supprimé silencieusement. */
  }

  .transition:focus-visible {
    outline: 0.1875rem solid var(--amber);
    outline-offset: -0.1875rem;
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
    gap: var(--gap-wide);
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

  /* Repère central (zone du pouce, §100 du cahier v2.1) : gros bouton visuel, MAIS purement
     décoratif (le vrai déclencheur est le div racine tapable, aria-hidden ci-dessus). Palette
     ambre pleine largeur, cible tactile largement > 44px de haut. */
  .transition__cta {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--gap-tight);
    width: 100%;
    min-height: 5rem;
    padding: var(--gap-wide);
    background: var(--amber);
    color: var(--amber-ink);
    border-radius: var(--radius-flap);
    box-shadow: 0 0.1875rem 0 var(--amber-dim);
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--fs-lead);
    letter-spacing: 0.04em;
    transition: transform var(--dur-quick) var(--ease-flap), box-shadow var(--dur-quick) var(--ease-flap);
  }

  .transition:active .transition__cta {
    transform: translateY(0.1875rem);
    box-shadow: 0 0 0 var(--amber-dim);
  }

  @media (prefers-reduced-motion: reduce) {
    .transition__cta {
      transition: none;
    }
  }
</style>
