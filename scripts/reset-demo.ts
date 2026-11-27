/**
 * Нээлтийн өмнөх ЦЭВЭР ЭХЛЭЛ (PROMPT 23, НЭГ удаа) — үйлчилгээ, цаг захиалга, гүйлгээ, demo үйлчлүүлэгч/цалин/ирц.
 *
 *   bun scripts/reset-demo.ts                    # dry-run: юу устахыг тоогоор + demo үйлчлүүлэгчийн жагсаалт
 *   bun scripts/reset-demo.ts --confirm          # DB host (+ storage) хэвлээд "yes" асууна → устгана
 *   --include-online                             # demo тэмдэгтэй ONLINE үйлчлүүлэгчдийг ч устгана (тодорхой заасан үед л)
 *
 * Demo үйлчлүүлэгч = имэйл example./demo, нэр "Туршилт"/demo, эсвэл 2026-11-25-аас өмнө үүссэн; анхдагчаар ONLINE биш.
 *
 * Хамгаалалт (reset-catalog-тэй ижил): host хэвлэнэ, "Нээлт хийгдсэн" DB-д татгалзана, "yes", нэг transaction.
 * Үлдээнэ: Collection, User, Branch (+ байршил), тохиргоо, сайтын контент/зураг (media bucket), AuditLog,
 *          PayrollRateSet, ExpenseCategory. Айлчлалын зураг: DB мөр + private bucket-ийн объект (commit-ийн дараа).
 * Холболт: RESET_DATABASE_URL → DIRECT_URL → DATABASE_URL. Storage: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */
import { createInterface } from "node:readline/promises";
import pg from "pg";
import { CATALOG_COUNTS, DEMO_KEEP_COUNTS, countAll, demoCounts, demoCustomers, describeTarget, hasPackageTables, launchedAt, resetDemo, transactionCounts } from "./lib/reset-sql";

const args = new Set(process.argv.slice(2));
const confirm = args.has("--confirm");
const includeOnline = args.has("--include-online");
const url = process.env.RESET_DATABASE_URL || process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("RESET_DATABASE_URL / DIRECT_URL / DATABASE_URL алга.");
  process.exit(1);
}
const target = describeTarget(url);
const storageBase = (process.env.SUPABASE_URL ?? "").replace(/\/+$/, "");
const storageKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const bucket = process.env.SUPABASE_PRIVATE_BUCKET || "visit-photos";
const storageTarget = storageBase && storageKey ? `${new URL(storageBase).hostname} / ${bucket}` : null;

console.log(`\n  ХОЛБОГДОЖ БУЙ DB: ${target}`);
console.log(`  PRIVATE STORAGE:  ${storageTarget ?? "тохируулаагүй — зургийн объектыг устгахгүй (DB мөр л)"}\n`);

const table = (rows: { label: string; count: number }[]) => {
  for (const r of rows) console.log(`  ${r.label.padEnd(34)} ${String(r.count).padStart(7)}`);
};

/** Private bucket-аас объект устгах (100-аар) — түлхүүрийг хэвлэхгүй */
async function removeObjects(keys: string[]) {
  if (!storageTarget || keys.length === 0) return 0;
  let removed = 0;
  for (let i = 0; i < keys.length; i += 100) {
    const batch = keys.slice(i, i + 100);
    const res = await fetch(`${storageBase}/storage/v1/object/${bucket}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${storageKey}`, apikey: storageKey, "content-type": "application/json" },
      body: JSON.stringify({ prefixes: batch }),
    });
    if (!res.ok) {
      console.error(`  ⚠ storage ${res.status} — ${batch.length} объект устгагдсангүй (дараа нь Supabase → Storage-оос)`);
      continue;
    }
    removed += batch.length;
  }
  return removed;
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const launched = await launchedAt(client);
  if (launched) {
    console.error(`Зогслоо: DB "нээлт хийгдсэн" гэж тэмдэглэгдсэн (${launched}). Demo цэвэрлэгээ хийхгүй.`);
    process.exitCode = 1;
  } else {
    console.log(confirm ? "Устгагдах:" : "Устгагдах (dry run — --confirm өгөөгүй тул юу ч өөрчлөхгүй):");
    table(await countAll(client, [...transactionCounts(true), ...demoCounts(includeOnline, await hasPackageTables(client)), ...CATALOG_COUNTS]));
    const people = await demoCustomers(client, includeOnline);
    console.log(`\nDemo үйлчлүүлэгчид${includeOnline ? " (ONLINE-ийг оруулсан)" : " (ONLINE-аар бүртгүүлсэн бодит хүмүүсийг ҮЛДЭЭНЭ)"}:`);
    for (const p of people) console.log(`    · ${p.name} (${p.phone})${p.online ? " — ONLINE" : ""}`);
    if (people.length === 200) console.log("    … (эхний 200)");
    console.log("\nҮлдэнэ:");
    table(await countAll(client, DEMO_KEEP_COUNTS));

    if (!confirm) {
      console.log("\nУстгахын тулд: bun scripts/reset-demo.ts --confirm");
    } else {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      const answer = (await rl.question(`\n${target}${storageTarget ? ` (+ ${storageTarget})` : ""} дээрх бүх demo өгөгдлийг устгана. Үргэлжлүүлэх үү? (yes) `)).trim();
      rl.close();
      if (answer !== "yes") {
        console.log("Цуцаллаа — юу ч өөрчлөгдсөнгүй.");
        process.exitCode = 1;
      } else {
        await client.query("BEGIN");
        const r = await resetDemo(client, { target, includeOnline });
        await client.query("COMMIT");
        console.log("\nДууслаа. Устгасан:");
        table(r.deleted);
        const removed = await removeObjects(r.photoKeys);
        console.log(`\n  Айлчлалын зураг: DB ${r.photoKeys.length}, private storage-аас ${removed}. AuditLog: demo.reset`);
        console.log("\nҮлдсэн:");
        table(await countAll(client, DEMO_KEEP_COUNTS));
      }
    }
  }
} catch (e) {
  await client.query("ROLLBACK").catch(() => undefined);
  console.error("Алдаа — юу ч өөрчлөгдсөнгүй:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await client.end();
}
