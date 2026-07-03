# PROGRESS — Kombien

> **État vivant du projet.** Source de vérité pour reprendre le travail entre sessions.
> Toujours mettre à jour cette page à la fin de chaque étape.

**Dernière mise à jour** : 2026-07-02
**IMPORTANT RELANCE** : pour que les agents projet (.claude/agents/) soient routables, Claude Code DOIT être démarré DEPUIS le dossier `kombien/` lui-même (pas le parent `projects/`). Commande : `cd C:\Users\GaspardCatry\Documents\personel\projects\kombien` puis `claude`. Vérifier au démarrage que l'agent `frontend` existe (sinon fallback general-purpose avec mêmes instructions).
**Phase courante** : EN LIGNE. Frontend + backend + infra déployés en prod sur https://kombien.gazai.fr (API https://kombien-api.gazai.fr). QA e2e 32/32, 61 tests API. Retours utilisateur à venir.
**Prochaine action APRÈS REDÉMARRAGE de Claude Code** :
1. Utiliser les AGENTS PROJET de `.claude/agents/` (game-designer, backend, frontend, design-reviewer, devops, qa) — le prompt l'exige. Ils ne sont routables qu'après un redémarrage (Claude Code lit .claude/agents/ au démarrage seulement).
2. Lancer l'agent `frontend` : Vite+Svelte, i18n fr/en, les 3 modes, design split-flap (docs/DESIGN_SYSTEM.md), contrat API réel dans docs/API_CONTRACT.md. Le front envoie les réponses BRUTES à POST /games ; le backend recalcule score/xp/badges (anti-triche).
3. Puis agent `devops` (Dockerfiles multi-stage web+api, compose dev/prod, deploy.sh pattern gazai, deploy.yml GitHub Actions env production approbation manuelle, server-setup.sh). Ports loopback 8013/8014. web nginx proxy /api -> api:3000.
4. Puis agent `design-reviewer` (captures Playwright mobile 375 + desktop 1280, boucle jusqu'à conformité split-flap).
5. Puis agent `qa` (e2e Playwright : 3 modes, i18n, responsive, contribution, admin) + `docker compose up` local.
6. Présenter résumé + captures + tests à l'utilisateur → attendre feu vert → PROD gazai (aucune prod sans accord).

Objectif utilisateur : version COMPLÈTE testable en local d'un coup (pas de vertical slice).

## Backend — récap validé
- 61 tests (node:test), 100% couverture sur src/domain/ (units, scoring, streak, xp, badges, game).
- Build tsc OK (dist/). Endpoints: voir docs/API_CONTRACT.md. Migrations 0001_init + 0002_player_counters. Runner applique migrations + seed conditionnel au démarrage.
- Env: DATABASE_URL, ADMIN_SECRET (sans fallback), PORT=3000. .env.example en placeholders. Admin auth = header x-admin-secret (timingSafeEqual).

## Sécurité (règle ferme — voir mémoire feedback-security-secrets-server)
Aucun secret en clair (code/config/docs), jamais push .env, secrets prod générés sur serveur chmod 600, DB non exposée, backup Traefik avant modif, clé deploy dédiée, aucune prod sans accord user.

## Décisions verrouillées (Phase 0)
- Nom : **Kombien**. Repo : `Gaspard4i/kombien` (public). Local : `.../projects/kombien`.
- Prod : `kombien.gazai.fr` (front) + `kombien-api.gazai.fr` (API). Loopback 8013 / 8014.
- Langues : fr (défaut) + en.
- Serveur : Traefik v3 file-provider, HTTPS OVH wildcard, Docker rootless user `deploy`, `ssh gazai` sudo sans mdp.
- Détails infra & CI/CD : voir `DECISIONS.md`.

## Checklist macro
- [x] Phase 0 — Découverte (questions, infra serveur inspectée)
- [x] Phase 1 — Échafaudage repo + CLAUDE.md + docs + agents
- [x] Phase 2/3 — Game design + seed (5 cat, 47 questions, 10 badges) — poussé GitHub
- [~] Backend — code écrit+commité (schéma, migrations 0001/0002, domaine scoring, routes). RESTE : npm install + npm test (100% couverture domain à confirmer).
- [ ] Frontend — Vite+Svelte, i18n fr/en, 3 modes, responsive (à lancer via agent `frontend`)
- [x] Design — DESIGN_SYSTEM.md (split-flap Solari) prêt. RESTE : review Playwright après le front.
- Contrat API réel figé dans docs/API_CONTRACT.md. Unités: second/minute/hour/day/week/month/year.
- [ ] DevOps — Dockerfiles, compose dev/prod, deploy.sh, deploy.yml, server-setup.sh
- [ ] QA — e2e Playwright, rapport local
- [ ] Validation user (feu vert requis)
- [ ] Production — déploiement gazai.fr, smoke test, rapport final
- [ ] README complet

## Journal
- 2026-07-03 : Frontend complet (3 modes, i18n, split-flap) + infra Docker/Traefik + CI. QA e2e 32/32, 6 bugs bloquants corrigés. Poussé sur main. **Déployé en prod gazai** : https://kombien.gazai.fr + https://kombien-api.gazai.fr (TLS OK, healthy). Secrets générés serveur.
- 2026-07-02 : Phase 0 close. Infra gazai inspectée (Traefik v3, rootless, pattern dads-race). Nom = Kombien. Repo structuré, git init, CLAUDE.md + docs créés.

## Reprise rapide
Dire « reprends le projet kombien » → je relis ce fichier + la mémoire `project-ca-prend-du-temps*`.
