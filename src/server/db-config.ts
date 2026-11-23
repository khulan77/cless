import type { PoolConfig } from "pg";

/** Prisma-only URL parameters: meaningful to Prisma's own engine, unknown to node-postgres */
const PRISMA_ONLY_PARAMS = ["pgbouncer", "connection_limit", "pool_timeout", "statement_cache_size", "schema"] as const;

/**
 * DATABASE_URL → node-postgres pool config for @prisma/adapter-pg.
 *
 * - Prisma-only query params (?pgbouncer=true&connection_limit=1 …) are removed: pg would pass unknown
 *   params through as config keys, and `schema` is not a pg setting.
 * - Pool size: DB_POOL_MAX, else 3 on Vercel (one pool per serverless instance; the Supabase pooler
 *   has a client limit), else pg's default 10.
 * - Transaction pooler (Supabase :6543 / ?pgbouncer=true): no `-c TimeZone=UTC` startup option —
 *   session settings don't survive across pooled transactions and the pooler may refuse the
 *   parameter; Supabase itself runs in UTC. Elsewhere (local brew Postgres in Asia/Ulaanbaatar) it
 *   stays, because adapter-pg sends timestamptz values without an offset.
 */
export function pgPoolConfig(databaseUrl: string, env: Record<string, string | undefined> = process.env): PoolConfig {
  const url = new URL(databaseUrl);
  const transactionPooler = url.port === "6543" || url.searchParams.get("pgbouncer") === "true";
  for (const p of PRISMA_ONLY_PARAMS) url.searchParams.delete(p);

  const fromEnv = Number.parseInt(env.DB_POOL_MAX ?? "", 10);
  const max = Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : env.VERCEL ? 3 : 10;

  return {
    connectionString: url.toString(),
    max,
    ...(transactionPooler ? {} : { options: "-c TimeZone=UTC" }),
  };
}
