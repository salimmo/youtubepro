# syntax=docker/dockerfile:1.7
# Mehrstufiger Build für YouTube Pro (Coolify-/Docker-tauglich).
# Stufe 1 baut Client (Vite) und Server (esbuild), Stufe 2 enthält nur die
# Produktionsabhängigkeiten und das dist-Verzeichnis.

ARG NODE_VERSION=22.17.1

# ---------- Build ----------
FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app
ENV NODE_ENV=development
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---------- Produktionsabhängigkeiten ----------
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---------- Laufzeit ----------
FROM node:${NODE_VERSION}-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=5000 \
    TRUST_PROXY=1 \
    ENV_FILE=/app/data/.env

# Kleines Verzeichnis für die per Settings-Seite gespeicherte .env (optional als Volume).
RUN mkdir -p /app/data && chown -R node:node /app

COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./

USER node
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1 || exit 1

CMD ["node", "dist/index.cjs"]
