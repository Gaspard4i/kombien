# PROGRESS — Kombien

> **État vivant du projet.** Source de vérité pour reprendre le travail entre sessions.
> Toujours mettre à jour cette page à la fin de chaque étape.

**Dernière mise à jour** : 2026-07-02
**Phase courante** : Backend + Direction artistique (en parallèle, sous-agents)
**Prochaine action** : à réception backend + DESIGN_SYSTEM.md → lancer le frontend (dépend des deux).

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
- [~] Backend — schéma SQL, migrations, API Fastify, tests scoring (sous-agent en cours)
- [ ] Frontend — Vite+Svelte, i18n fr/en, 3 modes, responsive
- [~] Design — DESIGN_SYSTEM.md direction artistique (sous-agent en cours), puis review Playwright
- [ ] DevOps — Dockerfiles, compose dev/prod, deploy.sh, deploy.yml, server-setup.sh
- [ ] QA — e2e Playwright, rapport local
- [ ] Validation user (feu vert requis)
- [ ] Production — déploiement gazai.fr, smoke test, rapport final
- [ ] README complet

## Journal
- 2026-07-02 : Phase 0 close. Infra gazai inspectée (Traefik v3, rootless, pattern dads-race). Nom = Kombien. Repo structuré, git init, CLAUDE.md + docs créés.

## Reprise rapide
Dire « reprends le projet kombien » → je relis ce fichier + la mémoire `project-ca-prend-du-temps*`.
