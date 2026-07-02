# PROGRESS — Kombien

> **État vivant du projet.** Source de vérité pour reprendre le travail entre sessions.
> Toujours mettre à jour cette page à la fin de chaque étape.

**Dernière mise à jour** : 2026-07-02
**Phase courante** : Phase 1 — échafaudage & agents
**Prochaine action** : créer les 6 agents `.claude/agents/`, puis game design.

## Décisions verrouillées (Phase 0)
- Nom : **Kombien**. Repo : `Gaspard4i/kombien` (public). Local : `.../projects/kombien`.
- Prod : `kombien.gazai.fr` (front) + `kombien-api.gazai.fr` (API). Loopback 8013 / 8014.
- Langues : fr (défaut) + en.
- Serveur : Traefik v3 file-provider, HTTPS OVH wildcard, Docker rootless user `deploy`, `ssh gazai` sudo sans mdp.
- Détails infra & CI/CD : voir `DECISIONS.md`.

## Checklist macro
- [x] Phase 0 — Découverte (questions, infra serveur inspectée)
- [~] Phase 1 — Échafaudage repo + CLAUDE.md + docs + agents
- [ ] Phase 2/3 — Game design + seed (≥40 questions, ≥8 badges)
- [ ] Backend — schéma SQL, migrations, API Fastify, tests scoring
- [ ] Frontend — Vite+Svelte, i18n fr/en, 3 modes, responsive
- [ ] Design — identité visuelle temps, review Playwright mobile+desktop
- [ ] DevOps — Dockerfiles, compose dev/prod, deploy.sh, deploy.yml, server-setup.sh
- [ ] QA — e2e Playwright, rapport local
- [ ] Validation user (feu vert requis)
- [ ] Production — déploiement gazai.fr, smoke test, rapport final
- [ ] README complet

## Journal
- 2026-07-02 : Phase 0 close. Infra gazai inspectée (Traefik v3, rootless, pattern dads-race). Nom = Kombien. Repo structuré, git init, CLAUDE.md + docs créés.

## Reprise rapide
Dire « reprends le projet kombien » → je relis ce fichier + la mémoire `project-ca-prend-du-temps*`.
