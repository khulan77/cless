/**
 * Хэт хуучирсан мэдэгдэл (PROMPT 22) — эхний tick-ээс ӨМНӨ хэдэн мөр алгасагдахыг харах.
 *
 *   bun scripts/stale-jobs.ts            # dry-run: төрлөөр тоо (юу ч өөрчлөхгүй)
 *   bun scripts/stale-jobs.ts --confirm  # host-ыг харуулж "yes" гэж баталгаажуулсны дараа SKIPPED болгоно
 *
 * Дүрэм (src/server/modules/jobs/stale.ts-тэй ИЖИЛ): PENDING SMS / APPT_EMAIL — runAfter 4 хоногоос хуучин;
 * APPT_REMINDER — runAfter 24 цагаас хуучин (цаг өнгөрсөн). Tick эхэнд нь мөн автоматаар ингэнэ.
 * Холболт: RESET_DATABASE_URL → DIRECT_URL → DATABASE_URL. Утас, агуулга хэвлэхгүй — зөвхөн тоо.
 */
import { createInterface } from "node:readline/promises";
import pg from "pg";

const confirm = process.argv.includes("--confirm");
const url = process.env.RESET_DATABASE_URL || process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("DIRECT_URL / DATABASE_URL алга.");
  process.exit(1);
}
const u = new URL(url);
console.log(`\n  ХОЛБОГДОЖ БУЙ DB: ${u.hostname}:${u.port || 5432}${u.pathname}\n`);

const WHERE = `"status" = 'PENDING' AND (
  ("type" IN ('SMS', 'APPT_EMAIL') AND "runAfter" < now() - interval '4 days')
  OR ("type" = 'APPT_REMINDER' AND "runAfter" < now() - interval '24 hours'))`;

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const r = await client.query<{ type: string; count: string; oldest: Date }>(`SELECT "type", count(*) AS count, min("runAfter") AS oldest FROM "OutboxJob" WHERE ${WHERE} GROUP BY 1 ORDER BY 1`);
  const pending = await client.query<{ type: string; count: string }>(`SELECT "type", count(*) AS count FROM "OutboxJob" WHERE "status" = 'PENDING' GROUP BY 1 ORDER BY 1`);
  console.log("Бүх PENDING ажил:");
  for (const p of pending.rows) console.log(`  ${p.type.padEnd(20)} ${p.count}`);
  console.log("\nАлгасагдах (SKIPPED):");
  if (r.rows.length === 0) console.log("  — алга");
  for (const x of r.rows) console.log(`  ${x.type.padEnd(20)} ${x.count}   (хамгийн хуучин: ${x.oldest.toISOString().slice(0, 16)})`);
  if (!confirm) {
    console.log("\nDry-run — юу ч өөрчлөөгүй. SKIPPED болгох: bun scripts/stale-jobs.ts --confirm");
  } else if (r.rows.length > 0) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const ok = (await rl.question(`\n${u.hostname} дээр дээрх ажлуудыг SKIPPED болгох уу? (yes) `)).trim() === "yes";
    rl.close();
    if (!ok) console.log("Цуцаллаа.");
    else {
      const d = await client.query(`UPDATE "OutboxJob" SET "status" = 'SKIPPED', "lockedAt" = NULL, "lastError" = 'SKIPPED: хэт хуучирсан (worker ажиллаагүй хугацаанд)', "updatedAt" = now() WHERE ${WHERE}`);
      console.log(`SKIPPED: ${d.rowCount}`);
    }
  }
} finally {
  await client.end();
}
