# Build depuis la racine du repo (contexte = racine, pas apps/api) car
# src/db/migrate.ts calcule REPO_ROOT en remontant 4 niveaux depuis dist/db/
# (apps/api/dist/db/migrate.js -> ../../../..). On reproduit donc la même
# arborescence relative dans l'image : /app/apps/api/dist + /app/db.

FROM node:22-alpine AS build
WORKDIR /app/apps/api
COPY apps/api/package.json apps/api/package-lock.json ./
RUN npm ci
COPY apps/api/tsconfig.json ./
COPY apps/api/src ./src
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app/apps/api
ENV NODE_ENV=production

COPY apps/api/package.json apps/api/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/apps/api/dist ./dist
COPY db ../../db

# Utilisateur non-root fourni par l'image node:alpine.
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "dist/server.js"]
