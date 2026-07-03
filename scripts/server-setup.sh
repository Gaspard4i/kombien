#!/usr/bin/env bash
# server-setup.sh - Preparation initiale de gazai pour Kombien
#
# Usage : ssh gazai puis, en tant que deploy :
#   sudo -iu deploy bash server-setup.sh
# (ou copier ce script sur le VPS avant de le lancer)
#
# Idempotent : relancable sans risque, ne detruit rien d'existant.
# Ne fait AUCUN deploiement applicatif (voir infra/deploy.sh pour ca) :
# ce script prepare seulement le terrain (dossiers, permissions, verifs).
set -euo pipefail

APP_DIR="/srv/dev/apps/kombien"
TRAEFIK_DYNAMIC="/srv/dev/traefik/dynamic"
ENV_FILE="$APP_DIR/infra/.env"

log()  { echo "[server-setup] $*"; }
warn() { echo "[server-setup][WARN] $*" >&2; }

# ── 1. Verifier qu'on tourne bien en tant que deploy (Docker rootless) ────────
if [ "$(whoami)" != "deploy" ]; then
  warn "Ce script doit tourner en tant que user 'deploy' (Docker rootless)."
  warn "Relancer avec : sudo -iu deploy bash $0"
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  warn "Docker (rootless) inaccessible pour l'user deploy. Verifier l'installation avant de continuer."
  exit 1
fi
log "Docker rootless OK ($(docker --version))"

# ── 2. Arborescence app ────────────────────────────────────────────────────────
log "Preparation de $APP_DIR ..."
mkdir -p "$APP_DIR"
log "  OK"

# ── 3. Reseau Docker interne (idempotent : ignore si existe deja) ─────────────
if ! docker network inspect kombien-internal >/dev/null 2>&1; then
  log "Creation du reseau kombien-internal..."
  docker network create kombien-internal >/dev/null
else
  log "Reseau kombien-internal deja present"
fi

# ── 4. Verifier Traefik file-provider ──────────────────────────────────────────
if [ ! -d "$TRAEFIK_DYNAMIC" ]; then
  warn "$TRAEFIK_DYNAMIC introuvable : Traefik file-provider n'est peut-etre pas configure."
  warn "La config Traefik de Kombien (infra/traefik/kombien.yml) ne pourra pas etre deposee tant que ce dossier n'existe pas."
else
  log "Traefik dynamic dir OK ($TRAEFIK_DYNAMIC)"
fi

# ── 5. .env : ne jamais ecraser un fichier existant ────────────────────────────
if [ -f "$ENV_FILE" ]; then
  log ".env deja present ($ENV_FILE) - conserve tel quel"
else
  warn ".env absent - sera genere automatiquement par infra/deploy.sh au premier deploiement"
  warn "(secrets POSTGRES_PASSWORD / ADMIN_SECRET generes sur le serveur, jamais dans le repo)"
fi

log ""
log "Terrain pret pour Kombien. Prochaine etape : bash infra/deploy.sh (depuis la machine locale)."
