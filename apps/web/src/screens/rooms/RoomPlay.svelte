<script lang="ts">
  // Orchestrateur de room connectée (Lot 9) : ouvre le WS, affiche le lobby d'attente (liste
  // de joueurs + bouton démarrer pour le MJ), puis bascule vers l'une des 3 interfaces selon
  // le statut de la room et le mode d'affichage choisi.
  //
  // Interprétation du rôle "écran principal" (aucun rôle serveur dédié, cf API_CONTRACT.md
  // "un seul canal ... le rôle MJ est déterminé côté serveur ... jamais déclaré par le
  // client") : le protocole ne distingue que MJ / joueur (RoomStateMessage.you.isGameMaster).
  // L'écran principal est donc un MODE D'AFFICHAGE choisi côté client au lobby, pas un rôle
  // serveur -- il rejoint la room comme un joueur ordinaire (avec un pseudo, ex. "Écran"), mais
  // son interface (MainScreen.svelte) n'affiche jamais de zone de réponse et ignore son propre
  // statut hasAnswered/score : c'est un mode lecture seule côté client uniquement. Poser ce
  // mode sur un appareil séparé (l'un des écrans partagés du salon) fonctionne, mais il compte
  // alors comme un joueur de plus dans room:state.players -- à documenter pour l'utilisateur
  // (voir room.lobby.main_screen_hint, i18n) : le mieux est de lancer l'écran principal avant
  // que les vrais joueurs rejoignent, ou d'accepter qu'il apparaisse dans la liste des joueurs.
  import { onDestroy, onMount } from 'svelte';
  import { t } from '../../lib/i18n';
  import { navigate } from '../../lib/router/router.svelte';
  import { connectToRoom, type RoomConnection } from '../../lib/ws/roomClient';
  import { getRoomState, resetRoomState, isGameMaster } from '../../lib/ws/roomStore.svelte';
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
  }

  const { code, pseudo }: Props = $props();

  const room = getRoomState();

  // Mode d'affichage choisi au lobby (voir note ci-dessus) : 'auto' résout ensuite en 'master'
  // ou 'player' selon room.you.isGameMaster, 'main' est un choix explicite qui prime toujours.
  let displayMode = $state<'auto' | 'main'>('auto');

  let connection = $state<RoomConnection | null>(null);

  onMount(() => {
    connection = connectToRoom(code, pseudo);
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

  const showLobbyWait = $derived(room.connection === 'connected' && room.status === 'lobby');
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

    {#if displayMode === 'main'}
      <MainScreen {connection} />
    {:else if showLobbyWait}
      <div class="room-play__lobby">
        <span class="room-play__code-label">{t('room.lobby.title')}</span>

        <div class="room-play__players">
          {#each room.players as player (player.id)}
            <div class="room-play__player" class:room-play__player--disconnected={!player.connected}>
              <span class="room-play__player-pseudo">{player.pseudo}</span>
              {#if player.isGameMaster}
                <Icon name="seal" size="sm" />
              {/if}
              {#if !player.connected}
                <span class="room-play__player-status">{t('room.connection.disconnected_player')}</span>
              {/if}
            </div>
          {/each}
        </div>

        {#if isGameMaster()}
          <p class="room-play__hint">{t('room.lobby.you_are_master')}</p>
          <Button variant="primary" fullWidth onclick={handleStart} disabled={room.players.length === 0}>
            {t('room.lobby.start')}
          </Button>
        {:else}
          <p class="room-play__hint">{t('room.lobby.waiting_master')}</p>
        {/if}

        <!-- Mode écran principal (voir note en tête de fichier) : choix explicite tant que
             la partie n'a pas démarré -- prime sur master/player une fois activé. -->
        <Button variant="ghost" fullWidth onclick={() => (displayMode = 'main')}>
          {t('room.lobby.use_as_main_screen')}
        </Button>
        <p class="room-play__hint room-play__hint--micro">{t('room.lobby.main_screen_hint')}</p>

        <Button variant="ghost" fullWidth onclick={handleLeave}>{t('nav.back')}</Button>
      </div>
    {:else if isGameMaster()}
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

  .room-play__hint--micro {
    font-size: var(--fs-micro);
    margin-top: -0.5rem;
  }
</style>
