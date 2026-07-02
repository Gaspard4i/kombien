# kombien-api

Backend Fastify + PostgreSQL du jeu Kombien. Toutes les durées sont en secondes.

## Prérequis

- Node 22 LTS (ESM natif).
- PostgreSQL 16.

## Variables d'environnement

Copier `.env.example` en `.env` (jamais commité) :

| Variable       | Requis | Défaut | Rôle                                              |
|----------------|--------|--------|---------------------------------------------------|
| `DATABASE_URL` | oui    | —      | Chaîne de connexion PostgreSQL.                   |
| `ADMIN_SECRET` | non    | —      | Secret du header `x-admin-secret`. **Sans fallback** : si absent, toutes les routes `/admin/*` renvoient 401. |
| `PORT`         | non    | 3000   | Port d'écoute.                                    |
| `CORS_ORIGIN`  | non    | —      | Origine autorisée en production (permissif en dev). |

Aucun secret n'a de valeur par défaut dans le code. Le comparateur du header admin utilise `crypto.timingSafeEqual` (temps constant).

## Commandes

```bash
npm install
npm run dev            # dev hot-reload (node --watch, strip-types)
npm run build          # tsc -> dist/
npm start              # node dist/server.js (après build)
npm test               # node:test sur test/**
npm run test:coverage  # c8, seuil 100 % imposé sur src/domain/**
```

## Migrations & seed

Au démarrage, `src/db/migrate.ts` :

1. crée la table `schema_migrations` si absente ;
2. applique dans l'ordre alphabétique les fichiers `db/migrations/*.sql` non encore
   enregistrés (chaque migration + son insertion dans `schema_migrations` sont
   transactionnelles) ;
3. applique `db/seed/0001_seed.sql` **uniquement si la table `categories` est vide**
   (seed non versionné, conditionnel : premier amorçage sans écraser des données).

## Endpoints

- `GET /health`
- `GET /categories`
- `GET /categories/:slug/questions?count=5` — questions aléatoires `status='approved'`.
- `POST /questions` — contribution communautaire (créée en `status='pending'`).
- `POST /questions/:id/report` — incrémente `report_count`.
- `GET /admin/questions?status=pending` — protégé `x-admin-secret`.
- `POST /admin/questions/:id/approve` — protégé.
- `POST /admin/questions/:id/reject` — protégé.
- `POST /games` — enregistre une partie terminée ; recalcule score/précision/streak,
  XP et badges côté serveur ; upsert des joueurs ; retourne les badges débloqués.
- `GET /leaderboard?category=slug` — classement (global par XP si `category` absent).
- `GET /players/:pseudo` — profil (xp, niveau, badges, stats).

## Logique de jeu

Toute la logique de scoring/conversion/streak/XP/badges est **pure** dans
`src/domain/` (aucune I/O) et testée à 100 %. Elle implémente `docs/GAME_DESIGN.md`.
