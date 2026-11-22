/**
 * Нээлтийн өмнөх шалгалт (READ-ONLY — юу ч өөрчлөхгүй):
 *   bun run preflight
 * Орчны хувьсагч (app + worker), DB холболт, migration бүгд орсон эсэх, ADMIN хэрэглэгч,
 * "Нээлтийн бэлэн байдал"-ын бүх мөр. Аль нэг нь FAIL бол exit 1.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { db } from "@/server/db";
import { checkEnv } from "@/server/env";
import { SEED_EMAIL_DOMAIN, readiness } from "@/server/modules/system/readiness";

type Row = { ok: boolean; label: string; detail?: string };
const rows: Row[] = [];
const add = (ok: boolean, label: string, detail?: string) => rows.push({ ok, label, detail });

// 1. Орчны хувьсагч
for (const target of ["app", "worker"] as const) {
  const { issues, warnings } = checkEnv(process.env, target);
  add(issues.length === 0, `Орчны хувьсагч (${target})`, issues.map((i) => `${i.key}: ${i.message}`).join("; ") || undefined);
  for (const w of warnings) console.log(`  ! ${target} ${w.key}: ${w.message}`);
}

try {
  // 2. DB холболт
  const [{ db_name }] = await db.$queryRaw<{ db_name: string }[]>`SELECT current_database() AS db_name`;
  add(true, "DB холболт", db_name);

  // 3. Migration бүгд орсон эсэх
  const local = readdirSync(join(process.cwd(), "prisma/migrations")).filter((d) => /^\d+_/.test(d)).sort();
  const applied = await db.$queryRaw<{ migration_name: string }[]>`
    SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
  const missing = local.filter((m) => !applied.some((a) => a.migration_name === m));
  add(missing.length === 0, "Migration бүгд орсон", missing.length ? `дутуу: ${missing.join(", ")}` : `${local.length}`);

  // 4. Бодит ADMIN (seed-ийн биш)
  const admins = await db.user.count({ where: { role: "ADMIN", isActive: true, NOT: { email: { endsWith: SEED_EMAIL_DOMAIN } } } });
  add(admins > 0, "Идэвхтэй ADMIN хэрэглэгч (seed-ийн биш)", `${admins}`);

  // 5. Нээлтийн бэлэн байдал (хянах самбартай ижил)
  const r = await readiness();
  for (const i of r.items) add(i.ok, i.label, i.detail);
} catch (e) {
  add(false, "DB холболт", e instanceof Error ? e.message.split("\n")[0] : String(e));
} finally {
  await db.$disconnect().catch(() => undefined);
}

const width = Math.max(...rows.map((r) => r.label.length));
for (const r of rows) console.log(`${r.ok ? "OK  " : "FAIL"}  ${r.label.padEnd(width)}${r.detail ? `  — ${r.detail}` : ""}`);
const failed = rows.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} шалгалт FAIL.` : "\nБүх шалгалт OK.");
process.exit(failed ? 1 : 0);
