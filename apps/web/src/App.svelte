<script lang="ts">
  // Point d'entrée SPA : branche l'écran courant selon le routeur par état (router.svelte.ts).
  import { getRoute } from './lib/router/router.svelte';
  import Home from './screens/Home.svelte';
  import Setup from './screens/Setup.svelte';
  import Game from './screens/game/Game.svelte';
  import End from './screens/End.svelte';
  import Leaderboard from './screens/Leaderboard.svelte';
  import Profile from './screens/Profile.svelte';
  import Contribute from './screens/Contribute.svelte';
  import Admin from './screens/Admin.svelte';

  const route = $derived(getRoute());
</script>

{#if route.name === 'home'}
  <Home />
{:else if route.name === 'setup'}
  <Setup />
{:else if route.name === 'game'}
  <Game />
{:else if route.name === 'end'}
  <End />
{:else if route.name === 'leaderboard'}
  <Leaderboard />
{:else if route.name === 'profile'}
  <Profile pseudo={route.pseudo} />
{:else if route.name === 'contribute'}
  <Contribute />
{:else if route.name === 'admin'}
  <Admin />
{/if}
