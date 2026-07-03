<script lang="ts">
  // Écran de mise en place (GAME_DESIGN.md §9.1) : pseudos, mode, catégorie, condition de fin.
  // startGame() initialise le gameStore puis on navigue vers l'écran de jeu qui tire les
  // questions de la première manche.
  import { onMount } from 'svelte';
  import { t, getLang } from '../lib/i18n';
  import { navigate } from '../lib/router/router.svelte';
  import { getCategories } from '../lib/api/client';
  import { ApiError } from '../lib/api/client';
  import type { Category } from '../lib/api/types';
  import type { GameMode } from '../lib/domain/scoring';
  import { startGame, type EndCondition } from '../lib/stores/gameStore.svelte';
  import AppShell from '../lib/components/AppShell.svelte';
  import Card from '../lib/components/Card.svelte';
  import Button from '../lib/components/Button.svelte';
  import Skeleton from '../lib/components/Skeleton.svelte';
  import ErrorMessage from '../lib/components/ErrorMessage.svelte';
  import Icon from '../lib/components/Icon.svelte';

  const MODES: GameMode[] = ['binaire', 'ordre_de_grandeur', 'duel'];
  const TARGET_SCORE_OPTIONS = [30, 50, 100];
  const QUESTIONS_PER_ROUND = 5;

  let pseudoA = $state('');
  let pseudoB = $state('');
  let mode = $state<GameMode | null>(null);
  let categories = $state<Category[]>([]);
  let selectedCategorySlug = $state<string | null>(null);
  let endCondition = $state<EndCondition>('points');
  let targetScore = $state(50);
  let loadingCategories = $state(true);
  let loadError = $state<string | null>(null);
  let formError = $state<string | null>(null);

  onMount(async () => {
    try {
      categories = await getCategories();
    } catch (err) {
      loadError = err instanceof ApiError ? t(`errors.${err.code}`) : t('errors.unknown_error');
    } finally {
      loadingCategories = false;
    }
  });

  function validate(): string | null {
    const a = pseudoA.trim();
    const b = pseudoB.trim();
    if (!a || !b) return t('setup.errors.pseudo_required');
    if (a.toLowerCase() === b.toLowerCase()) return t('setup.errors.pseudo_same');
    if (!mode) return t('setup.errors.mode_required');
    if (!selectedCategorySlug) return t('setup.errors.category_required');
    return null;
  }

  function handleStart(): void {
    formError = validate();
    if (formError) return;

    const category = categories.find((c) => c.slug === selectedCategorySlug)!;
    startGame(
      {
        mode: mode!,
        category,
        endCondition,
        targetScore,
        questionsPerRound: QUESTIONS_PER_ROUND,
      },
      pseudoA.trim(),
      pseudoB.trim(),
    );
    navigate({ name: 'game' });
  }
</script>

<AppShell>
  <header class="setup__header">
    <Button variant="ghost" onclick={() => navigate({ name: 'home' })}>
      <Icon name="caret-left" size="md" />
      {t('nav.back')}
    </Button>
  </header>

  <h1 class="setup__title">{t('setup.title')}</h1>

  <Card>
    <div class="setup__field">
      <label class="setup__label" for="pseudo-a">{t('setup.player_a_label')}</label>
      <input
        id="pseudo-a"
        class="setup__input"
        type="text"
        maxlength="24"
        placeholder={t('setup.player_a_placeholder')}
        bind:value={pseudoA}
      />
    </div>
    <div class="setup__field">
      <label class="setup__label" for="pseudo-b">{t('setup.player_b_label')}</label>
      <input
        id="pseudo-b"
        class="setup__input"
        type="text"
        maxlength="24"
        placeholder={t('setup.player_b_placeholder')}
        bind:value={pseudoB}
      />
    </div>
  </Card>

  <section class="setup__section">
    <h2 class="setup__section-title">{t('setup.mode_title')}</h2>
    <div class="setup__mode-list">
      {#each MODES as m (m)}
        <button
          type="button"
          class="setup__mode"
          class:setup__mode--selected={mode === m}
          onclick={() => (mode = m)}
        >
          <span class="setup__mode-name">{t(`modes.${m}`)}</span>
          <span class="setup__mode-desc">{t(`modes.${m}_desc`)}</span>
        </button>
      {/each}
    </div>
  </section>

  <section class="setup__section">
    <h2 class="setup__section-title">{t('setup.category_title')}</h2>
    {#if loadingCategories}
      <Skeleton rows={3} />
    {:else if loadError}
      <ErrorMessage message={loadError} />
    {:else if categories.length === 0}
      <p class="setup__empty">{t('setup.category_empty')}</p>
    {:else}
      <div class="setup__category-grid">
        {#each categories as category (category.id)}
          <button
            type="button"
            class="setup__category"
            class:setup__category--selected={selectedCategorySlug === category.slug}
            onclick={() => (selectedCategorySlug = category.slug)}
          >
            {getLang() === 'en' ? category.name_en : category.name_fr}
          </button>
        {/each}
      </div>
    {/if}
  </section>

  <section class="setup__section">
    <h2 class="setup__section-title">{t('setup.end_condition_title')}</h2>
    <div class="setup__end-condition">
      <button
        type="button"
        class="setup__condition"
        class:setup__condition--selected={endCondition === 'points'}
        onclick={() => (endCondition = 'points')}
      >
        <span class="setup__condition-name">{t('setup.end_condition_points')}</span>
        <span class="setup__condition-desc">{t('setup.end_condition_points_desc')}</span>
      </button>
      <button
        type="button"
        class="setup__condition"
        class:setup__condition--selected={endCondition === 'manual'}
        onclick={() => (endCondition = 'manual')}
      >
        <span class="setup__condition-name">{t('setup.end_condition_manual')}</span>
        <span class="setup__condition-desc">{t('setup.end_condition_manual_desc')}</span>
      </button>
    </div>

    {#if endCondition === 'points'}
      <div class="setup__target-score">
        <span class="setup__label">{t('setup.target_score_title')}</span>
        <div class="setup__target-options">
          {#each TARGET_SCORE_OPTIONS as option (option)}
            <button
              type="button"
              class="setup__target"
              class:setup__target--selected={targetScore === option}
              onclick={() => (targetScore = option)}
            >
              {option}
            </button>
          {/each}
        </div>
      </div>
    {/if}
  </section>

  {#if formError}
    <ErrorMessage message={formError} />
  {/if}

  <Button variant="primary" fullWidth onclick={handleStart}>
    <Icon name="clock" size="md" />
    {t('setup.start')}
  </Button>
</AppShell>

<style>
  .setup__header {
    display: flex;
  }

  .setup__title {
    font-family: var(--font-display);
    font-size: var(--fs-title);
    font-weight: 700;
    color: var(--ink-hi);
  }

  .setup__field {
    display: flex;
    flex-direction: column;
    gap: var(--gap-tight);
  }

  .setup__field + .setup__field {
    margin-top: var(--gap);
  }

  .setup__label {
    font-family: var(--font-mono);
    font-size: var(--fs-label);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-mid);
  }

  .setup__input {
    min-height: var(--touch-min);
    padding: 0.5rem 0.75rem;
    background: var(--flap);
    color: var(--flap-ink);
    font-family: var(--font-mono);
    font-size: var(--fs-body);
    border: none;
    border-radius: var(--radius-flap);
    box-shadow: 0 0.125rem 0 var(--hinge);
  }

  .setup__input::placeholder {
    color: var(--ink-lo);
  }

  .setup__section {
    display: flex;
    flex-direction: column;
    gap: var(--gap);
  }

  .setup__section-title {
    font-family: var(--font-display);
    font-size: var(--fs-heading);
    font-weight: 500;
    color: var(--ink-hi);
  }

  .setup__mode-list {
    display: flex;
    flex-direction: column;
    gap: var(--gap-tight);
  }

  .setup__mode {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    align-items: flex-start;
    min-height: var(--touch-min);
    padding: 0.75rem 1rem;
    background: var(--board-raised);
    border: 1px solid var(--ink-lo);
    border-radius: var(--radius-card);
    color: var(--ink-hi);
    text-align: left;
    cursor: pointer;
  }

  .setup__mode--selected {
    border-color: var(--amber);
    box-shadow: 0 0 0 1px var(--amber);
  }

  .setup__mode-name {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--fs-body);
  }

  .setup__mode-desc {
    font-size: var(--fs-micro);
    color: var(--ink-mid);
  }

  .setup__category-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--gap-tight);
  }

  .setup__category {
    min-height: var(--touch-min);
    padding: 0.5rem 0.75rem;
    background: var(--flap);
    color: var(--flap-ink);
    font-family: var(--font-mono);
    font-size: var(--fs-body);
    border: none;
    border-radius: var(--radius-flap);
    box-shadow: 0 0.125rem 0 var(--hinge);
    cursor: pointer;
  }

  .setup__category--selected {
    background: var(--amber);
    color: var(--amber-ink);
    box-shadow: 0 0.125rem 0 var(--amber-dim);
  }

  .setup__empty {
    color: var(--ink-mid);
    font-size: var(--fs-body);
  }

  .setup__end-condition {
    display: flex;
    flex-direction: column;
    gap: var(--gap-tight);
  }

  .setup__condition {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    align-items: flex-start;
    min-height: var(--touch-min);
    padding: 0.75rem 1rem;
    background: var(--board-raised);
    border: 1px solid var(--ink-lo);
    border-radius: var(--radius-card);
    color: var(--ink-hi);
    text-align: left;
    cursor: pointer;
  }

  .setup__condition--selected {
    border-color: var(--amber);
    box-shadow: 0 0 0 1px var(--amber);
  }

  .setup__condition-name {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--fs-body);
  }

  .setup__condition-desc {
    font-size: var(--fs-micro);
    color: var(--ink-mid);
  }

  .setup__target-score {
    display: flex;
    flex-direction: column;
    gap: var(--gap-tight);
  }

  .setup__target-options {
    display: flex;
    gap: var(--gap-tight);
  }

  .setup__target {
    flex: 1;
    min-height: var(--touch-min);
    background: var(--flap);
    color: var(--flap-ink);
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: var(--fs-body);
    border: none;
    border-radius: var(--radius-flap);
    box-shadow: 0 0.125rem 0 var(--hinge);
    cursor: pointer;
  }

  .setup__target--selected {
    background: var(--amber);
    color: var(--amber-ink);
    box-shadow: 0 0.125rem 0 var(--amber-dim);
  }
</style>
