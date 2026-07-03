<script lang="ts">
  // Point d'entrée SPA : branche l'écran courant selon le routeur par état (router.svelte.ts).
  import { getRoute } from './lib/router/router.svelte';
  import Home from './screens/Home.svelte';
  import Setup from './screens/Setup.svelte';
  import Game from './screens/game/Game.svelte';
  import End from './screens/End.svelte';
  import Contribute from './screens/Contribute.svelte';
  import Admin from './screens/Admin.svelte';
  import AdminImport from './screens/AdminImport.svelte';
  import AdminBulkCreate from './screens/AdminBulkCreate.svelte';

  const route = $derived(getRoute());
</script>

{#if route.name === 'home'}
  <Home cancelledGame={route.cancelledGame ?? false} />
{:else if route.name === 'setup'}
  <Setup />
{:else if route.name === 'game'}
  <Game />
{:else if route.name === 'end'}
  <End />
{:else if route.name === 'contribute'}
  <Contribute />
{:else if route.name === 'admin'}
  <Admin />
{:else if route.name === 'admin-import'}
  <AdminImport adminSecret={route.adminSecret} />
{:else if route.name === 'admin-bulk-create'}
  <AdminBulkCreate adminSecret={route.adminSecret} />
{/if}
