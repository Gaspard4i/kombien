<script lang="ts">
  // Création en lot (Lot 6) : un thème (catégorie existante ou nouvelle) + plusieurs
  // questions envoyées d'un coup (une requête POST /questions par question, toutes
  // partent en pending — même règle que Contribute.svelte). Brouillon auto-sauvegardé
  // en localStorage, restauré au chargement (récupérable après refresh/crash).
  import { onMount } from 'svelte';
  import { t } from '../lib/i18n';
  import { navigate } from '../lib/router/router.svelte';
  import { getCategories, createQuestion, ApiError } from '../lib/api/client';
  import type { Category } from '../lib/api/types';
  import { getLang } from '../lib/i18n';
  import AppShell from '../lib/components/AppShell.svelte';
  import Card from '../lib/components/Card.svelte';
  import Button from '../lib/components/Button.svelte';
  import Skeleton from '../lib/components/Skeleton.svelte';
  import ErrorMessage from '../lib/components/ErrorMessage.svelte';
  import Icon from '../lib/components/Icon.svelte';

  interface Props {
    // Reçu du routeur pour cohérence avec AdminImport (même origine Admin.svelte),
    // pas utilisé ici : POST /questions est un endpoint public (contribution).
    adminSecret: string;
  }

  const {}: Props = $props();

  interface DraftQuestion {
    textFr: string;
    textEn: string;
    duration: string; // string en brouillon : évite de perdre une saisie partielle ("2." etc.)
    unit: string;
  }

  interface Draft {
    categoryMode: 'existing' | 'new';
    categorySlug: string | null;
    categoryNameFr: string;
    categoryNameEn: string;
    questions: DraftQuestion[];
  }

  const DRAFT_KEY = 'kombien:bulk-create-draft';
  const UNITS = ['second', 'minute', 'hour', 'day', 'week', 'month', 'year'] as const;

  function emptyQuestion(): DraftQuestion {
    return { textFr: '', textEn: '', duration: '', unit: 'minute' };
  }

  function emptyDraft(): Draft {
    return {
      categoryMode: 'existing',
      categorySlug: null,
      categoryNameFr: '',
      categoryNameEn: '',
      questions: [emptyQuestion()],
    };
  }

  function loadStoredDraft(): Draft | null {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Draft;
    } catch {
      return null;
    }
  }

  let categories = $state<Category[]>([]);
  let loadingCategories = $state(true);
  let loadError = $state<string | null>(null);

  const storedDraft = loadStoredDraft();
  let pendingDraft = $state<Draft | null>(storedDraft);
  let draft = $state<Draft>(storedDraft ? emptyDraft() : emptyDraft());

  let submitting = $state(false);
  let submitError = $state<string | null>(null);
  let successCount = $state<number | null>(null);
  let saved = $state(false);
  let saveTimeout: ReturnType<typeof setTimeout> | undefined;

  onMount(async () => {
    try {
      categories = await getCategories();
      if (!pendingDraft && categories.length > 0) {
        draft.categorySlug = categories[0]!.slug;
      }
    } catch (err) {
      loadError = err instanceof ApiError ? t(`errors.${err.code}`) : t('errors.unknown_error');
    } finally {
      loadingCategories = false;
    }
  });

  function persistDraft(): void {
    if (pendingDraft) return; // ne pas écraser le brouillon proposé tant qu'il n'est pas résolu
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    saved = true;
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => (saved = false), 1500);
  }

  function resumeDraft(): void {
    if (!pendingDraft) return;
    draft = pendingDraft;
    pendingDraft = null;
  }

  function discardDraft(): void {
    pendingDraft = null;
    localStorage.removeItem(DRAFT_KEY);
    draft = emptyDraft();
    if (categories.length > 0) draft.categorySlug = categories[0]!.slug;
  }

  function addQuestion(): void {
    draft.questions.push(emptyQuestion());
    persistDraft();
  }

  function removeQuestion(index: number): void {
    draft.questions.splice(index, 1);
    persistDraft();
  }

  function validate(): string | null {
    if (draft.categoryMode === 'existing' && !draft.categorySlug) {
      return t('bulk_create.errors.category_required');
    }
    if (draft.categoryMode === 'new' && (!draft.categoryNameFr.trim() || !draft.categoryNameEn.trim())) {
      return t('bulk_create.errors.category_names_required');
    }
    if (draft.questions.length === 0) {
      return t('bulk_create.errors.min_one_question');
    }
    for (const q of draft.questions) {
      if (!q.textFr.trim()) return t('bulk_create.errors.text_fr_required');
      const duration = Number(q.duration);
      if (!(duration > 0)) return t('bulk_create.errors.duration_required');
    }
    return null;
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

  async function handleSubmit(): Promise<void> {
    submitError = validate();
    if (submitError) return;

    submitting = true;
    try {
      const categorySlug =
        draft.categoryMode === 'existing' ? draft.categorySlug! : slugify(draft.categoryNameEn || draft.categoryNameFr);

      for (const q of draft.questions) {
        await createQuestion({
          text_fr: q.textFr.trim(),
          text_en: q.textEn.trim() || undefined,
          duration: Number(q.duration),
          unit: q.unit as any,
          category_slug: categorySlug,
          category_name_fr: draft.categoryMode === 'new' ? draft.categoryNameFr.trim() : undefined,
          category_name_en: draft.categoryMode === 'new' ? draft.categoryNameEn.trim() : undefined,
        });
      }

      successCount = draft.questions.length;
      localStorage.removeItem(DRAFT_KEY);
    } catch (err) {
      submitError = err instanceof ApiError ? t(`bulk_create.errors.${err.code}`) ?? t('bulk_create.errors.generic') : t('bulk_create.errors.generic');
    } finally {
      submitting = false;
    }
  }

  function handleCreateAnother(): void {
    successCount = null;
    draft = emptyDraft();
    if (categories.length > 0) draft.categorySlug = categories[0]!.slug;
  }
</script>

<AppShell>
  <header class="bulk__header">
    <Button variant="ghost" onclick={() => navigate({ name: 'admin' })}>
      <Icon name="caret-left" size="md" />
      {t('nav.back')}
    </Button>
  </header>

  <h1 class="bulk__title">{t('bulk_create.title')}</h1>
  <p class="bulk__intro">{t('bulk_create.intro')}</p>

  {#if pendingDraft}
    <Card>
      <p class="bulk__draft-title">{t('bulk_create.draft_found_title')}</p>
      <p class="bulk__draft-body">{t('bulk_create.draft_found_body')}</p>
      <div class="bulk__draft-actions">
        <Button variant="primary" onclick={resumeDraft}>{t('bulk_create.draft_resume')}</Button>
        <Button variant="ghost" onclick={discardDraft}>{t('bulk_create.draft_discard')}</Button>
      </div>
    </Card>
  {:else if successCount !== null}
    <Card>
      <p class="bulk__success">
        <Icon name="check" size="md" />
        {t('bulk_create.success', { count: successCount })}
      </p>
    </Card>
    <Button variant="primary" fullWidth onclick={handleCreateAnother}>{t('bulk_create.create_more')}</Button>
  {:else}
    <Card>
      <span class="bulk__label">{t('bulk_create.category_title')}</span>
      <div class="bulk__toggle">
        <button
          type="button"
          class="bulk__toggle-btn"
          class:bulk__toggle-btn--selected={draft.categoryMode === 'existing'}
          onclick={() => {
            draft.categoryMode = 'existing';
            persistDraft();
          }}
        >
          {t('bulk_create.category_mode_existing')}
        </button>
        <button
          type="button"
          class="bulk__toggle-btn"
          class:bulk__toggle-btn--selected={draft.categoryMode === 'new'}
          onclick={() => {
            draft.categoryMode = 'new';
            persistDraft();
          }}
        >
          {t('bulk_create.category_mode_new')}
        </button>
      </div>

      {#if draft.categoryMode === 'existing'}
        {#if loadingCategories}
          <Skeleton rows={2} />
        {:else if loadError}
          <ErrorMessage message={loadError} />
        {:else}
          <select
            class="bulk__select bulk__select--full"
            aria-label={t('bulk_create.category_title')}
            bind:value={draft.categorySlug}
            onchange={persistDraft}
          >
            {#each categories as category (category.id)}
              <option value={category.slug}>{getLang() === 'en' ? category.name_en : category.name_fr}</option>
            {/each}
          </select>
        {/if}
      {:else}
        <div class="bulk__field">
          <label class="bulk__label" for="bulk-cat-fr">{t('contribute.category_name_fr_label')}</label>
          <input id="bulk-cat-fr" class="bulk__input" type="text" bind:value={draft.categoryNameFr} onblur={persistDraft} />
        </div>
        <div class="bulk__field">
          <label class="bulk__label" for="bulk-cat-en">{t('contribute.category_name_en_label')}</label>
          <input id="bulk-cat-en" class="bulk__input" type="text" bind:value={draft.categoryNameEn} onblur={persistDraft} />
        </div>
      {/if}
    </Card>

    <h2 class="bulk__questions-title">{t('bulk_create.questions_title')}</h2>

    {#each draft.questions as question, index (index)}
      <Card>
        <div class="bulk__question-header">
          <span class="bulk__question-number">{t('bulk_create.question_number', { number: index + 1 })}</span>
          {#if draft.questions.length > 1}
            <button
              type="button"
              class="bulk__remove-btn"
              aria-label={t('bulk_create.remove_question')}
              onclick={() => removeQuestion(index)}
            >
              <Icon name="minus" size="sm" />
            </button>
          {/if}
        </div>

        <div class="bulk__field">
          <label class="bulk__label" for="bulk-text-fr-{index}">{t('contribute.text_fr_label')}</label>
          <textarea
            id="bulk-text-fr-{index}"
            class="bulk__textarea"
            placeholder={t('contribute.text_fr_placeholder')}
            bind:value={question.textFr}
            onblur={persistDraft}
          ></textarea>
        </div>

        <div class="bulk__field">
          <label class="bulk__label" for="bulk-text-en-{index}">{t('contribute.text_en_label')}</label>
          <textarea
            id="bulk-text-en-{index}"
            class="bulk__textarea"
            placeholder={t('contribute.text_en_placeholder')}
            bind:value={question.textEn}
            onblur={persistDraft}
          ></textarea>
        </div>

        <div class="bulk__row">
          <div class="bulk__field bulk__field--grow">
            <label class="bulk__label" for="bulk-duration-{index}">{t('contribute.duration_label')}</label>
            <input
              id="bulk-duration-{index}"
              class="bulk__input"
              type="number"
              inputmode="decimal"
              min="0"
              step="any"
              placeholder={t('contribute.duration_placeholder')}
              bind:value={question.duration}
              onblur={persistDraft}
            />
          </div>
          <div class="bulk__field">
            <label class="bulk__label" for="bulk-unit-{index}">{t('contribute.unit_label')}</label>
            <select id="bulk-unit-{index}" class="bulk__select" bind:value={question.unit} onchange={persistDraft}>
              {#each UNITS as u (u)}
                <option value={u}>{t(`units.${u}`)}</option>
              {/each}
            </select>
          </div>
        </div>
      </Card>
    {/each}

    <Button variant="secondary" fullWidth onclick={addQuestion}>
      <Icon name="plus" size="md" />
      {t('bulk_create.add_question')}
    </Button>

    {#if submitError}
      <ErrorMessage message={submitError} />
    {/if}

    <Button variant="primary" fullWidth disabled={submitting} onclick={handleSubmit}>
      {submitting ? t('bulk_create.submitting') : t('bulk_create.submit')}
    </Button>

    {#if saved}
      <p class="bulk__saved-indicator" role="status">{t('bulk_create.saved_indicator')}</p>
    {/if}
  {/if}
</AppShell>

<style>
  .bulk__header {
    display: flex;
  }

  .bulk__title {
    font-family: var(--font-display);
    font-size: var(--fs-title);
    font-weight: 700;
    color: var(--ink-hi);
  }

  .bulk__intro {
    color: var(--ink-mid);
    font-size: var(--fs-body);
    margin-top: -0.5rem;
  }

  .bulk__draft-title {
    font-family: var(--font-display);
    font-size: var(--fs-heading);
    font-weight: 700;
    color: var(--ink-hi);
    margin: 0 0 0.25rem;
  }

  .bulk__draft-body {
    color: var(--ink-mid);
    font-size: var(--fs-body);
    margin: 0 0 var(--gap);
  }

  .bulk__draft-actions {
    display: flex;
    gap: var(--gap-tight);
  }

  .bulk__label {
    display: block;
    font-family: var(--font-mono);
    font-size: var(--fs-label);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-mid);
    margin-bottom: var(--gap-tight);
  }

  .bulk__toggle {
    display: flex;
    gap: var(--gap-tight);
    margin-bottom: var(--gap);
  }

  .bulk__toggle-btn {
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

  .bulk__toggle-btn--selected {
    border-color: var(--amber);
    color: var(--amber);
  }

  .bulk__field {
    display: flex;
    flex-direction: column;
    gap: var(--gap-tight);
  }

  .bulk__field + .bulk__field {
    margin-top: var(--gap);
  }

  .bulk__field--grow {
    flex: 1;
  }

  .bulk__row {
    display: flex;
    gap: var(--gap);
    margin-top: var(--gap);
  }

  .bulk__textarea {
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

  .bulk__input {
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

  .bulk__select {
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

  .bulk__select--full {
    width: 100%;
  }

  .bulk__questions-title {
    font-family: var(--font-display);
    font-size: var(--fs-heading);
    font-weight: 500;
    color: var(--ink-hi);
  }

  .bulk__question-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--gap);
  }

  .bulk__question-number {
    font-family: var(--font-mono);
    font-size: var(--fs-label);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-mid);
  }

  .bulk__remove-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: var(--touch-min);
    min-width: var(--touch-min);
    background: transparent;
    color: var(--signal);
    border: 1px solid var(--signal);
    border-radius: var(--radius-flap);
    cursor: pointer;
  }

  .bulk__success {
    display: flex;
    align-items: center;
    gap: var(--gap-tight);
    color: var(--go);
    font-size: var(--fs-body);
    margin: 0;
  }

  .bulk__saved-indicator {
    text-align: center;
    color: var(--ink-lo);
    font-family: var(--font-mono);
    font-size: var(--fs-micro);
    margin: 0;
  }
</style>
