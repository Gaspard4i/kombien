<script lang="ts">
  // Orchestrateur de room connectée (Lot 9) : ouvre le WS, affiche le lobby d'attente (liste
  // de joueurs + bouton démarrer pour l'hôte), puis bascule vers l'une des 3 interfaces selon
  // le rôle attribué par le SERVEUR (room:state.you, cf API_CONTRACT.md §6.1) :
  // - hôte non-joueur (isHost && !isPlaying) : écran de présentation + contrôleur (MainScreen),
  //   jamais de zone de réponse, jamais dans le classement.
  // - hôte joueur (isHost && isPlaying) : répond ET pilote (MasterView).
  // - joueur simple : répond seulement (PlayerView).
  // `hostToken`/`isPlaying` ne sont fournis que par le créateur (RoomLobby, juste après
  // POST /rooms) -- un joueur qui rejoint via /rooms/join n'a jamais de hostToken.
  import { onDestroy, onMount } from 'svelte';
  import { t } from '../../lib/i18n';
  import { navigate } from '../../lib/router/router.svelte';
  import { connectToRoom, type RoomConnection } from '../../lib/ws/roomClient';
  import { getRoomState, resetRoomState, isHost, isPlaying } from '../../lib/ws/roomStore.svelte';
  import AppShell from '../../lib/components/AppShell.svelte';
  import Button from '../../lib/components/Button.svelte';
  import ErrorMessage from '../../lib/components/ErrorMessage.svelte';
  import Skeleton from '../../lib/components/Skeleton.svelte';
  import Icon from '../../lib/components/Icon.svelte';
  import MainScreen from './MainScreen.svelte';
  import MasterView from './MasterView.svelte';
  import PlayerView from './PlayerView.svelte';

  interface Props {
    code: string;
    pseudo: string;
    hostToken?: string;
    isPlayingHost?: boolean;
  }

  const { code, pseudo, hostToken, isPlayingHost }: Props = $props();

  const room = getRoomState();

  let connection = $state<RoomConnection | null>(null);

  onMount(() => {
    connection = connectToRoom(code, pseudo, { hostToken, isPlaying: isPlayingHost });
  });

  onDestroy(() => {
    connection?.close();
    resetRoomState();
  });

  function handleLeave(): void {
    connection?.close();
    resetRoomState();
    navigate({ name: 'home' });
  }

  function handleStart(): void {
    connection?.mjStart();
  }

  const showLobbyWait = $derived(room.connection === 'connected' && room.status === 'lobby' && !isHost());
</script>

<AppShell>
  {#if room.connection === 'connecting' || room.connection === 'idle'}
    <p class="room-play__status">{t('room.connection.connecting')}</p>
    <Skeleton rows={4} />
  {:else if room.connection === 'error'}
    <ErrorMessage message={t(`errors.${room.errorCode}`)} />
    <Button variant="primary" fullWidth onclick={handleLeave}>{t('nav.back')}</Button>
  {:else}
    {#if room.connection === 'reconnecting'}
      <p class="room-play__status room-play__status--warn">{t('room.connection.reconnecting')}</p>
    {/if}

    {#if isHost() && !isPlaying()}
      <MainScreen {connection} isHost />
    {:else if showLobbyWait}
      <div class="room-play__lobby">
        <span class="room-play__code-label">{t('room.lobby.title')}</span>

        <div class="room-play__players">
          {#each room.players as player (player.id)}
            <div class="room-play__player" class:room-play__player--disconnected={!player.connected}>
              <span class="room-play__player-pseudo">{player.pseudo}</span>
              {#if player.isHost}
                <Icon name="seal" size="sm" />
              {/if}
              {#if !player.connected}
                <span class="room-play__player-status">{t('room.connection.disconnected_player')}</span>
              {/if}
            </div>
          {/each}
        </div>

        {#if isHost()}
          <p class="room-play__hint">{t('room.lobby.you_are_host')}</p>
          <Button variant="primary" fullWidth onclick={handleStart} disabled={room.players.length === 0}>
            {t('room.lobby.start')}
          </Button>
        {:else}
          <p class="room-play__hint">{t('room.lobby.waiting_host')}</p>
        {/if}

        <Button variant="ghost" fullWidth onclick={handleLeave}>{t('nav.back')}</Button>
      </div>
    {:else if isHost()}
      <MasterView {connection} />
    {:else}
      <PlayerView {connection} />
    {/if}
  {/if}
</AppShell>

<style>
  .room-play__status {
    text-align: center;
    color: var(--ink-mid);
    font-size: var(--fs-body);
  }

  .room-play__status--warn {
    color: var(--amber);
  }

  .room-play__lobby {
    display: flex;
    flex-direction: column;
    gap: var(--gap);
  }

  .room-play__code-label {
    font-family: var(--font-display);
    font-size: var(--fs-heading);
    font-weight: 500;
    color: var(--ink-hi);
    text-align: center;
  }

  .room-play__players {
    display: flex;
    flex-direction: column;
    gap: var(--gap-tight);
  }

  .room-play__player {
    display: flex;
    align-items: center;
    gap: var(--gap-tight);
    min-height: var(--touch-min);
    padding: 0.5rem 0.75rem;
    background: var(--board-raised);
    border-radius: var(--radius-card);
    color: var(--ink-hi);
    font-family: var(--font-display);
    font-weight: 700;
  }

  .room-play__player--disconnected {
    opacity: 0.5;
  }

  .room-play__player-pseudo {
    flex: 1;
  }

  .room-play__player-status {
    font-family: var(--font-mono);
    font-size: var(--fs-micro);
    color: var(--ink-mid);
  }

  .room-play__hint {
    margin: 0;
    text-align: center;
    color: var(--ink-mid);
    font-size: var(--fs-body);
  }
</style>
