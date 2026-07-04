#!/usr/bin/env bash
# deploy.sh - Deploiement Kombien sur gazai
#
# Usage (depuis la machine locale avec ssh gazai configure) :
#   bash infra/deploy.sh
#
# Idempotent : relancable sans risque.
#
# Mecanisme : comme le repo est prive (a ce stade) et que deploy n'a pas de cle
# GitHub, on package le code local en tar.gz, on l'uploade par scp, on l'extrait
# et on build les images Docker sur place.
# Pour les MAJ : relancer le script depuis un repo local a jour.
#
# Prerequis :
#   - ssh gazai configure (alias -> sudo sans mdp)
#   - Docker rootless actif pour l'user deploy (/srv/dev/apps/)
#   - Traefik file-provider sur /srv/dev/traefik/dynamic/ (watch: true)
set -euo pipefail

# ── Variables ──────────────────────────────────────────────────────────────────
# SSH_TARGET : alias "gazai" en local (~/.ssh/config), ou "user@host" en CI
# (via les secrets SSH_USER/SSH_HOST, cf. .github/workflows/deploy.yml).
SSH_TARGET="${SSH_USER:+$SSH_USER@}${SSH_HOST:-gazai}"
APP_DIR="/srv/dev/apps/kombien"
TRAEFIK_DYNAMIC="/srv/dev/traefik/dynamic"
COMPOSE_FILE="$APP_DIR/infra/docker-compose.yml"
ENV_FILE="$APP_DIR/infra/.env"

log()  { echo "[deploy] $*"; }
warn() { echo "[deploy][WARN] $*" >&2; }

# ── 1. Packaging du code source local ─────────────────────────────────────────
log "Packaging du code source..."
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ARCHIVE="/tmp/kombien-deploy-$(date +%s).tar.gz"

tar -czf "$ARCHIVE" -C "$REPO_ROOT" \
  --exclude='./.git' \
  --exclude='./node_modules' \
  --exclude='./apps/*/node_modules' \
  --exclude='./apps/*/dist' \
  --exclude='./apps/*/coverage' \
  --exclude='./.claude' \
  --exclude='./infra/.env' \
  --exclude='./*.tsbuildinfo' \
  --exclude='./apps/*/*.tsbuildinfo' \
  .
log "Archive: $ARCHIVE ($(du -sh "$ARCHIVE" | cut -f1))"

# ── 2. Upload sur le VPS ───────────────────────────────────────────────────────
log "Upload vers $SSH_TARGET ..."
scp -q "$ARCHIVE" "$SSH_TARGET:/tmp/kombien-deploy.tar.gz"
rm -f "$ARCHIVE"
log "Upload OK"

# ── 3. Deploiement sur le VPS (en tant que deploy) ────────────────────────────
log "Execution du deploiement sur $SSH_TARGET ..."
ssh "$SSH_TARGET" sudo -iu deploy bash << REMOTE
set -euo pipefail

log()  { echo "[vps] \$*"; }
warn() { echo "[vps][WARN] \$*" >&2; }

APP_DIR="${APP_DIR}"
TRAEFIK_DYNAMIC="${TRAEFIK_DYNAMIC}"
COMPOSE_FILE="${COMPOSE_FILE}"
ENV_FILE="${ENV_FILE}"

# 3a. Extraction du code
log "Extraction vers \$APP_DIR ..."
mkdir -p "\$APP_DIR"
tar -xzf /tmp/kombien-deploy.tar.gz -C "\$APP_DIR"
rm -f /tmp/kombien-deploy.tar.gz || true

# 3b. Fichier .env (jamais ecrase si existant, secrets generes ici)
if [ ! -f "\$ENV_FILE" ]; then
  warn ".env absent - generation des secrets..."
  POSTGRES_PASSWORD=\$(openssl rand -hex 24)
  ADMIN_SECRET=\$(openssl rand -hex 32)
  cat > "\$ENV_FILE" <<ENVDEFAULTS
POSTGRES_USER=kombien
POSTGRES_PASSWORD=\$POSTGRES_PASSWORD
POSTGRES_DB=kombien
ADMIN_SECRET=\$ADMIN_SECRET
ENVDEFAULTS
  chmod 600 "\$ENV_FILE"
  log ".env genere (\$ENV_FILE, chmod 600)"
else
  log ".env existant conserve"
fi

# 3c. Config Traefik (backup avant modif, puis hot-reload - pas de restart Traefik)
log "Backup + mise a jour config Traefik..."
if [ -f "\$TRAEFIK_DYNAMIC/kombien.yml" ]; then
  cp "\$TRAEFIK_DYNAMIC/kombien.yml" "\$TRAEFIK_DYNAMIC/kombien.yml.bak-\$(date +%Y%m%d%H%M%S)"
fi
cp "\$APP_DIR/infra/traefik/kombien.yml" "\$TRAEFIK_DYNAMIC/kombien.yml"
log "Traefik : \$TRAEFIK_DYNAMIC/kombien.yml (hot-reload automatique)"

# 3d. Build des images Docker
cd "\$APP_DIR"
log "Build api..."
docker compose -f "\$COMPOSE_FILE" --env-file "\$ENV_FILE" build api
log "Build web..."
docker compose -f "\$COMPOSE_FILE" --env-file "\$ENV_FILE" build web

# 3e. (Re)demarrage des services (les migrations + seed conditionnel tournent
# au demarrage de l'api, voir apps/api/src/server.ts)
log "Demarrage des services..."
docker compose -f "\$COMPOSE_FILE" --env-file "\$ENV_FILE" up -d

# 3f. Attente healthcheck (max 90s) - db en premier car api en depend
log "Attente healthcheck (max 90s)..."
for svc in kombien-db kombien-redis kombien-api kombien-web; do
  ok=false
  for i in \$(seq 1 18); do
    status=\$(docker inspect --format='{{.State.Health.Status}}' "\$svc" 2>/dev/null || echo "missing")
    if [ "\$status" = "healthy" ]; then
      log "  \$svc : healthy"
      ok=true
      break
    elif [ "\$status" = "unhealthy" ]; then
      warn "  \$svc : UNHEALTHY"
      docker logs --tail=20 "\$svc" >&2 || true
      break
    fi
    sleep 5
  done
  \$ok || warn "  \$svc : pas encore healthy apres 90s"
done

# 3g. Tests loopback
log "Tests loopback :"
printf '  web (8013): ' && curl -sf http://127.0.0.1:8013/ > /dev/null && echo "OK" || echo "FAIL"
printf '  api (8014): ' && curl -sf http://127.0.0.1:8014/health || echo "FAIL"

# 3h. Nettoyage
docker image prune -f --filter 'until=24h' > /dev/null 2>&1 || true

log "Deploiement VPS termine."
REMOTE

# ── 4. Healthchecks depuis la machine locale ──────────────────────────────────
log ""
log "== Healthchecks externes =="
HTTP_CODE=$(curl -sk -o /dev/null -w "%{http_code}" "https://kombien.gazai.fr" 2>/dev/null || echo "ERR")
log "  kombien.gazai.fr      -> HTTP $HTTP_CODE"
API_RESP=$(curl -sk "https://kombien-api.gazai.fr/health" 2>/dev/null || echo "ERR")
log "  kombien-api.gazai.fr  -> $API_RESP"
log ""
log "URLs en ligne :"
log "  https://kombien.gazai.fr     (SPA)"
log "  https://kombien-api.gazai.fr (API)"
log ""
log "Deploiement termine."
