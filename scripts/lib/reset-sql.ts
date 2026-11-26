/**
 * Нээлтийн өмнөх цэвэрлэгээний SQL — reset-transactions.ts ба reset-catalog.ts хуваалцана.
 * pg.Client (эсвэл `query`-тэй ямар ч client) дээр, дуудагчийн transaction дотор ажиллана.
 */

export type Queryable = { query: <R extends object = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{ rows: R[]; rowCount: number | null }> };
export type Count = [label: string, sql: string];

/** Цаг захиалга, хэтэвчгүй (зөвхөн туршилтын POS-оос үүссэн) үйлчлүүлэгчид */
export const CUSTOMER_WHERE = `NOT EXISTS (SELECT 1 FROM "Appointment" a WHERE a."customerId" = c."id")
  AND NOT EXISTS (SELECT 1 FROM "Wallet" w WHERE w."customerId" = c."id")`;

// ───────────────────────── Гүйлгээ (reset-transactions) ─────────────────────────

export function transactionCounts(keepCustomers: boolean): Count[] {
  return [
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
    ...(keepCustomers ? [] : ([["Үйлчлүүлэгч", `SELECT count(*) FROM "Customer" c WHERE ${CUSTOMER_WHERE}`]] as Count[])),
  ];
}

export function transactionSteps(keepCustomers: boolean): string[] {
  return [
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
}

// ───────────────────────── Каталог (reset-catalog) ─────────────────────────

/**
 * Бүтээгдэхүүн ба тэдгээрийг барьдаг бүх мөр. Ангилал (Collection), үйлчилгээ (Service), үйлчлүүлэгч,
 * цаг захиалга, тохиргоо, AuditLog, цалин — үлдэнэ. Storage-ийн зураг — үлдэнэ (зөвхөн DB).
 */
export const CATALOG_COUNTS: Count[] = [
  ["Бүтээгдэхүүн", `SELECT count(*) FROM "Product"`],
  ["Хувилбар (Variant)", `SELECT count(*) FROM "Variant"`],
  ["Бүтээгдэхүүний зураг (DB)", `SELECT count(*) FROM "ProductImage"`],
  ["Ангиллын холбоос", `SELECT count(*) FROM "ProductCollection"`],
  ["Холбоотой бүтээгдэхүүн", `SELECT count(*) FROM "ProductRelation"`],
  ["Багцын мөр", `SELECT count(*) FROM "BundleItem"`],
  ["Үнийн түүх", `SELECT count(*) FROM "PriceHistory"`],
  ["StockMovement (бүгд)", `SELECT count(*) FROM "StockMovement"`],
  ["Үйлчилгээний материал", `SELECT count(*) FROM "ServiceConsumable"`],
  ["Бүтээгдэхүүний урамшууллын дүрэм", `SELECT count(*) FROM "CommissionRule" WHERE "productId" IS NOT NULL`],
];

export const CATALOG_KEEP_COUNTS: Count[] = [
  ["Ангилал (Collection)", `SELECT count(*) FROM "Collection"`],
  ["Үйлчилгээ (Service)", `SELECT count(*) FROM "Service"`],
  ["Үйлчлүүлэгч", `SELECT count(*) FROM "Customer"`],
  ["Цаг захиалга", `SELECT count(*) FROM "Appointment"`],
];

export const CATALOG_STEPS: string[] = [
  `DELETE FROM "StockMovement"`,
  `DELETE FROM "ServiceConsumable"`,
  `DELETE FROM "BundleItem"`,
  `DELETE FROM "CommissionRule" WHERE "productId" IS NOT NULL`,
  `DELETE FROM "ProductRelation"`,
  `DELETE FROM "ProductImage"`,
  `DELETE FROM "PriceHistory"`,
  `DELETE FROM "Variant"`,
  `DELETE FROM "ProductCollection"`,
  `DELETE FROM "Product"`,
];

export async function countAll(q: Queryable, counts: Count[]): Promise<{ label: string; count: number }[]> {
  const out: { label: string; count: number }[] = [];
  for (const [label, sql] of counts) {
    const r = await q.query<{ count: string }>(sql);
    out.push({ label, count: Number(r.rows[0]!.count) });
  }
  return out;
}

/** "Нээлт хийгдсэн" (SiteSetting system.launchedAt) — бодит DB, цэвэрлэхгүй */
export async function launchedAt(q: Queryable): Promise<string | null> {
  const r = await q.query<{ value: { launchedAt?: string } | null }>(`SELECT "value" FROM "SiteSetting" WHERE "key" = 'system'`);
  return r.rows[0]?.value?.launchedAt ?? null;
}

/** Холболтын host:port/db — нууц үггүй */
export function describeTarget(url: string): string {
  const u = new URL(url);
  return `${u.hostname}:${u.port || 5432}${u.pathname}`;
}

/**
 * Каталогийг цэвэрлэнэ (дуудагчийн BEGIN…COMMIT дотор). Гүйлгээ (reset-transactions, үйлчлүүлэгчдийг үлдээж) →
 * каталог. Буцаана: устгасан тоо, storage-д үлдсэн зургийн тоо. AuditLog-д `catalog.reset`.
 */
export async function resetCatalog(q: Queryable, opts: { target: string }) {
  const before = await countAll(q, [...transactionCounts(true), ...CATALOG_COUNTS]);
  const images = before.find((c) => c.label === "Бүтээгдэхүүний зураг (DB)")?.count ?? 0;
  for (const sql of transactionSteps(true)) await q.query(sql);
  for (const sql of CATALOG_STEPS) await q.query(sql);
  // Тохиргоог хөндөхгүй: нүүрний "онцлох бүтээгдэхүүн" олдохгүй бол хэсэг өөрөө нуугдана
  const deleted = Object.fromEntries(before.map((c) => [c.label, c.count]));
  await q.query(
    `INSERT INTO "AuditLog" ("id", "userId", "action", "entity", "entityId", "after", "createdAt")
     VALUES ($1, NULL, 'catalog.reset', 'Catalog', 'all', $2::jsonb, now())`,
    [`reset_${Date.now().toString(36)}`, JSON.stringify({ deleted, imagesLeftInStorage: images, target: opts.target })],
  );
  return { deleted: before, imagesLeftInStorage: images };
}
