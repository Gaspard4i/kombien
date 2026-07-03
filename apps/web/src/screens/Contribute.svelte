<script lang="ts">
  // Formulaire de contribution (API_CONTRACT.md POST /questions) : catégorie existante ou
  // nouvelle (avec noms fr/en requis dans ce cas). Validation avant envoi, messages i18n.
  import { onMount } from 'svelte';
  import { t } from '../lib/i18n';
  import { navigate } from '../lib/router/router.svelte';
  import { getCategories, createQuestion, ApiError } from '../lib/api/client';
  import type { Category } from '../lib/api/types';
  import { UNITS, type Unit } from '../lib/domain/units';
  import { getLang } from '../lib/i18n';
  import AppShell from '../lib/components/AppShell.svelte';
  import Card from '../lib/components/Card.svelte';
  import Button from '../lib/components/Button.svelte';
  import Skeleton from '../lib/components/Skeleton.svelte';
  import ErrorMessage from '../lib/components/ErrorMessage.svelte';
  import Icon from '../lib/components/Icon.svelte';

  let categories = $state<Category[]>([]);
  let loadingCategories = $state(true);
  let loadError = $state<string | null>(null);

  let textFr = $state('');
  let textEn = $state('');
  // bind:value sur un <input type="number"> coerce en number (undefined si vide/invalide) :
  // https://svelte.dev/docs/svelte/bind — un $state('') désynchronise le binding.
  let duration = $state<number | undefined>(undefined);
  let unit = $state<Unit>('minute');
  let categoryMode = $state<'existing' | 'new'>('existing');
  let categorySlug = $state<string | null>(null);
  let categoryNameFr = $state('');
  let categoryNameEn = $state('');

  let formError = $state<string | null>(null);
  let submitting = $state(false);
  let success = $state(false);

  onMount(async () => {
    try {
      categories = await getCategories();
      if (categories.length > 0) categorySlug = categories[0].slug;
    } catch (err) {
      loadError = err instanceof ApiError ? t(`errors.${err.code}`) : t('errors.unknown_error');
    } finally {
      loadingCategories = false;
    }
  });

  function validate(): string | null {
    if (!textFr.trim()) return t('contribute.errors.text_fr_required');
    if (!(duration !== undefined && duration > 0)) return t('contribute.errors.duration_required');
    if (!UNITS.includes(unit)) return t('contribute.errors.unit_required');
    if (categoryMode === 'existing' && !categorySlug) return t('contribute.errors.category_required');
    if (categoryMode === 'new' && (!categoryNameFr.trim() || !categoryNameEn.trim())) {
      return t('contribute.errors.category_names_required');
    }
    return null;
  }

  function resetForm(): void {
    textFr = '';
    textEn = '';
    duration = undefined;
    unit = 'minute';
    categoryNameFr = '';
    categoryNameEn = '';
  }

  async function handleSubmit(): Promise<void> {
    formError = validate();
    if (formError) return;

    submitting = true;
    try {
      await createQuestion({
        text_fr: textFr.trim(),
        text_en: textEn.trim() || undefined,
        duration: duration!,
        unit,
        category_slug: categoryMode === 'existing' ? categorySlug! : slugify(categoryNameEn || categoryNameFr),
        category_name_fr: categoryMode === 'new' ? categoryNameFr.trim() : undefined,
        category_name_en: categoryMode === 'new' ? categoryNameEn.trim() : undefined,
      });
      success = true;
    } catch (err) {
      formError = err instanceof ApiError ? t(`contribute.errors.${err.code}`) : t('contribute.errors.generic');
    } finally {
      submitting = false;
    }
  }

  function slugify(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  function handleSubmitAnother(): void {
    resetForm();
    success = false;
  }
</script>

<AppShell>
  <header class="contribute__header">
    <Button variant="ghost" onclick={() => navigate({ name: 'home' })}>
      <Icon name="caret-left" size="md" />
      {t('nav.back')}
    </Button>
  </header>

  <h1 class="contribute__title">{t('contribute.title')}</h1>
  <p class="contribute__intro">{t('contribute.intro')}</p>

  {#if success}
    <Card>
      <p class="contribute__success">
        <Icon name="check" size="md" />
        {t('contribute.success')}
      </p>
    </Card>
    <Button variant="primary" fullWidth onclick={handleSubmitAnother}>{t('contribute.submit_another')}</Button>
  {:else}
    <Card>
      <div class="contribute__field">
        <label class="contribute__label" for="text-fr">{t('contribute.text_fr_label')}</label>
        <textarea
          id="text-fr"
          class="contribute__textarea"
          placeholder={t('contribute.text_fr_placeholder')}
          bind:value={textFr}
        ></textarea>
      </div>

      <div class="contribute__field">
        <label class="contribute__label" for="text-en">{t('contribute.text_en_label')}</label>
        <textarea
          id="text-en"
          class="contribute__textarea"
          placeholder={t('contribute.text_en_placeholder')}
          bind:value={textEn}
        ></textarea>
      </div>

      <div class="contribute__row">
        <div class="contribute__field contribute__field--grow">
          <label class="contribute__label" for="duration">{t('contribute.duration_label')}</label>
          <input
            id="duration"
            class="contribute__input"
            type="number"
            inputmode="decimal"
            min="0"
            step="any"
            placeholder={t('contribute.duration_placeholder')}
            bind:value={duration}
          />
        </div>

        <div class="contribute__field">
          <label class="contribute__label" for="contribute-unit">{t('contribute.unit_label')}</label>
          <select id="contribute-unit" class="contribute__select" bind:value={unit}>
            {#each UNITS as u (u)}
              <option value={u}>{t(`units.${u}`)}</option>
            {/each}
          </select>
        </div>
      </div>

      <div class="contribute__field">
        <span class="contribute__label">{t('contribute.category_label')}</span>
        <div class="contribute__toggle">
          <button
            type="button"
            class="contribute__toggle-btn"
            class:contribute__toggle-btn--selected={categoryMode === 'existing'}
            onclick={() => (categoryMode = 'existing')}
          >
            {t('contribute.category_existing')}
          </button>
          <button
            type="button"
            class="contribute__toggle-btn"
            class:contribute__toggle-btn--selected={categoryMode === 'new'}
            onclick={() => (categoryMode = 'new')}
          >
            {t('contribute.category_new')}
          </button>
        </div>
      </div>

      {#if categoryMode === 'existing'}
        {#if loadingCategories}
          <Skeleton rows={2} />
        {:else if loadError}
          <ErrorMessage message={loadError} />
        {:else}
          <select
            class="contribute__select contribute__select--full"
            aria-label={t('contribute.category_label')}
            bind:value={categorySlug}
          >
            {#each categories as category (category.id)}
              <option value={category.slug}>{getLang() === 'en' ? category.name_en : category.name_fr}</option>
            {/each}
          </select>
        {/if}
      {:else}
        <div class="contribute__field">
          <label class="contribute__label" for="cat-name-fr">{t('contribute.category_name_fr_label')}</label>
          <input id="cat-name-fr" class="contribute__input" type="text" bind:value={categoryNameFr} />
        </div>
        <div class="contribute__field">
          <label class="contribute__label" for="cat-name-en">{t('contribute.category_name_en_label')}</label>
          <input id="cat-name-en" class="contribute__input" type="text" bind:value={categoryNameEn} />
        </div>
      {/if}
    </Card>

    {#if formError}
      <ErrorMessage message={formError} />
    {/if}

    <Button variant="primary" fullWidth disabled={submitting} onclick={handleSubmit}>
      {t('contribute.submit')}
    </Button>
  {/if}
</AppShell>

<style>
  .contribute__header {
    display: flex;
  }

  .contribute__title {
    font-family: var(--font-display);
    font-size: var(--fs-title);
    font-weight: 700;
    color: var(--ink-hi);
  }

  .contribute__intro {
    color: var(--ink-mid);
    font-size: var(--fs-body);
    margin-top: -0.5rem;
  }

  .contribute__field {
    display: flex;
    flex-direction: column;
    gap: var(--gap-tight);
  }

  .contribute__field + .contribute__field {
    margin-top: var(--gap);
  }

  .contribute__field--grow {
    flex: 1;
  }

  .contribute__row {
    display: flex;
    gap: var(--gap);
    margin-top: var(--gap);
  }

  .contribute__label {
    font-family: var(--font-mono);
    font-size: var(--fs-label);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-mid);
  }

  .contribute__textarea {
    min-height: 4.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--flap);
    color: var(--flap-ink);
    font-family: var(--font-display);
    font-size: var(--fs-body);
    border: none;
    border-radius: var(--radius-flap);
    box-shadow: 0 0.125rem 0 var(--hinge);
    resize: vertical;
  }

  .contribute__textarea::placeholder {
    color: var(--ink-lo);
  }

  .contribute__input {
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

  .contribute__input::placeholder {
    color: var(--ink-lo);
  }

  .contribute__select {
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

  .contribute__select--full {
    width: 100%;
    margin-top: var(--gap);
  }

  .contribute__toggle {
    display: flex;
    gap: var(--gap-tight);
  }

  .contribute__toggle-btn {
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

  .contribute__toggle-btn--selected {
    border-color: var(--amber);
    color: var(--amber);
  }

  .contribute__success {
    display: flex;
    align-items: center;
    gap: var(--gap-tight);
    color: var(--go);
    font-size: var(--fs-body);
    margin: 0;
  }
</style>
