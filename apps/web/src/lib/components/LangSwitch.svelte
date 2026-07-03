<script lang="ts">
  import { getLang, setLang, type Lang } from '../i18n';
  import { t } from '../i18n';
  import Icon from './Icon.svelte';

  function toggle(): void {
    setLang(getLang() === 'fr' ? 'en' : 'fr');
  }

  const other: Record<Lang, Lang> = { fr: 'en', en: 'fr' };
</script>

<button
  type="button"
  class="lang-switch"
  onclick={toggle}
  aria-label={t('nav.language')}
>
  <Icon name="translate" size="sm" />
  <span>{getLang().toUpperCase()}</span>
  <span class="lang-switch__hint">→ {other[getLang()].toUpperCase()}</span>
</button>

<style>
  .lang-switch {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    min-height: var(--touch-min);
    padding: 0.5rem 0.75rem;
    background: transparent;
    border: 1px solid var(--ink-lo);
    border-radius: var(--radius-flap);
    color: var(--ink-hi);
    font-family: var(--font-mono);
    font-size: var(--fs-label);
    letter-spacing: 0.04em;
    cursor: pointer;
  }

  .lang-switch:hover {
    border-color: var(--amber);
    color: var(--amber);
  }

  .lang-switch__hint {
    color: var(--ink-lo);
  }
</style>
