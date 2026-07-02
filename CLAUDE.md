# Kombien — instructions projet

Jeu web d'estimation de durée en duo, **pass-and-play** sur le même appareil.
« Kombien de temps ça prend ? » Deux joueurs estiment la durée de tâches ; le plus juste marque.

## Architecture

Monorepo simple (pas de turborepo, pas de workspaces npm — chaque app a son `package.json`).

```
kombien/
  apps/
    web/        Frontend Vite + Svelte (TypeScript). Build statique servi par nginx.
    api/        Backend Node.js + Fastify (TypeScript). API REST JSON.
  db/
    migrations/ Migrations SQL versionnées (0001_*.sql, 0002_*.sql, …). Appliquées en ordre.
    seed/       Données de seed (catégories, questions, badges).
  infra/        Dockerfiles context, compose prod, config Traefik, deploy.sh.
  docs/         PROGRESS.md (état vivant), DECISIONS.md, GAME_DESIGN.md.
  scripts/      server-setup.sh idempotent.
  .github/workflows/  deploy.yml (CI/CD).
```

## Règles fondamentales

- **Durées toujours en secondes en base.** Conversion vers unités lisibles côté logique/affichage uniquement.
- **i18n dès le départ** : fr (défaut) + en. Fichiers JSON. Détection navigateur, sélecteur persisté (localStorage). **Aucune chaîne en dur** dans l'UI.
- **Mobile-first.** Le jeu se joue sur un téléphone qu'on se passe. Cibles tactiles ≥ 44px. Tester 375 / 768 / 1280.
- **Pas de pixels durs** dans le styling (rem/em). Arbitrary `[Npx]` tolérés seulement pour touch targets / micro-tailles.
- **Design non-générique** : métaphore du temps poussée à fond. Interdits : dégradés violet/bleu par défaut, cards blanches arrondies sur fond gris, Inter/Roboto par réflexe, emojis en guise d'icônes.
- Accessibilité : contrastes AA, navigation clavier, `prefers-reduced-motion`.
- **Pas de mention IA/Claude** dans le code, commits, docs. Pas d'emojis en UI (icônes SVG).

## Commandes

Depuis la racine :

```bash
# Dev (hot-reload, DB dans Docker)
docker compose -f infra/docker-compose.dev.yml up

# API seule (dev local hors Docker)
cd apps/api && npm install && npm run dev

# Front seul
cd apps/web && npm install && npm run dev

# Tests API (scoring/conversion)
cd apps/api && npm test

# Build prod complet
docker compose -f infra/docker-compose.yml build

# E2E (Playwright, app up requise)
cd apps/web && npm run test:e2e

# Déploiement gazai (après validation)
bash infra/deploy.sh
```

## Modes de jeu

1. **Binaire** — « ça prend longtemps / pas longtemps » vs seuil de catégorie. Bonne réponse = 1 pt.
2. **Ordre de grandeur** — choisir l'unité (s/min/h/j/sem/mois/an). Exacte = 3 pts, adjacente = 1 pt.
3. **Duel** — chaque joueur saisit valeur + unité. Le plus proche = 2 pts, égalité = 1 pt chacun.

Streaks : x2 dès 3 bonnes réponses consécutives, x3 dès 5. Voir `docs/GAME_DESIGN.md`.

## Conventions

- Commits conventionnels (`feat:`, `fix:`, `chore:`, `docs:`…), atomiques, en français ou anglais concis.
- Jamais `git add -A` — ajouter les fichiers précis.
- Ne jamais commiter `.env`, `.claude/`, secrets.
- Avant commit : build + tests passent. Avant push prod : vérif locale complète.

## Déploiement (serveur gazai.fr)

- Reverse proxy **Traefik v3** file-provider (`/srv/dev/traefik/dynamic/`, hot-reload).
- HTTPS auto via wildcard `*.gazai.fr` (certResolver OVH). Sous-domaines **niveau 1** uniquement.
- Front : `kombien.gazai.fr` (loopback 127.0.0.1:8013). API : `kombien-api.gazai.fr` (loopback 127.0.0.1:8014).
- Apps sous `/srv/dev/apps/kombien/`, Docker **rootless** (user `deploy`). Détails : `docs/DECISIONS.md`.

## Reprise de session

**Lire `docs/PROGRESS.md` en premier** à chaque nouvelle session : c'est l'état vivant du projet (phase, tâches faites/en cours/à faire, prochaine action).
