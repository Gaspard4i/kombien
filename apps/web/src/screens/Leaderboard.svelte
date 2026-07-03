<script lang="ts">
  // Classement (API_CONTRACT.md) : global (XP) par défaut, ou par catégorie (score cumulé)
  // via un sélecteur de catégorie. Chargement/erreur/vide explicites (CLAUDE.md).
  import { onMount } from 'svelte';
  import { t, getLang } from '../lib/i18n';
  import { navigate } from '../lib/router/router.svelte';
  import { getCategories, getLeaderboardGlobal, getLeaderboardByCategory, ApiError } from '../lib/api/client';
  import type { Category, LeaderboardGlobalEntry, LeaderboardCategoryEntry } from '../lib/api/types';
  import AppShell from '../lib/components/AppShell.svelte';
  import Card from '../lib/components/Card.svelte';
  import Button from '../lib/components/Button.svelte';
  import Skeleton from '../lib/components/Skeleton.svelte';
  import ErrorMessage from '../lib/components/ErrorMessage.svelte';
  import Icon from '../lib/components/Icon.svelte';

  type View = 'global' | 'category';

  let view = $state<View>('global');
  let categories = $state<Category[]>([]);
  let selectedCategorySlug = $state<string | null>(null);
  let globalEntries = $state<LeaderboardGlobalEntry[]>([]);
  let categoryEntries = $state<LeaderboardCategoryEntry[]>([]);
  let loading = $state(true);
  let loadError = $state<string | null>(null);

  onMount(async () => {
    try {
      categories = await getCategories();
      globalEntries = await getLeaderboardGlobal();
    } catch (err) {
      loadError = err instanceof ApiError ? t(`errors.${err.code}`) : t('errors.unknown_error');
    } finally {
      loading = false;
    }
  });

  async function selectView(next: View): Promise<void> {
    view = next;
    if (next === 'category' && !selectedCategorySlug && categories.length > 0) {
      selectedCategorySlug = categories[0].slug;
      await loadCategoryEntries(selectedCategorySlug);
    }
  }

  async function loadCategoryEntries(slug: string): Promise<void> {
    loading = true;
    loadError = null;
    try {
      categoryEntries = await getLeaderboardByCategory(slug);
    } catch (err) {
      loadError = err instanceof ApiError ? t(`errors.${err.code}`) : t('errors.unknown_error');
    } finally {
      loading = false;
    }
  }

  function handleCategoryChange(slug: string): void {
    selectedCategorySlug = slug;
    loadCategoryEntries(slug);
  }
</script>

<AppShell>
  <header class="leaderboard__header">
    <Button variant="ghost" onclick={() => navigate({ name: 'home' })}>
      <Icon name="caret-left" size="md" />
      {t('nav.back')}
    </Button>
  </header>

  <h1 class="leaderboard__title">{t('leaderboard.title')}</h1>

  <div class="leaderboard__tabs">
    <button
      type="button"
      class="leaderboard__tab"
      class:leaderboard__tab--selected={view === 'global'}
      onclick={() => selectView('global')}
    >
      {t('leaderboard.global')}
    </button>
    <button
      type="button"
      class="leaderboard__tab"
      class:leaderboard__tab--selected={view === 'category'}
      onclick={() => selectView('category')}
    >
      {t('leaderboard.by_category')}
    </button>
  </div>

  {#if view === 'category' && categories.length > 0}
    <div class="leaderboard__category-select">
      {#each categories as category (category.id)}
        <button
          type="button"
          class="leaderboard__category-option"
          class:leaderboard__category-option--selected={selectedCategorySlug === category.slug}
          onclick={() => handleCategoryChange(category.slug)}
        >
          {getLang() === 'en' ? category.name_en : category.name_fr}
        </button>
      {/each}
    </div>
  {/if}

  {#if loading}
    <Skeleton rows={5} />
  {:else if loadError}
    <ErrorMessage message={loadError} />
  {:else if view === 'global'}
    {#if globalEntries.length === 0}
      <p class="leaderboard__empty">{t('leaderboard.empty')}</p>
    {:else}
      <Card>
        <ol class="leaderboard__list">
          {#each globalEntries as entry, i (entry.pseudo)}
            <li class="leaderboard__row">
              <span class="leaderboard__rank">{t('leaderboard.rank', { value: i + 1 })}</span>
              <button type="button" class="leaderboard__pseudo" onclick={() => navigate({ name: 'profile', pseudo: entry.pseudo })}>
                {entry.pseudo}
              </button>
              <span class="leaderboard__value" data-numeric>{entry.xp} {t('leaderboard.xp')}</span>
              <span class="leaderboard__level" data-numeric>{t('end.level', { value: entry.level })}</span>
            </li>
          {/each}
        </ol>
      </Card>
    {/if}
  {:else if categoryEntries.length === 0}
    <p class="leaderboard__empty">{t('leaderboard.empty')}</p>
  {:else}
    <Card>
      <ol class="leaderboard__list">
        {#each categoryEntries as entry, i (entry.pseudo)}
          <li class="leaderboard__row">
            <span class="leaderboard__rank">{t('leaderboard.rank', { value: i + 1 })}</span>
            <button type="button" class="leaderboard__pseudo" onclick={() => navigate({ name: 'profile', pseudo: entry.pseudo })}>
              {entry.pseudo}
            </button>
            <span class="leaderboard__value" data-numeric>{entry.total_score} {t('leaderboard.score')}</span>
          </li>
        {/each}
      </ol>
    </Card>
  {/if}
</AppShell>

<style>
  .leaderboard__header {
    display: flex;
  }

  .leaderboard__title {
    font-family: var(--font-display);
    font-size: var(--fs-title);
    font-weight: 700;
    color: var(--ink-hi);
  }

  .leaderboard__tabs {
    display: flex;
    gap: var(--gap-tight);
  }

  .leaderboard__tab {
    flex: 1;
    min-height: var(--touch-min);
    background: var(--board-raised);
    color: var(--ink-mid);
    border: 1px solid var(--ink-lo);
    border-radius: var(--radius-card);
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--fs-body);
    cursor: pointer;
  }

  .leaderboard__tab--selected {
    border-color: var(--amber);
    color: var(--amber);
  }

  .leaderboard__category-select {
    display: flex;
    flex-wrap: wrap;
    gap: var(--gap-tight);
  }

  .leaderboard__category-option {
    min-height: var(--touch-min);
    padding: 0.5rem 0.75rem;
    background: var(--flap);
    color: var(--flap-ink);
    font-family: var(--font-mono);
    font-size: var(--fs-label);
    border: none;
    border-radius: var(--radius-pill);
    box-shadow: 0 0.125rem 0 var(--hinge);
    cursor: pointer;
  }

  .leaderboard__category-option--selected {
    background: var(--amber);
    color: var(--amber-ink);
  }

  .leaderboard__empty {
    color: var(--ink-mid);
    text-align: center;
    font-size: var(--fs-body);
  }

  .leaderboard__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--gap-tight);
  }

  .leaderboard__row {
    display: flex;
    align-items: center;
    gap: var(--gap-tight);
  }

  .leaderboard__rank {
    font-family: var(--font-mono);
    font-weight: 700;
    color: var(--ink-mid);
    min-width: 2.5rem;
  }

  .leaderboard__pseudo {
    flex: 1;
    text-align: left;
    background: none;
    border: none;
    color: var(--ink-hi);
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--fs-body);
    cursor: pointer;
    min-height: var(--touch-min);
    padding: 0;
  }

  .leaderboard__pseudo:hover {
    color: var(--amber);
  }

  .leaderboard__value {
    font-family: var(--font-mono);
    color: var(--ink-hi);
  }

  .leaderboard__level {
    font-family: var(--font-mono);
    color: var(--ink-mid);
    font-size: var(--fs-micro);
  }
</style>
