import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { TEST_DATABASE_URL } from "./test-db-url";

/** Тестийн DB-г цэвэрлээд бүх migration-ийг дарааллаар нь ажиллуулна. */
export default async function setup() {
  const url = TEST_DATABASE_URL;
  const host = new URL(url).hostname;
  if (!["127.0.0.1", "localhost"].includes(host) || /supabase/i.test(url)) {
    throw new Error(`DB тест зөвхөн локал DB-д ажиллана (олдсон: ${host})`);
  }

  const c = new pg.Client(url);
  await c.connect();
  await c.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
  const dir = join(process.cwd(), "prisma/migrations");
  for (const m of readdirSync(dir).filter((d) => /^\d+_/.test(d)).sort()) {
    await c.query(readFileSync(join(dir, m, "migration.sql"), "utf8"));
  }
  await c.end();
}
