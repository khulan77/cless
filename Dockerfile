# Production image — app болон worker хоёулаа энэ image-ийг ашиглана
# (docker-compose.prod.yml). Build үед нүүр хуудсыг prerender хийдэг тул
# DATABASE_URL build arg-аар DB-д хүрэх ёстой.
FROM oven/bun:1.3.11 AS deps
WORKDIR /app
COPY package.json bun.lock prisma.config.ts ./
COPY prisma ./prisma
RUN bun install --frozen-lockfile

FROM oven/bun:1.3.11 AS build
WORKDIR /app
ARG DATABASE_URL
ARG NEXT_PUBLIC_SITE_URL
ENV DATABASE_URL=$DATABASE_URL NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

FROM oven/bun:1.3.11 AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
EXPOSE 20267
CMD ["bun", "run", "start"]
