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

// ───────────────────────── Demo (reset-demo, PROMPT 23) ─────────────────────────

/** Demo үйлчлүүлэгч: ONLINE биш, seed/туршилтын тэмдэгтэй эсвэл 2026-11-25-аас өмнө үүссэн */
export const DEMO_CUTOFF = "2026-11-25";
export function demoCustomerWhere(includeOnline: boolean) {
  const demo = `(c."email" ILIKE '%example.%' OR c."email" ILIKE '%demo%' OR c."name" ILIKE '%туршилт%' OR c."name" ILIKE '%demo%' OR c."createdAt" < '${DEMO_CUTOFF}')`;
  return includeOnline ? demo : `c."registeredVia"::text <> 'ONLINE' AND ${demo}`;
}

/** Demo ажилтан (seed) — ирц, цалин, зардлыг нь устгана; User өөрөө үлдэнэ */
const DEMO_STAFF = `SELECT "id" FROM "User" WHERE "email" ILIKE '%@example.mn'`;
/** Зөвхөн demo ажилтантай (эсвэл мөргүй) цалингийн үе */
const DEMO_PERIOD = `NOT EXISTS (SELECT 1 FROM "PayrollLine" l WHERE l."periodId" = p."id" AND l."staffId" NOT IN (${DEMO_STAFF}))`;

/** PROMPT 27 багц (migration 20261209000000_packages) — хүснэгт байгаа эсэх (migration-оос өмнөх DB-д ч ажиллана) */
export async function hasPackageTables(q: Queryable): Promise<boolean> {
  const r = await q.query<{ ok: boolean }>(`SELECT to_regclass('public."PackageTemplate"') IS NOT NULL AS ok`);
  return !!r.rows[0]?.ok;
}

export const PACKAGE_COUNTS: Count[] = [
  ["Багцын хасалт", `SELECT count(*) FROM "PackageRedemption"`],
  ["Үйлчлүүлэгчийн багц", `SELECT count(*) FROM "CustomerPackage"`],
  ["Багцын загвар × үйлчилгээ", `SELECT count(*) FROM "PackageTemplateService"`],
  ["Багцын загвар", `SELECT count(*) FROM "PackageTemplate"`],
];

/**
 * Багцын хүснэгтүүд (FK дараалал): PackageRedemption → CustomerPackage (Customer, Service-ийг Restrict барина) →
 * PackageTemplateService → PackageTemplate (SaleItem.packageTemplateId Restrict — SaleItem устсаны ДАРАА).
 */
export const PACKAGE_STEPS: string[] = [
  `DELETE FROM "PackageRedemption"`,
  `DELETE FROM "CustomerPackage"`,
  `DELETE FROM "PackageTemplateService"`,
  `DELETE FROM "PackageTemplate"`,
];

export function demoCounts(includeOnline: boolean, packages = false): Count[] {
  return [
    ...(packages ? PACKAGE_COUNTS : []),
    ["Үйлчилгээ", `SELECT count(*) FROM "Service"`],
    ["Үйлчилгээ × ажилтан", `SELECT count(*) FROM "ServiceStaff"`],
    ["Үйлчилгээний урамшууллын дүрэм", `SELECT count(*) FROM "CommissionRule" WHERE "serviceId" IS NOT NULL`],
    ["Цаг захиалга", `SELECT count(*) FROM "Appointment"`],
    ["Айлчлалын зураг (DB)", `SELECT count(*) FROM "VisitPhoto"`],
    ["Outbox (PENDING / FAILED)", `SELECT count(*) FROM "OutboxJob" WHERE "status"::text IN ('PENDING', 'FAILED')`],
    ["Demo үйлчлүүлэгч", `SELECT count(*) FROM "Customer" c WHERE ${demoCustomerWhere(includeOnline)}`],
    ["Demo цалингийн үе", `SELECT count(*) FROM "PayrollPeriod" p WHERE ${DEMO_PERIOD}`],
    ["Demo зардал (гараар)", `SELECT count(*) FROM "Expense" WHERE "payrollPeriodId" IS NULL AND "createdById" IN (${DEMO_STAFF})`],
    ["Demo ирц (WorkDay)", `SELECT count(*) FROM "WorkDay" WHERE "staffId" IN (${DEMO_STAFF})`],
    ["Demo ирц (Ирлээ/Явлаа)", `SELECT count(*) FROM "AttendanceEvent" WHERE "staffId" IN (${DEMO_STAFF})`],
  ];
}

export const DEMO_KEEP_COUNTS: Count[] = [
  ["Ангилал (Collection)", `SELECT count(*) FROM "Collection"`],
  ["Хэрэглэгч (User)", `SELECT count(*) FROM "User"`],
  ["Салбар", `SELECT count(*) FROM "Branch"`],
  ["Тохиргоо", `SELECT count(*) FROM "SiteSetting"`],
  ["НДШ/ХХОАТ-ын хувь", `SELECT count(*) FROM "PayrollRateSet"`],
  ["Зардлын ангилал", `SELECT count(*) FROM "ExpenseCategory"`],
];

/** Dry-run-д: устах demo үйлчлүүлэгчид (нэр + маск утас), ихдээ 200 */
export async function demoCustomers(q: Queryable, includeOnline: boolean) {
  const r = await q.query<{ name: string; phone: string; registeredVia: string }>(
    `SELECT c."name", c."phone", c."registeredVia"::text AS "registeredVia" FROM "Customer" c WHERE ${demoCustomerWhere(includeOnline)} ORDER BY c."createdAt" LIMIT 200`,
  );
  const mask = (p: string) => (p.length >= 4 ? `${p.slice(0, 2)}****${p.slice(-2)}` : "****");
  return r.rows.map((x) => ({ name: x.name, phone: mask(x.phone), online: x.registeredVia === "ONLINE" }));
}

/**
 * Demo өгөгдлийг цэвэрлэнэ (дуудагчийн BEGIN…COMMIT дотор): гүйлгээ → багц → outbox → айлчлал/зураг → цаг захиалга →
 * үйлчилгээ → үлдсэн бүтээгдэхүүн → demo үйлчлүүлэгч → demo цалин/зардал/ирц. Буцаана: устгасан тоо ба
 * private storage-аас устгах айлчлалын зургийн object path-ууд (commit-ийн ДАРАА устгана).
 */
export async function resetDemo(q: Queryable, opts: { target: string; includeOnline?: boolean }) {
  const includeOnline = !!opts.includeOnline;
  const packages = await hasPackageTables(q);
  const before = await countAll(q, [...transactionCounts(true), ...demoCounts(includeOnline, packages), ...CATALOG_COUNTS]);
  const photos = (await q.query<{ storageKey: string }>(`SELECT "storageKey" FROM "VisitPhoto"`)).rows.map((r) => r.storageKey);

  for (const sql of transactionSteps(true)) await q.query(sql);
  const steps = [
    // Багц — SaleItem устсаны дараа, Service / Customer / Appointment-оос өмнө
    ...(packages ? PACKAGE_STEPS : []),
    `DELETE FROM "OutboxJob" WHERE "status"::text IN ('PENDING', 'FAILED')`,
    `DELETE FROM "VisitPhoto"`,
    `DELETE FROM "Visit"`,
    `DELETE FROM "Appointment"`,
    `DELETE FROM "CommissionRule" WHERE "serviceId" IS NOT NULL`,
    `DELETE FROM "ServiceConsumable"`,
    `DELETE FROM "ServiceStaff"`,
    `DELETE FROM "Service"`,
    ...CATALOG_STEPS,
    // Demo үйлчлүүлэгч: хэтэвч / бэлгийн карт → дараа нь үйлчлүүлэгч (тэмдэглэл, session, имэйл — cascade)
    `DELETE FROM "WalletTxn" WHERE "walletId" IN (SELECT w."id" FROM "Wallet" w JOIN "Customer" c ON c."id" = w."customerId" WHERE ${demoCustomerWhere(includeOnline)})`,
    `DELETE FROM "Wallet" w USING "Customer" c WHERE c."id" = w."customerId" AND ${demoCustomerWhere(includeOnline)}`,
    `DELETE FROM "Customer" c WHERE ${demoCustomerWhere(includeOnline)}`,
    // Demo цалин (зөвхөн demo ажилтантай үе — системийн зардал cascade), demo зардал, ирц
    `DELETE FROM "PayrollPeriod" p WHERE ${DEMO_PERIOD}`,
    `DELETE FROM "Expense" WHERE "payrollPeriodId" IS NULL AND "createdById" IN (${DEMO_STAFF})`,
    `DELETE FROM "WorkDay" WHERE "staffId" IN (${DEMO_STAFF})`,
    `DELETE FROM "AttendanceEvent" WHERE "staffId" IN (${DEMO_STAFF})`,
    `DELETE FROM "AttendanceNote" WHERE "staffId" IN (${DEMO_STAFF})`,
  ];
  for (const sql of steps) await q.query(sql);

  const deleted = Object.fromEntries(before.map((c) => [c.label, c.count]));
  await q.query(
    `INSERT INTO "AuditLog" ("id", "userId", "action", "entity", "entityId", "after", "createdAt")
     VALUES ($1, NULL, 'demo.reset', 'System', 'demo', $2::jsonb, now())`,
    [`reset_${Date.now().toString(36)}`, JSON.stringify({ deleted, visitPhotos: photos.length, includeOnline, target: opts.target })],
  );
  return { deleted: before, photoKeys: photos };
}
