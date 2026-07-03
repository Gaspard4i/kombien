<script lang="ts">
  // Écran d'import en masse (Lot 6, API_CONTRACT.md POST /admin/questions/import) :
  // téléchargement du template, upload d'un fichier CSV/xlsx/md, rapport d'erreurs
  // ligne à ligne. adminSecret transite depuis Admin.svelte via le routeur (pas de
  // point d'entrée public — même règle que /admin).
  import { t } from '../lib/i18n';
  import { navigate } from '../lib/router/router.svelte';
  import {
    importQuestionsFile,
    downloadImportTemplate,
    ApiError,
    type ImportReport,
    type ImportTemplateFormat,
  } from '../lib/api/client';
  import AppShell from '../lib/components/AppShell.svelte';
  import Card from '../lib/components/Card.svelte';
  import Button from '../lib/components/Button.svelte';
  import ErrorMessage from '../lib/components/ErrorMessage.svelte';
  import Icon from '../lib/components/Icon.svelte';

  interface Props {
    adminSecret: string;
  }

  const { adminSecret }: Props = $props();

  let selectedFile = $state<File | null>(null);
  let submitting = $state(false);
  let submitError = $state<string | null>(null);
  let report = $state<ImportReport | null>(null);
  let templateError = $state<string | null>(null);

  function handleFileChange(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    selectedFile = input.files?.[0] ?? null;
    report = null;
    submitError = null;
  }

  async function handleDownloadTemplate(format: ImportTemplateFormat): Promise<void> {
    templateError = null;
    try {
      await downloadImportTemplate(format, adminSecret);
    } catch {
      templateError = t('import.template_error');
    }
  }

  async function handleSubmit(): Promise<void> {
    if (!selectedFile) {
      submitError = t('import.errors.file_required');
      return;
    }
    submitError = null;
    submitting = true;
    try {
      report = await importQuestionsFile(selectedFile, adminSecret);
    } catch (err) {
      submitError = err instanceof ApiError ? t(`import.errors.${err.code}`) : t('import.errors.generic');
    } finally {
      submitting = false;
    }
  }
</script>

<AppShell>
  <header class="import__header">
    <Button variant="ghost" onclick={() => navigate({ name: 'admin' })}>
      <Icon name="caret-left" size="md" />
      {t('nav.back')}
    </Button>
  </header>

  <h1 class="import__title">{t('import.title')}</h1>
  <p class="import__intro">{t('import.intro')}</p>

  <Card>
    <span class="import__label">{t('import.template_title')}</span>
    <div class="import__template-row">
      <Button variant="secondary" onclick={() => handleDownloadTemplate('csv')}>{t('import.template_csv')}</Button>
      <Button variant="secondary" onclick={() => handleDownloadTemplate('xlsx')}>{t('import.template_xlsx')}</Button>
      <Button variant="secondary" onclick={() => handleDownloadTemplate('md')}>{t('import.template_md')}</Button>
    </div>
    {#if templateError}
      <ErrorMessage message={templateError} />
    {/if}
  </Card>

  <Card>
    <div class="import__field">
      <label class="import__label" for="import-file">{t('import.file_label')}</label>
      <input
        id="import-file"
        class="import__file-input"
        type="file"
        accept=".csv,.xlsx,.md,.markdown"
        onchange={handleFileChange}
      />
    </div>
  </Card>

  {#if submitError}
    <ErrorMessage message={submitError} />
  {/if}

  <Button variant="primary" fullWidth disabled={submitting || !selectedFile} onclick={handleSubmit}>
    {submitting ? t('import.submitting') : t('import.submit')}
  </Button>

  {#if report}
    <Card>
      <p class="import__summary">
        {t('import.summary', {
          imported: report.imported,
          total: report.total,
          rejected: report.rejected.length,
        })}
      </p>
    </Card>

    {#if report.rejected.length > 0}
      <h2 class="import__rejected-title">{t('import.rejected_title')}</h2>
      <div class="import__rejected-list">
        {#each report.rejected as row (row.line)}
          <Card>
            <p class="import__rejected-line">
              <Icon name="warning" size="sm" />
              {t('import.line_label', { line: row.line })}
            </p>
            <ul class="import__rejected-errors">
              {#each row.errors as code (code)}
                <li>{t(`import.errors.${code}`)}</li>
              {/each}
            </ul>
          </Card>
        {/each}
      </div>
    {/if}
  {/if}
</AppShell>

<style>
  .import__header {
    display: flex;
  }

  .import__title {
    font-family: var(--font-display);
    font-size: var(--fs-title);
    font-weight: 700;
    color: var(--ink-hi);
  }

  .import__intro {
    color: var(--ink-mid);
    font-size: var(--fs-body);
    margin-top: -0.5rem;
  }

  .import__label {
    display: block;
    font-family: var(--font-mono);
    font-size: var(--fs-label);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-mid);
    margin-bottom: var(--gap-tight);
  }

  .import__template-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--gap-tight);
  }

  .import__field {
    display: flex;
    flex-direction: column;
    gap: var(--gap-tight);
  }

  .import__file-input {
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

  .import__summary {
    color: var(--ink-hi);
    font-size: var(--fs-body);
    margin: 0;
  }

  .import__rejected-title {
    font-family: var(--font-display);
    font-size: var(--fs-heading);
    font-weight: 500;
    color: var(--ink-hi);
  }

  .import__rejected-list {
    display: flex;
    flex-direction: column;
    gap: var(--gap-tight);
  }

  .import__rejected-line {
    display: flex;
    align-items: center;
    gap: var(--gap-tight);
    color: var(--signal);
    font-family: var(--font-mono);
    font-size: var(--fs-body);
    margin: 0 0 0.25rem;
  }

  .import__rejected-errors {
    margin: 0;
    padding-left: 1.25rem;
    color: var(--ink-mid);
    font-size: var(--fs-micro);
  }
</style>
