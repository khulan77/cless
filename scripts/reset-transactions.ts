/**
 * Нээлтийн өмнө туршилтын гүйлгээг цэвэрлэх (НЭГ удаа).
 *
 *   bun scripts/reset-transactions.ts            # юу устахыг харуулна (юу ч өөрчлөхгүй)
 *   bun scripts/reset-transactions.ts --confirm  # устгана
 *   --keep-customers                              # үйлчлүүлэгчдийг үлдээнэ
 *
 * Устгана: борлуулалт (мөр, төлбөр, QPay гүйлгээ, буцаалт, eBarimt), айлчлал ба зөвлөмж,
 * кассын ээлж ба мөнгөний хөдөлгөөн, борлуулалттай холбоотой StockMovement,
 * борлуулалтын дугаарын тоолуур, POS-ийн outbox ажлууд, цаг захиалга/хэтэвчгүй үйлчлүүлэгчид.
 * Үлдээнэ: каталог, орлого/тооллогын StockMovement, хэрэглэгчид, тохиргоо, AuditLog.
 * Дараа нь Variant.stock-ийг үлдсэн StockMovement-уудаас дахин тооцож, reserved = 0.
 *
 * NODE_ENV=production үед ажиллахгүй. Нэг transaction — алдаа гарвал юу ч өөрчлөгдөхгүй.
 */
import pg from "pg";

const args = new Set(process.argv.slice(2));
const confirm = args.has("--confirm");
const keepCustomers = args.has("--keep-customers");

if (process.env.NODE_ENV === "production") {
  console.error("NODE_ENV=production үед ажиллахгүй.");
  process.exit(1);
}
const url = process.env.RESET_DATABASE_URL || process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL / DIRECT_URL алга.");
  process.exit(1);
}
const target = (() => {
  const u = new URL(url);
  return `${u.hostname}:${u.port || 5432}${u.pathname}`;
})();

/** Цаг захиалга, хэтэвчгүй (зөвхөн туршилтын POS-оос үүссэн) үйлчлүүлэгчид */
const CUSTOMER_WHERE = `NOT EXISTS (SELECT 1 FROM "Appointment" a WHERE a."customerId" = c."id")
  AND NOT EXISTS (SELECT 1 FROM "Wallet" w WHERE w."customerId" = c."id")`;

const COUNTS: [string, string][] = [
  ["Борлуулалт", `SELECT count(*) FROM "Sale"`],
  ["Борлуулалтын мөр", `SELECT count(*) FROM "SaleItem"`],
  ["Төлбөр", `SELECT count(*) FROM "Payment"`],
  ["QPay гүйлгээ", `SELECT count(*) FROM "PaymentTransaction"`],
  ["Буцаалт", `SELECT count(*) FROM "Refund"`],
  ["eBarimt", `SELECT count(*) FROM "EbarimtReceipt"`],
  ["Айлчлал", `SELECT count(*) FROM "Visit"`],
  ["Зөвлөмж", `SELECT count(*) FROM "VisitRecommendation"`],
  ["Кассын ээлж", `SELECT count(*) FROM "CashShift"`],
  ["Кассын хөдөлгөөн", `SELECT count(*) FROM "CashMovement"`],
  ["Борлуулалтын StockMovement", `SELECT count(*) FROM "StockMovement" WHERE "saleId" IS NOT NULL`],
  ["POS outbox ажил", `SELECT count(*) FROM "OutboxJob" WHERE "type" IN ('VISIT_EMAIL', 'QPAY_CANCEL_INVOICE')`],
  ...(keepCustomers ? [] : ([["Үйлчлүүлэгч", `SELECT count(*) FROM "Customer" c WHERE ${CUSTOMER_WHERE}`]] as [string, string][])),
];

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  console.log(`DB: ${target}`);
  console.log(confirm ? "Устгах:" : "Устгагдах (dry run — --confirm өгөөгүй тул юу ч өөрчлөхгүй):");
  for (const [label, sql] of COUNTS) {
    const r = await client.query<{ count: string }>(sql);
    console.log(`  ${label.padEnd(28)} ${r.rows[0]!.count}`);
  }
  if (!keepCustomers) {
    const names = await client.query<{ name: string; phone: string }>(`SELECT c."name", c."phone" FROM "Customer" c WHERE ${CUSTOMER_WHERE} ORDER BY c."createdAt" LIMIT 50`);
    for (const c of names.rows) console.log(`    · ${c.name} (${c.phone})`);
  }

  if (!confirm) {
    console.log("\nУстгахын тулд: bun scripts/reset-transactions.ts --confirm");
    process.exitCode = 1;
  } else {
    await client.query("BEGIN");
    const steps = [
      `DELETE FROM "CashMovement"`,
      `DELETE FROM "PaymentTransaction"`,
      `DELETE FROM "Payment"`,
      `DELETE FROM "Refund"`,
      `DELETE FROM "EbarimtReceipt"`,
      `DELETE FROM "CashShift"`,
      `DELETE FROM "VisitRecommendation"`,
      `DELETE FROM "Visit"`,
      `DELETE FROM "StockMovement" WHERE "saleId" IS NOT NULL`,
      `UPDATE "WalletTxn" SET "saleId" = NULL WHERE "saleId" IS NOT NULL`,
      `DELETE FROM "SaleItem"`,
      `DELETE FROM "Sale"`,
      `DELETE FROM "SaleCounter"`,
      `DELETE FROM "OutboxJob" WHERE "type" IN ('VISIT_EMAIL', 'QPAY_CANCEL_INVOICE')`,
      ...(keepCustomers ? [] : [`DELETE FROM "Customer" c WHERE ${CUSTOMER_WHERE}`]),
    ];
    for (const sql of steps) await client.query(sql);

    // Variant.stock = үлдсэн movement-уудын нийлбэр (кэш), нөөц 0
    const changed = await client.query<{ sku: string; before: number; after: number }>(`
      WITH sums AS (
        SELECT v."id", COALESCE(SUM(m."qty"), 0)::int AS total
        FROM "Variant" v LEFT JOIN "StockMovement" m ON m."variantId" = v."id"
        GROUP BY v."id"
      ), old AS (SELECT "id", "stock" FROM "Variant")
      UPDATE "Variant" v SET "stock" = s.total, "reserved" = 0, "updatedAt" = (now() AT TIME ZONE 'UTC')
      FROM sums s, old o
      WHERE v."id" = s."id" AND o."id" = v."id" AND (v."stock" <> s.total OR v."reserved" <> 0)
      RETURNING v."sku", o."stock" AS before, s.total AS after`);
    await client.query("COMMIT");
    console.log(`\nДууслаа. Үлдэгдэл дахин тооцогдсон хувилбар: ${changed.rowCount}`);
    for (const r of changed.rows) console.log(`  ${r.sku}: ${r.before} → ${r.after}`);
  }
} catch (e) {
  await client.query("ROLLBACK").catch(() => undefined);
  console.error("Алдаа — юу ч өөрчлөгдсөнгүй:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await client.end();
}
