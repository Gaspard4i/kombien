// Réexporte depuis state.svelte.ts : les runes Svelte 5 ($state) ne sont compilées par
// vite-plugin-svelte que dans les fichiers .svelte ou .svelte.ts. Ce fichier .ts garde
// le chemin d'import stable (../lib/i18n) pour tous les écrans/composants existants.
export * from './state.svelte';
