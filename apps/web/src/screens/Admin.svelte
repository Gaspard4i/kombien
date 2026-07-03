<script lang="ts">
  // Admin minimaliste (API_CONTRACT.md) : secret saisi une fois, gardé en mémoire locale
  // (jamais persisté), header x-admin-secret sur chaque appel. Modération des questions
  // en attente (approve/reject).
  import { t } from '../lib/i18n';
  import { navigate } from '../lib/router/router.svelte';
  import { getPendingQuestions, approveQuestion, rejectQuestion, ApiError, type PendingQuestion } from '../lib/api/client';
  import AppShell from '../lib/components/AppShell.svelte';
  import Card from '../lib/components/Card.svelte';
  import Button from '../lib/components/Button.svelte';
  import Skeleton from '../lib/components/Skeleton.svelte';
  import ErrorMessage from '../lib/components/ErrorMessage.svelte';
  import Icon from '../lib/components/Icon.svelte';

  let secretInput = $state('');
  let adminSecret = $state<string | null>(null);
  let unlockError = $state<string | null>(null);
  let unlocking = $state(false);

  let pending = $state<PendingQuestion[]>([]);
  let loading = $state(false);
  let actionError = $state<string | null>(null);

  async function handleUnlock(): Promise<void> {
    unlocking = true;
    unlockError = null;
    try {
      const questions = await getPendingQuestions(secretInput);
      adminSecret = secretInput;
      pending = questions;
    } catch (err) {
      unlockError = err instanceof ApiError && err.status === 401 ? t('admin.unlock_error') : t('errors.unknown_error');
    } finally {
      unlocking = false;
    }
  }

  async function reload(): Promise<void> {
    if (!adminSecret) return;
    loading = true;
    actionError = null;
    try {
      pending = await getPendingQuestions(adminSecret);
    } catch {
      actionError = t('admin.action_error');
    } finally {
      loading = false;
    }
  }

  function goToImport(): void {
    if (!adminSecret) return;
    navigate({ name: 'admin-import', adminSecret });
  }

  function goToBulkCreate(): void {
    if (!adminSecret) return;
    navigate({ name: 'admin-bulk-create', adminSecret });
  }

  async function handleApprove(id: number): Promise<void> {
    if (!adminSecret) return;
    actionError = null;
    try {
      await approveQuestion(id, adminSecret);
      pending = pending.filter((q) => q.id !== id);
    } catch {
      actionError = t('admin.action_error');
    }
  }

  async function handleReject(id: number): Promise<void> {
    if (!adminSecret) return;
    actionError = null;
    try {
      await rejectQuestion(id, adminSecret);
      pending = pending.filter((q) => q.id !== id);
    } catch {
      actionError = t('admin.action_error');
    }
  }
</script>

<AppShell>
  <header class="admin__header">
    <Button variant="ghost" onclick={() => navigate({ name: 'home' })}>
      <Icon name="caret-left" size="md" />
      {t('nav.back')}
    </Button>
  </header>

  <h1 class="admin__title">{t('admin.title')}</h1>

  {#if !adminSecret}
    <Card>
      <div class="admin__field">
        <label class="admin__label" for="admin-secret">{t('admin.secret_label')}</label>
        <input
          id="admin-secret"
          class="admin__input"
          type="password"
          placeholder={t('admin.secret_placeholder')}
          bind:value={secretInput}
          onkeydown={(e) => e.key === 'Enter' && handleUnlock()}
        />
      </div>
      {#if unlockError}
        <ErrorMessage message={unlockError} />
      {/if}
    </Card>
    <Button variant="primary" fullWidth disabled={unlocking || !secretInput} onclick={handleUnlock}>
      {t('admin.unlock')}
    </Button>
  {:else}
    <div class="admin__tools">
      <Button variant="secondary" fullWidth onclick={goToImport}>
        <Icon name="stack" size="md" />
        {t('admin.import_link')}
      </Button>
      <Button variant="secondary" fullWidth onclick={goToBulkCreate}>
        <Icon name="plus" size="md" />
        {t('admin.bulk_create_link')}
      </Button>
    </div>

    <div class="admin__toolbar">
      <h2 class="admin__pending-title">{t('admin.pending_title')}</h2>
      <Button variant="ghost" ariaLabel={t('admin.refresh')} onclick={reload}>
        <Icon name="arrows-clockwise" size="md" />
      </Button>
    </div>

    {#if actionError}
      <ErrorMessage message={actionError} />
    {/if}

    {#if loading}
      <Skeleton rows={3} />
    {:else if pending.length === 0}
      <p class="admin__empty">{t('admin.pending_empty')}</p>
    {:else}
      <div class="admin__list">
        {#each pending as question (question.id)}
          <Card>
            <p class="admin__question-fr">{question.text_fr}</p>
            {#if question.text_en}
              <p class="admin__question-en">{question.text_en}</p>
            {/if}
            <p class="admin__question-meta">
              {question.category_slug ?? ''} &middot; {question.duration_seconds}s
            </p>
            <div class="admin__actions">
              <Button variant="primary" onclick={() => handleApprove(question.id)}>
                <Icon name="check" size="sm" />
                {t('admin.approve')}
              </Button>
              <Button variant="destructive" onclick={() => handleReject(question.id)}>
                <Icon name="x" size="sm" />
                {t('admin.reject')}
              </Button>
            </div>
          </Card>
        {/each}
      </div>
    {/if}
  {/if}
</AppShell>

<style>
  .admin__header {
    display: flex;
  }

  .admin__title {
    font-family: var(--font-display);
    font-size: var(--fs-title);
    font-weight: 700;
    color: var(--ink-hi);
  }

  .admin__field {
    display: flex;
    flex-direction: column;
    gap: var(--gap-tight);
  }

  .admin__label {
    font-family: var(--font-mono);
    font-size: var(--fs-label);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-mid);
  }

  .admin__input {
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

  .admin__tools {
    display: flex;
    flex-direction: column;
    gap: var(--gap-tight);
  }

  .admin__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: var(--gap);
  }

  .admin__pending-title {
    font-family: var(--font-display);
    font-size: var(--fs-heading);
    font-weight: 500;
    color: var(--ink-hi);
  }

  .admin__empty {
    color: var(--ink-mid);
    text-align: center;
    font-size: var(--fs-body);
  }

  .admin__list {
    display: flex;
    flex-direction: column;
    gap: var(--gap);
  }

  .admin__question-fr {
    font-family: var(--font-display);
    font-size: var(--fs-body);
    color: var(--ink-hi);
    margin: 0 0 0.25rem;
  }

  .admin__question-en {
    font-family: var(--font-display);
    font-size: var(--fs-micro);
    color: var(--ink-mid);
    margin: 0 0 0.5rem;
  }

  .admin__question-meta {
    font-family: var(--font-mono);
    font-size: var(--fs-micro);
    color: var(--ink-lo);
    margin: 0 0 var(--gap);
  }

  .admin__actions {
    display: flex;
    gap: var(--gap-tight);
  }
</style>
