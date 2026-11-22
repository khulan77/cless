# syntax=docker/dockerfile:1.7
#
# CLÉSS production image.
#   runner (default) — Next.js standalone (`node server.js`) + bundle хийсэн worker (`bun worker/index.js`)
#   tools            — бүрэн эх код + node_modules: prisma migrate deploy, scripts/create-admin.ts
#
# Build үед нүүр хуудас prerender хийгддэг тул DB хэрэгтэй: DATABASE_URL-ийг BuildKit secret-ээр
# дамжуулна (image-ийн түүхэнд үлдэхгүй). docker-compose.prod.yml-ийг үз.

ARG BUN_VERSION=1.3.11
ARG NODE_VERSION=22

FROM oven/bun:${BUN_VERSION}-slim AS bun

# ─── base: Node (Next.js) + Bun (install, worker) ───
FROM node:${NODE_VERSION}-bookworm-slim AS base
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
RUN apt-get update \
  && apt-get install -y --no-install-recommends tzdata ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*
ENV TZ=Asia/Ulaanbaatar \
    NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# ─── deps ───
FROM base AS deps
COPY package.json bun.lock prisma.config.ts ./
COPY prisma ./prisma
RUN bun install --frozen-lockfile

# ─── build ───
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
    NODE_ENV=production
RUN bun run db:generate
RUN --mount=type=secret,id=database_url,required=true \
    DATABASE_URL="$(cat /run/secrets/database_url)" bun run build \
  && bun scripts/build-worker.ts

# ─── tools: migrate deploy, create-admin (зөвхөн `docker compose run --rm tools …`) ───
FROM build AS tools
CMD ["bun", "run", "db:deploy"]

# ─── runner ───
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# standalone нь public/ ба .next/static-ийг хуулдаггүй — гараар хуулна
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/dist/worker ./worker
# public/uploads — volume (админаас оруулсан зураг), .emails — RESEND тохируулаагүй үеийн fallback
RUN mkdir -p public/uploads .emails && chown node:node public/uploads .emails
USER node
EXPOSE 3000
CMD ["node", "server.js"]
