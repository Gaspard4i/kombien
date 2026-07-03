<script lang="ts">
  import { t } from '../lib/i18n';
  import { navigate } from '../lib/router/router.svelte';
  import AppShell from '../lib/components/AppShell.svelte';
  import KLogo from '../lib/components/KLogo.svelte';
  import Button from '../lib/components/Button.svelte';
  import LangSwitch from '../lib/components/LangSwitch.svelte';
  import Icon from '../lib/components/Icon.svelte';
</script>

<AppShell>
  <header class="home__header">
    <LangSwitch />
  </header>

  <div class="home__hero">
    <KLogo size="display" />
    <p class="home__subtitle">{t('home.subtitle')}</p>
  </div>

  <nav class="home__actions">
    <Button variant="primary" fullWidth onclick={() => navigate({ name: 'setup' })}>
      <Icon name="clock" size="lg" />
      {t('home.play')}
    </Button>
    <Button variant="secondary" fullWidth onclick={() => navigate({ name: 'leaderboard' })}>
      <Icon name="stack" size="md" />
      {t('home.leaderboard')}
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

  .home__actions {
    display: flex;
    flex-direction: column;
    gap: var(--gap);
  }
</style>
