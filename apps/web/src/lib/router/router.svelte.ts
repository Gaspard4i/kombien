// Routeur minimaliste par état partagé (pas de lib externe : périmètre restreint,
// pas de deep-linking nécessaire pour un jeu pass-and-play joué en une session).
// Exception : /admin n'a aucun point d'entrée dans l'UI (pas de lien public visible pour la
// modération) -> on lit l'URL au chargement pour permettre d'y accéder directement.

export type Route =
  // cancelledGame (Lot 5 v2, GAME_DESIGN_V2.md §4.2 règle 4) : true quand l'arrivée sur
  // l'accueil suit l'annulation d'une partie interrompue pendant sa toute première manche
  // incomplète (pas de résultat classé à afficher, juste un message explicite sur Home).
  | { name: 'home'; cancelledGame?: boolean }
  | { name: 'setup' }
  | { name: 'game' }
  | { name: 'end' }
  | { name: 'contribute' }
  | { name: 'admin' }
  | { name: 'admin-import'; adminSecret: string }
  | { name: 'admin-bulk-create'; adminSecret: string }
  // Rooms multi-écrans (Lot 9) : deep-link public via lien/QR (/rooms/join?code=XXXXXX),
  // seule exception avec /admin à changer l'URL affichée (voir navigate() ci-dessous).
  | { name: 'room-create' }
  | { name: 'room-join'; code?: string }
  | { name: 'room-play'; code: string; pseudo: string };

function initialRoute(): Route {
  if (window.location.pathname === '/admin') return { name: 'admin' };
  if (window.location.pathname === '/rooms/join') {
    const code = new URLSearchParams(window.location.search).get('code') ?? undefined;
    return { name: 'room-join', code: code ?? undefined };
  }
  return { name: 'home' };
}

let current = $state<Route>(initialRoute());

export function getRoute(): Route {
  return current;
}

export function navigate(route: Route): void {
  current = route;
  const path = route.name === 'admin' ? '/admin' : route.name === 'room-join' ? '/rooms/join' : '/';
  window.history.replaceState({}, '', path);
  window.scrollTo(0, 0);
}

// Les écrans d'import/création en lot ne changent pas l'URL affichée (pas de
// deep-link public) : mêmes règles que /admin (pas de lien depuis home).
// room-create/room-play ne changent pas non plus l'URL (pas de deep-link utile : le code est
// dans le state applicatif, pas dans l'URL, une fois la connexion WS établie) ; seul
// room-join garde une URL stable pour le lien/QR partagé avant la connexion.
