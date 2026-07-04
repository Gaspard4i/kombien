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
  import {
    startGame,
    isDifferentiationForced,
    type EndCondition,
    type ThemeSelection,
  } from '../lib/stores/gameStore.svelte';
  import AppShell from '../lib/components/AppShell.svelte';
  import Card from '../lib/components/Card.svelte';
  import Button from '../lib/components/Button.svelte';
  import Skeleton from '../lib/components/Skeleton.svelte';
  import ErrorMessage from '../lib/components/ErrorMessage.svelte';
  import Icon from '../lib/components/Icon.svelte';
  import ThemeSelect from '../lib/components/ThemeSelect.svelte';

  const MODES: GameMode[] = ['binaire', 'ordre_de_grandeur', 'duel'];
  const TARGET_SCORE_OPTIONS = [30, 50, 100];
  const MIN_PLAYERS = 2;
  const MAX_PLAYERS = 8;
  // Timer de réponse pass-and-play (v2.1) : null = pas de limite. Défaut 5s (option la
  // plus courte proposée, cohérente avec la demande utilisateur).
  const ANSWER_TIMER_OPTIONS: (number | null)[] = [5, 10, 15, null];
  const DEFAULT_ANSWER_TIMER = 5;

  let pseudos = $state<string[]>(['', '']);
  let mode = $state<GameMode | null>(null);
  let categories = $state<Category[]>([]);
  let selectedCategorySlug = $state<string | null>(null);
  let themeSelection = $state<ThemeSelection>({ mode: 'rotation' });
  // Questions différenciées (Lot 3, GAME_DESIGN_V2.md §5.1) : option indépendante du mode de
  // thème, sauf 'per_player' où elle est obligatoire (isDifferentiationForced) — cf. l'effet
  // ci-dessous qui la verrouille à true dans ce cas.
  let differentiatedQuestions = $state(false);
  let answerTimerSeconds = $state<number | null>(DEFAULT_ANSWER_TIMER);
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

  // Verrouillée à true en mode 'per_player' (GAME_DESIGN_V2.md §2.4) : les pools diffèrent
  // déjà par joueur, "questions communes" n'a pas de sens. Le toggle reste visible mais
  // désactivé pour ne pas laisser croire à un choix possible (cf. rendu ci-dessous).
  const differentiationForced = $derived(isDifferentiationForced(themeSelection));

  $effect(() => {
    if (differentiationForced) differentiatedQuestions = true;
  });

  function addPlayer(): void {
    if (pseudos.length >= MAX_PLAYERS) return;
    pseudos.push('');
  }

  function removePlayer(index: number): void {
    if (pseudos.length <= MIN_PLAYERS) return;
    pseudos.splice(index, 1);
  }

  function validateThemeSelection(): string | null {
    switch (themeSelection.mode) {
      case 'rotation':
        return selectedCategorySlug ? null : t('setup.errors.category_required');
      case 'global':
      case 'vote':
        return themeSelection.fixedCategory ? null : t('theme_select.errors.category_required');
      case 'multi':
        return (themeSelection.multiCategories?.length ?? 0) > 0
          ? null
          : t('theme_select.errors.multi_min_one');
      case 'per_player':
        return pseudos.every((_, i) => (themeSelection.perPlayerCategories?.[i]?.length ?? 0) > 0)
          ? null
          : t('theme_select.errors.per_player_min_one');
    }
  }

  function validate(): string | null {
    const trimmed = pseudos.map((p) => p.trim());
    if (trimmed.length < MIN_PLAYERS) return t('setup.errors.min_players');
    if (trimmed.some((p) => !p)) return t('setup.errors.pseudo_required');
    const lowered = trimmed.map((p) => p.toLowerCase());
    if (new Set(lowered).size !== lowered.length) return t('setup.errors.pseudo_same');
    if (!mode) return t('setup.errors.mode_required');
    return validateThemeSelection();
  }

  function handleStart(): void {
    formError = validate();
    if (formError) return;

    // Manche 1 : n'a de sens qu'en mode rotation (les autres modes tirent leur pool
    // depuis themeSelection, jamais de ce champ ponctuel — cf gameStore.GameConfig).
    const category =
      themeSelection.mode === 'rotation'
        ? categories.find((c) => c.slug === selectedCategorySlug)!
        : (themeSelection.fixedCategory ?? themeSelection.multiCategories?.[0] ?? categories[0]!);

    startGame(
      {
        mode: mode!,
        category,
        themeSelection,
        endCondition,
        targetScore,
        differentiatedQuestions: differentiationForced || differentiatedQuestions,
        answerTimerSeconds,
      },
      pseudos.map((p) => p.trim()),
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
    <h2 class="setup__section-title setup__players-title">{t('setup.players_title')}</h2>
    {#each pseudos as _, i (i)}
      <div class="setup__field setup__player-field">
        <div class="setup__player-row">
          <label class="setup__label" for={`pseudo-${i}`}>{t('setup.player_label', { number: i + 1 })}</label>
          {#if pseudos.length > MIN_PLAYERS}
            <button
              type="button"
              class="setup__remove-player"
              aria-label={t('setup.remove_player')}
              onclick={() => removePlayer(i)}
            >
              <Icon name="minus" size="sm" />
            </button>
          {/if}
        </div>
        <input
          id={`pseudo-${i}`}
          class="setup__input"
          type="text"
          maxlength="24"
          placeholder={t('setup.player_placeholder', { number: i + 1 })}
          bind:value={pseudos[i]}
        />
      </div>
    {/each}

    {#if pseudos.length < MAX_PLAYERS}
      <button type="button" class="setup__add-player" onclick={addPlayer}>
        <Icon name="plus" size="sm" />
        {t('setup.add_player')}
      </button>
    {/if}
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
    {#if loadingCategories}
      <h2 class="setup__section-title">{t('setup.category_title')}</h2>
      <Skeleton rows={3} />
    {:else if loadError}
      <h2 class="setup__section-title">{t('setup.category_title')}</h2>
      <ErrorMessage message={loadError} />
    {:else if categories.length === 0}
      <h2 class="setup__section-title">{t('setup.category_title')}</h2>
      <p class="setup__empty">{t('setup.category_empty')}</p>
    {:else}
      {#if themeSelection.mode === 'rotation'}
        <h2 class="setup__section-title">{t('setup.category_title')}</h2>
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
      <ThemeSelect
        {categories}
        pseudos={pseudos.map((p) => p.trim())}
        selection={themeSelection}
        onchange={(next) => (themeSelection = next)}
      />
      <button
        type="button"
        class="setup__differentiated"
        class:setup__differentiated--selected={differentiatedQuestions}
        disabled={differentiationForced}
        onclick={() => (differentiatedQuestions = !differentiatedQuestions)}
      >
        <span class="setup__differentiated-name">{t('setup.differentiated_questions')}</span>
        <span class="setup__differentiated-desc">
          {t(differentiationForced ? 'setup.differentiated_questions_forced' : 'setup.differentiated_questions_desc')}
        </span>
      </button>
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

  <section class="setup__section">
    <h2 class="setup__section-title">{t('setup.answer_timer_title')}</h2>
    <p class="setup__hint">{t('setup.answer_timer_desc')}</p>
    <div class="setup__timer-options">
      {#each ANSWER_TIMER_OPTIONS as option (option ?? 'off')}
        <button
          type="button"
          class="setup__timer"
          class:setup__timer--selected={answerTimerSeconds === option}
          onclick={() => (answerTimerSeconds = option)}
        >
          {option === null ? t('setup.answer_timer_off') : t('game.timer_seconds', { seconds: option })}
        </button>
      {/each}
    </div>
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

  .setup__players-title {
    margin-bottom: var(--gap);
  }

  .setup__player-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--gap-tight);
  }

  .setup__remove-player {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--touch-min);
    height: var(--touch-min);
    background: var(--flap);
    color: var(--flap-ink);
    border: none;
    border-radius: var(--radius-flap);
    box-shadow: 0 0.125rem 0 var(--hinge);
    cursor: pointer;
    flex-shrink: 0;
  }

  .setup__add-player {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    min-height: var(--touch-min);
    width: 100%;
    margin-top: var(--gap);
    padding: 0.5rem 0.75rem;
    background: transparent;
    color: var(--amber);
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: var(--fs-body);
    border: 1px dashed var(--amber-dim);
    border-radius: var(--radius-card);
    cursor: pointer;
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

  .setup__differentiated {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    align-items: flex-start;
    min-height: var(--touch-min);
    padding: 0.75rem 1rem;
    margin-top: var(--gap-tight);
    background: var(--board-raised);
    border: 1px solid var(--ink-lo);
    border-radius: var(--radius-card);
    color: var(--ink-hi);
    text-align: left;
    cursor: pointer;
  }

  .setup__differentiated:disabled {
    cursor: default;
    opacity: 0.7;
  }

  .setup__differentiated--selected {
    border-color: var(--amber);
    box-shadow: 0 0 0 1px var(--amber);
  }

  .setup__differentiated-name {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--fs-body);
  }

  .setup__differentiated-desc {
    font-size: var(--fs-micro);
    color: var(--ink-mid);
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

  .setup__hint {
    margin: 0;
    font-size: var(--fs-micro);
    color: var(--ink-mid);
  }

  .setup__timer-options {
    display: flex;
    flex-wrap: wrap;
    gap: var(--gap-tight);
  }

  .setup__timer {
    flex: 1;
    min-width: 4.5rem;
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

  .setup__timer--selected {
    background: var(--amber);
    color: var(--amber-ink);
    box-shadow: 0 0.125rem 0 var(--amber-dim);
  }
</style>
