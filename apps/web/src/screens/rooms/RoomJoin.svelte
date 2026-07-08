<script lang="ts">
  // Rejoindre une room (Lot 9) : saisie du code (ou pré-rempli via lien/QR /rooms/join?code=...)
  // + pseudo, puis vérification légère (GET /rooms/:code) avant d'ouvrir le WS -- évite
  // d'ouvrir une connexion pour un code invalide (erreur affichée sans quitter cet écran).
  import { t } from '../../lib/i18n';
  import { navigate } from '../../lib/router/router.svelte';
  import { getRoomInfo, ApiError } from '../../lib/api/client';
  import AppShell from '../../lib/components/AppShell.svelte';
  import Card from '../../lib/components/Card.svelte';
  import Button from '../../lib/components/Button.svelte';
  import ErrorMessage from '../../lib/components/ErrorMessage.svelte';
  import Icon from '../../lib/components/Icon.svelte';

  interface Props {
    prefilledCode?: string;
  }

  const { prefilledCode }: Props = $props();

  let codeInput = $state<string | null>(null);
  let code = $derived(codeInput ?? prefilledCode?.toUpperCase() ?? '');
  let pseudo = $state('');
  let checking = $state(false);
  let formError = $state<string | null>(null);

  function validate(): string | null {
    if (!code.trim()) return t('room.join.errors.code_required');
    if (!pseudo.trim()) return t('room.join.errors.pseudo_required');
    return null;
  }

  async function handleSubmit(): Promise<void> {
    formError = validate();
    if (formError) return;

    checking = true;
    try {
      await getRoomInfo(code.trim());
      navigate({ name: 'room-play', code: code.trim().toUpperCase(), pseudo: pseudo.trim() });
    } catch (err) {
      formError = err instanceof ApiError ? t(`errors.${err.code}`) : t('errors.unknown_error');
    } finally {
      checking = false;
    }
  }
</script>

<AppShell>
  <header class="room-join__header">
    <Button variant="ghost" onclick={() => navigate({ name: 'home' })}>
      <Icon name="caret-left" size="md" />
      {t('nav.back')}
    </Button>
  </header>

  <h1 class="room-join__title">{t('room.join.title')}</h1>

  <Card>
    <div class="room-join__field">
      <label class="room-join__label" for="room-code">{t('room.join.code_label')}</label>
      <input
        id="room-code"
        class="room-join__input room-join__input--code"
        type="text"
        maxlength="6"
        placeholder={t('room.join.code_placeholder')}
        value={code}
        oninput={(e) => (codeInput = e.currentTarget.value.toUpperCase())}
      />
    </div>

    <div class="room-join__field">
      <label class="room-join__label" for="room-pseudo">{t('room.join.pseudo_label')}</label>
      <input
        id="room-pseudo"
        class="room-join__input"
        type="text"
        maxlength="24"
        placeholder={t('room.join.pseudo_placeholder')}
        bind:value={pseudo}
      />
    </div>
  </Card>

  {#if formError}
    <ErrorMessage message={formError} />
  {/if}

  <Button variant="primary" fullWidth disabled={checking} onclick={handleSubmit}>
    <Icon name="hand-tap" size="md" />
    {t('room.join.submit')}
  </Button>
</AppShell>

<style>
  .room-join__header {
    display: flex;
  }

  .room-join__title {
    font-family: var(--font-display);
    font-size: var(--fs-title);
    font-weight: 700;
    color: var(--ink-hi);
  }

  .room-join__field {
    display: flex;
    flex-direction: column;
    gap: var(--gap-tight);
  }

  .room-join__field + .room-join__field {
    margin-top: var(--gap);
  }

  .room-join__label {
    font-family: var(--font-mono);
    font-size: var(--fs-label);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-mid);
  }

  .room-join__input {
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

  .room-join__input--code {
    text-align: center;
    font-size: var(--fs-title);
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }

  .room-join__input::placeholder {
    color: var(--ink-lo);
  }
</style>
