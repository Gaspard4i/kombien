<script lang="ts">
  // Création d'une room multi-écrans (Lot 9) : choix mode + thèmes + timer, POST /rooms,
  // puis affichage du code + QR (lobby). Contrairement au pass-and-play, le protocole room
  // ne connaît qu'une seule liste de catégories (union, cf API_CONTRACT.md POST /rooms) —
  // pas les 5 modes de sélection de thème du pass-and-play (ThemeSelect.svelte), qui n'ont de
  // sens que pour la logique de rotation/vote propre au même appareil.
  import { onMount } from 'svelte';
  import { t, getLang } from '../../lib/i18n';
  import { navigate } from '../../lib/router/router.svelte';
  import { getCategories, createRoom, ApiError } from '../../lib/api/client';
  import type { Category } from '../../lib/api/types';
  import type { GameMode } from '../../lib/domain/scoring';
  import AppShell from '../../lib/components/AppShell.svelte';
  import Card from '../../lib/components/Card.svelte';
  import Button from '../../lib/components/Button.svelte';
  import Skeleton from '../../lib/components/Skeleton.svelte';
  import ErrorMessage from '../../lib/components/ErrorMessage.svelte';
  import Icon from '../../lib/components/Icon.svelte';
  import RoomLobby from './RoomLobby.svelte';

  const MODES: GameMode[] = ['binaire', 'ordre_de_grandeur', 'duel'];
  const QUESTION_COUNT_OPTIONS = [5, 10, 15];
  const TIMER_OPTIONS = [10, 15, 20];
  const DEFAULT_QUESTION_COUNT = 10;
  const DEFAULT_TIMER_SECONDS = 10;

  let mode = $state<GameMode | null>(null);
  let categories = $state<Category[]>([]);
  let selectedSlugs = $state<string[]>([]);
  let questionCount = $state(DEFAULT_QUESTION_COUNT);
  let timerSeconds = $state(DEFAULT_TIMER_SECONDS);
  let loadingCategories = $state(true);
  let loadError = $state<string | null>(null);
  let formError = $state<string | null>(null);
  let submitting = $state(false);
  let createdCode = $state<string | null>(null);
  let createdQr = $state<string | null>(null);

  onMount(async () => {
    try {
      categories = await getCategories();
    } catch (err) {
      loadError = err instanceof ApiError ? t(`errors.${err.code}`) : t('errors.unknown_error');
    } finally {
      loadingCategories = false;
    }
  });

  function toggleCategory(slug: string): void {
    selectedSlugs = selectedSlugs.includes(slug)
      ? selectedSlugs.filter((s) => s !== slug)
      : [...selectedSlugs, slug];
  }

  function validate(): string | null {
    if (!mode) return t('setup.errors.mode_required');
    if (selectedSlugs.length === 0) return t('room.create.category_hint');
    return null;
  }

  async function handleSubmit(): Promise<void> {
    formError = validate();
    if (formError) return;

    submitting = true;
    try {
      const result = await createRoom({
        categorySlugs: selectedSlugs,
        mode: mode!,
        questionCount,
        timerSeconds,
      });
      createdCode = result.code;
      createdQr = result.qr;
    } catch (err) {
      formError = err instanceof ApiError ? t(`errors.${err.code}`) : t('room.create.error');
    } finally {
      submitting = false;
    }
  }
</script>

{#if createdCode}
  <RoomLobby code={createdCode} qr={createdQr} isCreator />
{:else}
  <AppShell>
    <header class="room-create__header">
      <Button variant="ghost" onclick={() => navigate({ name: 'home' })}>
        <Icon name="caret-left" size="md" />
        {t('nav.back')}
      </Button>
    </header>

    <h1 class="room-create__title">{t('room.create.title')}</h1>

    <section class="room-create__section">
      <h2 class="room-create__section-title">{t('room.create.mode_title')}</h2>
      <div class="room-create__mode-list">
        {#each MODES as m (m)}
          <button
            type="button"
            class="room-create__mode"
            class:room-create__mode--selected={mode === m}
            onclick={() => (mode = m)}
          >
            <span class="room-create__mode-name">{t(`modes.${m}`)}</span>
            <span class="room-create__mode-desc">{t(`modes.${m}_desc`)}</span>
          </button>
        {/each}
      </div>
      {#if mode === 'binaire'}
        <p class="room-create__hint">{t('room.calibration_note')}</p>
      {/if}
    </section>

    <section class="room-create__section">
      <h2 class="room-create__section-title">{t('room.create.category_title')}</h2>
      {#if loadingCategories}
        <Skeleton rows={3} />
      {:else if loadError}
        <ErrorMessage message={loadError} />
      {:else}
        <Card>
          <div class="room-create__category-grid">
            {#each categories as category (category.id)}
              <button
                type="button"
                class="room-create__category"
                class:room-create__category--selected={selectedSlugs.includes(category.slug)}
                onclick={() => toggleCategory(category.slug)}
              >
                {getLang() === 'en' ? category.name_en : category.name_fr}
              </button>
            {/each}
          </div>
          {#if selectedSlugs.length === 0}
            <p class="room-create__hint">{t('room.create.category_hint')}</p>
          {/if}
        </Card>
      {/if}
    </section>

    <section class="room-create__section">
      <h2 class="room-create__section-title">{t('room.create.question_count_title')}</h2>
      <div class="room-create__option-row">
        {#each QUESTION_COUNT_OPTIONS as option (option)}
          <button
            type="button"
            class="room-create__option"
            class:room-create__option--selected={questionCount === option}
            onclick={() => (questionCount = option)}
          >
            {option}
          </button>
        {/each}
      </div>
    </section>

    <section class="room-create__section">
      <h2 class="room-create__section-title">{t('room.create.timer_title')}</h2>
      <div class="room-create__option-row">
        {#each TIMER_OPTIONS as option (option)}
          <button
            type="button"
            class="room-create__option"
            class:room-create__option--selected={timerSeconds === option}
            onclick={() => (timerSeconds = option)}
          >
            {t('game.timer_seconds', { seconds: option })}
          </button>
        {/each}
      </div>
    </section>

    {#if formError}
      <ErrorMessage message={formError} />
    {/if}

    <Button variant="primary" fullWidth disabled={submitting} onclick={handleSubmit}>
      <Icon name="squares-four" size="md" />
      {submitting ? t('room.create.submitting') : t('room.create.submit')}
    </Button>
  </AppShell>
{/if}

<style>
  .room-create__header {
    display: flex;
  }

  .room-create__title {
    font-family: var(--font-display);
    font-size: var(--fs-title);
    font-weight: 700;
    color: var(--ink-hi);
  }

  .room-create__section {
    display: flex;
    flex-direction: column;
    gap: var(--gap);
  }

  .room-create__section-title {
    font-family: var(--font-display);
    font-size: var(--fs-heading);
    font-weight: 500;
    color: var(--ink-hi);
  }

  .room-create__mode-list {
    display: flex;
    flex-direction: column;
    gap: var(--gap-tight);
  }

  .room-create__mode {
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

  .room-create__mode--selected {
    border-color: var(--amber);
    box-shadow: 0 0 0 1px var(--amber);
  }

  .room-create__mode-name {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--fs-body);
  }

  .room-create__mode-desc {
    font-size: var(--fs-micro);
    color: var(--ink-mid);
  }

  .room-create__category-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--gap-tight);
  }

  .room-create__category {
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

  .room-create__category--selected {
    background: var(--amber);
    color: var(--amber-ink);
    box-shadow: 0 0.125rem 0 var(--amber-dim);
  }

  .room-create__hint {
    margin: 0;
    font-size: var(--fs-micro);
    color: var(--ink-mid);
  }

  .room-create__option-row {
    display: flex;
    gap: var(--gap-tight);
  }

  .room-create__option {
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

  .room-create__option--selected {
    background: var(--amber);
    color: var(--amber-ink);
    box-shadow: 0 0.125rem 0 var(--amber-dim);
  }
</style>
