<script lang="ts">
  // Lobby d'une room (Lot 9) : affiche le code + QR (créateur uniquement, juste après
  // POST /rooms) puis demande le pseudo du créateur pour qu'il rejoigne lui-même la room en
  // WS -- le protocole ne distingue pas "créateur" et "joueur" (GET /rooms/ws, un seul canal,
  // §6.1) : le créateur devient MJ simplement parce qu'il est le premier `join` reçu. Une
  // fois connecté, délègue entièrement l'affichage à RoomPlay (lobby -> question -> ... ->
  // ended, tout piloté par roomStore.status).
  import { t } from '../../lib/i18n';
  import { navigate } from '../../lib/router/router.svelte';
  import Card from '../../lib/components/Card.svelte';
  import Button from '../../lib/components/Button.svelte';
  import Icon from '../../lib/components/Icon.svelte';
  import SplitFlap from '../../lib/components/SplitFlap.svelte';
  import RoomPlay from './RoomPlay.svelte';

  interface Props {
    code: string;
    qr?: string | null;
    isCreator?: boolean;
  }

  const { code, qr = null, isCreator = false }: Props = $props();

  let pseudo = $state('');
  let joined = $state(false);
  let formError = $state<string | null>(null);

  function handleJoin(): void {
    if (!pseudo.trim()) {
      formError = t('room.join.errors.pseudo_required');
      return;
    }
    formError = null;
    joined = true;
  }
</script>

{#if joined}
  <RoomPlay {code} pseudo={pseudo.trim()} />
{:else}
  <div class="room-lobby">
    <div class="room-lobby__content">
      {#if isCreator}
        <span class="room-lobby__label">{t('room.lobby.code_label')}</span>
        <div class="room-lobby__code">
          <SplitFlap value={code} size="mega" />
        </div>

        {#if qr}
          <div class="room-lobby__qr">
            <img src={qr} alt={t('room.lobby.scan_hint')} class="room-lobby__qr-img" />
            <span class="room-lobby__qr-hint">{t('room.lobby.scan_hint')}</span>
          </div>
        {/if}
      {/if}

      <Card>
        <div class="room-lobby__field">
          <label class="room-lobby__field-label" for="lobby-pseudo">{t('room.join.pseudo_label')}</label>
          <input
            id="lobby-pseudo"
            class="room-lobby__input"
            type="text"
            maxlength="24"
            placeholder={t('room.join.pseudo_placeholder')}
            bind:value={pseudo}
            onkeydown={(e) => e.key === 'Enter' && handleJoin()}
          />
        </div>
        {#if formError}
          <p class="room-lobby__error" role="alert">{formError}</p>
        {/if}
        <Button variant="primary" fullWidth onclick={handleJoin}>
          <Icon name="hand-tap" size="md" />
          {t('room.join.submit')}
        </Button>
      </Card>

      <Button variant="ghost" fullWidth onclick={() => navigate({ name: 'home' })}>
        {t('nav.back')}
      </Button>
    </div>
  </div>
{/if}

<style>
  .room-lobby {
    min-height: 100dvh;
    display: flex;
    justify-content: center;
    background: var(--board);
  }

  .room-lobby__content {
    width: 100%;
    max-width: 30rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--gap-wide);
    padding: var(--gap-wide);
    padding-top: max(var(--gap-wide), env(safe-area-inset-top));
    padding-bottom: max(var(--gap-wide), env(safe-area-inset-bottom));
  }

  .room-lobby__label {
    font-family: var(--font-mono);
    font-size: var(--fs-label);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-mid);
  }

  .room-lobby__code {
    display: flex;
    justify-content: center;
    max-width: 100%;
    overflow-x: auto;
  }

  .room-lobby__qr {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--gap-tight);
  }

  .room-lobby__qr-img {
    width: 10rem;
    height: 10rem;
    background: var(--flap);
    border-radius: var(--radius-card);
    padding: 0.5rem;
  }

  .room-lobby__qr-hint {
    color: var(--ink-mid);
    font-size: var(--fs-micro);
  }

  .room-lobby__field {
    display: flex;
    flex-direction: column;
    gap: var(--gap-tight);
  }

  .room-lobby__field-label {
    font-family: var(--font-mono);
    font-size: var(--fs-label);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-mid);
  }

  .room-lobby__input {
    min-height: var(--touch-min);
    padding: 0.5rem 0.75rem;
    background: var(--flap);
    color: var(--flap-ink);
    font-family: var(--font-mono);
    font-size: var(--fs-body);
    border: none;
    border-radius: var(--radius-flap);
    box-shadow: 0 0.125rem 0 var(--hinge);
    width: 100%;
  }

  .room-lobby__input::placeholder {
    color: var(--ink-lo);
  }

  .room-lobby__error {
    margin: 0;
    color: var(--signal);
    font-size: var(--fs-micro);
  }
</style>
