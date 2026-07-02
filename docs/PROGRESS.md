# PROGRESS — Kombien

> **État vivant du projet.** Source de vérité pour reprendre le travail entre sessions.
> Toujours mettre à jour cette page à la fin de chaque étape.

**Dernière mise à jour** : 2026-07-02
**Phase courante** : Backend écrit (tests à finaliser) + design system prêt. Frontend à lancer.
**Prochaine action APRÈS REDÉMARRAGE** :
1. Utiliser les AGENTS PROJET de `.claude/agents/` (game-designer, backend, frontend, design-reviewer, devops, qa) — le prompt l'exige. Ils ne sont routables qu'après un redémarrage de Claude Code.
2. Finaliser/vérifier le backend via l'agent `backend` : `cd apps/api && npm install && npm test` (viser 100% couverture domain). Le code est écrit et commité ; seul le run install+tests reste à confirmer.
3. Lancer l'agent `frontend` : Vite+Svelte, i18n fr/en, les 3 modes, design split-flap (voir docs/DESIGN_SYSTEM.md), contrat API dans docs/API_CONTRACT.md.
4. Puis `devops` (Dockerfiles + compose dev/prod + deploy.sh + deploy.yml + server-setup.sh), `design-reviewer` (captures Playwright mobile+desktop), `qa` (e2e), et enfin compose up local pour l'essai complet.

Objectif utilisateur : version COMPLÈTE testable en local d'un coup (pas de vertical slice).

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
- 2026-07-02 : Phase 0 close. Infra gazai inspectée (Traefik v3, rootless, pattern dads-race). Nom = Kombien. Repo structuré, git init, CLAUDE.md + docs créés.

## Reprise rapide
Dire « reprends le projet kombien » → je relis ce fichier + la mémoire `project-ca-prend-du-temps*`.
