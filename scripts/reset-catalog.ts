/**
 * Нээлтийн өмнө demo каталогийг цэвэрлэх (НЭГ удаа). Клиент бүтээгдэхүүнээ зурагтай нь шинээр оруулна.
 *
 *   bun scripts/reset-catalog.ts             # dry-run: юу устахыг тоогоор (юу ч өөрчлөхгүй)
 *   bun scripts/reset-catalog.ts --confirm   # host-ыг харуулж "yes" гэж баталгаажуулсны дараа устгана
 *
 * Холболт: RESET_DATABASE_URL → DIRECT_URL → DATABASE_URL. Эхэнд host-ыг хэвлэнэ (нууц үггүй).
 * Устгана: reset-transactions-ийн бүх гүйлгээ (үйлчлүүлэгчдийг үлдээж) + бүх StockMovement, үйлчилгээний материал,
 *          багц, холбоотой бүтээгдэхүүн, зураг (DB мөр), хувилбар, үнийн түүх, ангиллын холбоос, бүтээгдэхүүн,
 *          бүтээгдэхүүний урамшууллын дүрэм.
 * Үлдээнэ: Collection (бүгд), Service, User, Customer, Appointment, тохиргоо, AuditLog, цалин.
 *          Storage (Supabase) дахь зураг — устгахгүй.
 * "Нээлт хийгдсэн" (SiteSetting system.launchedAt) DB дээр ажиллахгүй. Нэг transaction.
 */
import { createInterface } from "node:readline/promises";
import pg from "pg";
import { CATALOG_COUNTS, CATALOG_KEEP_COUNTS, countAll, describeTarget, launchedAt, resetCatalog, transactionCounts } from "./lib/reset-sql";

const confirm = process.argv.includes("--confirm");
const url = process.env.RESET_DATABASE_URL || process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("RESET_DATABASE_URL / DIRECT_URL / DATABASE_URL алга.");
  process.exit(1);
}
const target = describeTarget(url);
const source = process.env.RESET_DATABASE_URL ? "RESET_DATABASE_URL" : process.env.DIRECT_URL ? "DIRECT_URL" : "DATABASE_URL";
console.log(`\n  ХОЛБОГДОЖ БУЙ DB: ${target}   (${source})\n`);

const table = (rows: { label: string; count: number }[]) => {
  for (const r of rows) console.log(`  ${r.label.padEnd(34)} ${String(r.count).padStart(7)}`);
};

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const launched = await launchedAt(client);
  if (launched) {
    console.error(`Зогслоо: DB "нээлт хийгдсэн" гэж тэмдэглэгдсэн (${launched}). Каталогийг устгахгүй.`);
    process.exitCode = 1;
  } else {
    console.log(confirm ? "Устгагдах:" : "Устгагдах (dry run — --confirm өгөөгүй тул юу ч өөрчлөхгүй):");
    table(await countAll(client, [...transactionCounts(true), ...CATALOG_COUNTS]));
    console.log("\nҮлдэнэ:");
    table(await countAll(client, CATALOG_KEEP_COUNTS));

    if (!confirm) {
      console.log("\nУстгахын тулд: bun scripts/reset-catalog.ts --confirm");
    } else {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      const answer = (await rl.question(`\n${target} дээрх бүх бүтээгдэхүүн, гүйлгээг устгана. Үргэлжлүүлэх үү? (yes) `)).trim();
      rl.close();
      if (answer !== "yes") {
        console.log("Цуцаллаа — юу ч өөрчлөгдсөнгүй.");
        process.exitCode = 1;
      } else {
        await client.query("BEGIN");
        const r = await resetCatalog(client, { target });
        await client.query("COMMIT");
        console.log("\nДууслаа. Устгасан:");
        table(r.deleted);
        console.log(`\n  ${r.imagesLeftInStorage} зураг storage-д үлдсэн (DB-ээс л устгав). AuditLog: catalog.reset`);
        console.log("\nҮлдсэн:");
        table(await countAll(client, CATALOG_KEEP_COUNTS));
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
