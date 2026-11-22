import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

/** Only a local Postgres may be wiped by tests — never Supabase / a remote host */
export function assertLocalDb(url: string) {
  const host = new URL(url).hostname;
  if (!["127.0.0.1", "localhost"].includes(host) || /supabase/i.test(url)) {
    throw new Error(`Тест зөвхөн локал DB-д ажиллана (олдсон: ${host})`);
  }
}

/** Creates the database if needed, drops the public schema and applies every migration in order */
export async function resetLocalDb(url: string) {
  assertLocalDb(url);
  const u = new URL(url);
  const name = u.pathname.slice(1);
  const admin = new pg.Client({ connectionString: Object.assign(new URL(url), { pathname: "/postgres" }).toString() });
  await admin.connect();
  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
  if (exists.rowCount === 0) await admin.query(`CREATE DATABASE "${name.replace(/"/g, "")}"`);
  await admin.end();

  const c = new pg.Client(url);
  await c.connect();
  await c.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
  const dir = join(process.cwd(), "prisma/migrations");
  for (const m of readdirSync(dir).filter((d) => /^\d+_/.test(d)).sort()) {
    await c.query(readFileSync(join(dir, m, "migration.sql"), "utf8"));
  }
  await c.end();
}
