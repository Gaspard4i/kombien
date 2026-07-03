# Plan d'implémentation — Kombien v2

> Plan consolidé (game design + architecture) validé avec l'utilisateur.
> Références : [`GAME_DESIGN_V2.md`](./GAME_DESIGN_V2.md) (règles), cahier
> `kombien-v2-evolutions.md` (demande). Ce document est la **feuille de route** ;
> il fige le périmètre, les décisions et l'ordre des lots.

---

## Décisions verrouillées (utilisateur)

1. **Tout éphémère** : suppression profils / XP / niveaux / badges cumulés / classement
   global. Pseudo = simple libellé d'affichage. Le seul classement est celui de la **session
   de jeu** (en cours + final).
2. **Badges v1 → 5 « exploits de session »** non persistants (speedrunner, bullseye,
   perfect_round, on_fire, sharpshooter, centurion). Les 4 dépendant d'un historique
   multi-parties sont supprimés (first_game, duel_master, polyglot, time_lord).
3. **Mode Solo abandonné.** Minimum 2 joueurs. (Simplifie : pas de Duel-fantôme, pas de
   comparaison inter-parties localStorage.)
4. **Pass-and-play conservé** comme mode à part entière (un seul téléphone). L'endpoint
   `POST /games` est **gardé pour le scoring serveur-autoritatif (anti-triche)**, mais **ne
   persiste plus la partie** (pas de leaderboard/profil). Le classement de session est
   éphémère (dérivé côté client + validé serveur).
5. **Duel à N joueurs → classement par écart** (barème par rang, top marque ; se réduit
   exactement au Duel v1 pour 2 joueurs, zéro régression).
6. **Multi-écrans temps réel = dernier lot (v2.2)**, archi **Redis + WebSocket**.
7. **Identité split-flap + palette conservées et approfondies** (jamais remplacées).
8. Implémentation **lots 0 à 8 en enchaînement**, puis lot 9.

## Choix techniques tranchés (recherche à jour)

| Besoin | Choix | Raison |
|---|---|---|
| WebSocket | `@fastify/websocket` | Officiel, même serveur Fastify, `maxPayload` anti-DoS. |
| Client Redis | `node-redis` v4+ | Officiel, ioredis déprécié. |
| Parsing xlsx | **ExcelJS** | Streaming, sûr — évite les CVE de SheetJS/`xlsx`. |
| Parsing CSV | `csv-parse` | Mature serveur, streaming, validation ligne à ligne. |
| QR code | `qrcode` (soldair) | SVG + data URL, standard. |
| Routeur front | Enrichir le maison | Ajout parsing code de room dans l'URL, pas de dépendance lourde. |
| WS derrière Traefik | Voie (b) : `wss://kombien-api.gazai.fr/rooms/ws` | Traefik v3 gère l'upgrade WS nativement ; évite de patcher nginx. Nouvelle var `VITE_WS_BASE`. |

---

## Modèle de données — persistant vs éphémère

**Persistant (Postgres)** : `categories`, `questions`, modération (statuts pending/approved/
rejected), reports, et (nouveau, optionnel) `import_batches` (traçabilité des imports).

**Supprimé** : tables `players`, `games`, `game_scores`, `badges`, `player_badges`.

**Éphémère** : parties/scores/streaks pass-and-play (client + scoring serveur non persisté) ;
rooms multi-écrans (Redis TTL).

---

## Lots

### Lot 0 — Fondations & nettoyage (débloque tout, séquentiel)
- Backend : migration destructive (drop players/games/scores/badges), suppression endpoints
  `/leaderboard` et `/players/:pseudo`, retrait XP/badges de la réponse `POST /games`
  (garde le scoring, ne persiste plus la partie), **extraction couche service**
  `src/services/`, **correctif anti-triche** : recharger `duration_seconds`/`threshold_seconds`
  depuis `questions` par ID (ne plus faire confiance au client).
- Frontend : retrait `Leaderboard.svelte`, `Profile.svelte`, bouton Home Classement, routes,
  types, i18n `leaderboard/profile/badges`, champs XP de `End.svelte`.
- Agents : backend, frontend, qa.

### Lot 1 — Modes de participation N-joueurs pass-and-play
- game-designer (règles N-joueurs déjà dans GAME_DESIGN_V2). Duo conservé, 3+ ajouté, solo écarté.
- Frontend : `Setup` N pseudos, `gameStore` → `PlayerSlot[]`, state machine boucle N joueurs,
  `ScoreBar` multi.
- Backend : `POST /games` accepte `players` de longueur variable (≥2).

### Lot 2 — Sélection de thèmes flexible
- 4 modes (global / vote / multi-thèmes union / par joueur) + croisement v1 en option.
- Backend : tirage multi-catégories `GET /questions?categories=a,b,c&count=N`.
- Frontend : écran de sélection réutilisable. design-reviewer.

### Lot 3 — Questions différenciées par joueur
- Backend : tirage en sous-ensembles disjoints (partition applicative, pas `ORDER BY random()`).
- Scoring Duel : **écart relatif** (`|est-durée|/durée`) — se réduit à v1 si questions communes.
- Frontend : un jeu de questions par joueur.

### Lot 4 — Calibration binaire (parallélisable après Lot 0)
- 5 questions, pool dédié, **seuil individuel par joueur** (moyenne géométrique des bornes).
- Backend : seuil calibré = paramètre de partie éphémère, utilisé par `scoreBinary`.
- Frontend : écran de calibration.

### Lot 5 — Fin de partie assouplie
- Arrêt à tout moment (limite de points ET manuel unifiés). Manche incomplète à l'arrêt =
  annulée (retour au dernier tour complet). Arrêt en 1re manche = partie annulée.

### Lot 6 — Import & création en masse (parallélisable après Lot 0)
- Backend : `POST /admin/questions/import` (CSV/xlsx/md, validation ligne à ligne → pending,
  rapport d'erreurs), templates téléchargeables (**template générique unique**).
- Frontend : écran upload + preview + rapport ; écran création en lot avec **brouillon
  localStorage** (récupérable après crash/refresh).

### Lot 7 — Classement de session
- Frontend : classement en cours + final, 100% dérivé de l'état de partie. design-reviewer.

### Lot 8 — Extension du thème split-flap (parallèle continu)
- design-reviewer : audit écran par écran (captures Playwright mobile+desktop), boucle jusqu'à
  conformité. Frontend applique. Pousser gamification (séries, célébration exploits, montée de score).

### Lot 9 — Multi-écrans temps réel (v2.2, DERNIER) — Redis + WebSocket
- devops : conteneur Redis (dev+prod, réseau interne, pas de port exposé), `REDIS_URL`,
  healthcheck, ajout à deploy.sh. WS via `kombien-api.gazai.fr` (Traefik natif).
- Backend : `@fastify/websocket`, state room en Redis (Hash + Sorted Set classement, TTL 30min),
  timer serveur-autoritatif (10s configurable), room code + QR, reconnexion (snapshot), scoring
  par-réponse via domaine pur. 3 modes supportés.
- Frontend : 3 interfaces (écran principal / manette MJ sans réponses / appareil joueur),
  client WS (`src/lib/ws/`, reconnexion exponentielle, heartbeat).

---

## Ordre & parallélisation

```
Lot 0 ──┬─ Lot 1 ─ Lot 2 ─ Lot 3
        │        └─ Lot 5
        ├─ Lot 4        (parallèle)
        ├─ Lot 6        (parallèle)
        ├─ Lot 7  [dépend Lot 1]
        └─ Lot 8  (design, parallèle continu)
                  │
Lot 9 ◄───────────┘  (dépend de tout)
```

## Invariants (non négociables)
Palette/identité split-flap conservées, scoring 100% serveur (réponses brutes), mobile-first,
accessibilité AA + clavier + reduced-motion, bilingue fr/en (aucune chaîne en dur), commits
atomiques, pas de secret en clair, build+tests+lint verts, QA e2e avant tout déploiement,
aucun push/MEP sans feu vert explicite.
