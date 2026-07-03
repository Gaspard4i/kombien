// Routeur minimaliste par état partagé (pas de lib externe : périmètre restreint,
// pas de deep-linking nécessaire pour un jeu pass-and-play joué en une session).
// Exception : /admin n'a aucun point d'entrée dans l'UI (pas de lien public visible pour la
// modération) -> on lit l'URL au chargement pour permettre d'y accéder directement.

export type Route =
  | { name: 'home' }
  | { name: 'setup' }
  | { name: 'game' }
  | { name: 'end' }
  | { name: 'contribute' }
  | { name: 'admin' }
  | { name: 'admin-import'; adminSecret: string }
  | { name: 'admin-bulk-create'; adminSecret: string };

function initialRoute(): Route {
  return window.location.pathname === '/admin' ? { name: 'admin' } : { name: 'home' };
}

let current = $state<Route>(initialRoute());

export function getRoute(): Route {
  return current;
}

export function navigate(route: Route): void {
  current = route;
  const path = route.name === 'admin' ? '/admin' : '/';
  window.history.replaceState({}, '', path);
  window.scrollTo(0, 0);
}

// Les écrans d'import/création en lot ne changent pas l'URL affichée (pas de
// deep-link public) : mêmes règles que /admin (pas de lien depuis home).
