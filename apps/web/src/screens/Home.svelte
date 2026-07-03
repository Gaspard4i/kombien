<script lang="ts">
  import { t } from '../lib/i18n';
  import { navigate } from '../lib/router/router.svelte';
  import AppShell from '../lib/components/AppShell.svelte';
  import KLogo from '../lib/components/KLogo.svelte';
  import Button from '../lib/components/Button.svelte';
  import LangSwitch from '../lib/components/LangSwitch.svelte';
  import Icon from '../lib/components/Icon.svelte';

  interface Props {
    // Fin de partie assouplie (Lot 5 v2, GAME_DESIGN_V2.md §4.2 règle 4) : true si l'arrivée
    // ici suit l'annulation d'une partie interrompue pendant sa toute première manche
    // incomplète (pas d'erreur, juste une information : pas de résultat à afficher).
    cancelledGame?: boolean;
  }

  const { cancelledGame = false }: Props = $props();
</script>

<AppShell>
  <header class="home__header">
    <LangSwitch />
  </header>

  <div class="home__hero">
    <KLogo size="display" />
    <p class="home__subtitle">{t('home.subtitle')}</p>
  </div>

  {#if cancelledGame}
    <div class="home__cancelled" role="status">
      <Icon name="warning" size="md" />
      <span>{t('home.game_cancelled')}</span>
    </div>
  {/if}

  <nav class="home__actions">
    <Button variant="primary" fullWidth onclick={() => navigate({ name: 'setup' })}>
      <Icon name="clock" size="lg" />
      {t('home.play')}
    </Button>
    <Button variant="ghost" fullWidth onclick={() => navigate({ name: 'contribute' })}>
      <Icon name="squares-four" size="md" />
      {t('home.contribute')}
    </Button>
  </nav>
</AppShell>

<style>
  .home__header {
    display: flex;
    justify-content: flex-end;
  }

  .home__hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--gap);
    text-align: center;
    padding: var(--gap-wide) 0;
  }

  .home__subtitle {
    color: var(--ink-mid);
    font-size: var(--fs-lead);
    font-family: var(--font-display);
    max-width: 24rem;
  }

  /* Bandeau d'annonce (pas de texte sur --amber-dim, interdit §2.2) : caisson surélevé,
     charnière ambre en tête, texte crème lisible AA, icône ambre. */
  .home__cancelled {
    display: flex;
    align-items: center;
    gap: var(--gap-tight);
    color: var(--ink-hi);
    background: var(--board-raised);
    border-top: 0.125rem solid var(--amber);
    border-radius: var(--radius-card);
    box-shadow: 0 0.125rem 0 var(--hinge);
    padding: var(--gap) var(--pad-card);
    font-size: var(--fs-body);
    margin-bottom: var(--gap);
  }

  .home__cancelled :global(.icon) {
    color: var(--amber);
    flex-shrink: 0;
  }

  .home__actions {
    display: flex;
    flex-direction: column;
    gap: var(--gap);
  }
</style>
