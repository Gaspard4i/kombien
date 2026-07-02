# DECISIONS — Kombien

Journal des choix techniques non bloquants, tranchés en autonomie. Format : décision + raison.

## D-001 — Nom & branding
**Kombien** (jeu de mots sur « combien de temps », K = identité visuelle forte, cherchable, unique). Repo `Gaspard4i/kombien`, **public** (projet vitrine aligné aux autres apps gazai).

## D-002 — Frontend : Vite + Svelte (vs vanilla TS)
Svelte choisi : réactivité intégrée sans boilerplate, bundle très léger (proche du vanilla après compilation), excellent pour une SPA de jeu avec beaucoup d'état local (manches, scores, streaks). Vite pour le build statique servi par nginx.

## D-003 — Monorepo simple (pas de workspaces / turborepo)
Deux apps indépendantes (`apps/web`, `apps/api`) avec leur propre `package.json`. Le projet est petit ; workspaces npm ajouteraient de la complexité sans bénéfice. Docker builds isolés par app.

## D-004 — Migrations SQL brutes versionnées (pas d'ORM)
Fichiers `db/migrations/NNNN_description.sql` appliqués en ordre par un petit runner au démarrage de l'API (table `schema_migrations`). Pas d'ORM : le modèle est simple, le SQL reste lisible et portable, et la logique de scoring vit dans le code (testable en isolation).

## D-005 — Sous-domaines niveau 1 (kombien-api, pas api.kombien)
Le certificat wildcard `*.gazai.fr` de gazai ne couvre qu'un seul niveau. Donc `kombien.gazai.fr` + `kombien-api.gazai.fr`, jamais `api.kombien.gazai.fr`. (Pattern confirmé sur dads-race.)

## D-006 — Ports loopback 8013 (web) / 8014 (api)
8001–8012 déjà occupés sur gazai (dads-race = 8010/8011/8012). db sans port exposé (réseau Docker interne uniquement).

## D-007 — CI/CD : GitHub Actions + voie deploy.sh
Le prompt demande un workflow `deploy.yml` (lint+test → build → push ghcr.io → job SSH prod **séparé et conditionné** par l'environnement GitHub `production` à **approbation manuelle**). C'est implémenté.
**Mais** l'infra réelle de gazai déploie via un script local `infra/deploy.sh` (tar.gz → scp → build sur place en Docker rootless user `deploy`), car les repos privés/l'user `deploy` n'ont pas de clé GitHub. On fournit **les deux** : le workflow pour la conformité au prompt et la reproductibilité CI, et `deploy.sh` comme voie manuelle éprouvée compatible serveur. Choix de la voie de prod à confirmer au moment du déploiement.
Bonne pratique retenue pour le gate prod : **GitHub Environment `production` avec required reviewers** (approbation manuelle) — plus souple qu'un déclenchement par tag, garde l'historique d'approbation.

## D-008 — Admin : mot de passe unique en variable d'environnement
`ADMIN_SECRET` (env). Page admin minimaliste protégée par ce secret (header ou session courte). Pas de système de comptes admin (hors scope). Modération des questions `pending`.

## D-009 — Profils légers par pseudo (pas d'auth)
Un joueur = un pseudo unique. Pas de mot de passe (jeu convivial en local). XP/badges/stats persistés par pseudo. Risque d'usurpation assumé (jeu casual pass-and-play).

## D-010 — Postgres 16 (imposé), image alpine
`postgres:16-alpine` pour la légèreté. Volume nommé pour la persistance.
