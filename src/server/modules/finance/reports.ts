/**
 * Санхүүгийн тайлан (PROMPT 18 §2) — ЗӨВХӨН уншина. Бүх дүн ₮ (Int), мөр бүрээр бөөрөнхийлсөн.
 *
 * Хугацаа — Улаанбаатарын өдрөөр (reports/definitions.ts-тэй ижил).
 *
 * Орлого (P&L)
 *   Борлуулалтыг төлөгдсөн огноогоор (Sale.paidAt; PAID, PARTIALLY_REFUNDED, REFUNDED), мөрийн төрлөөр (SaleItem.kind).
 *   Үнийн дүн = unitPrice × үлдсэн тоо; хөнгөлөлт = (мөрийн + хуваарилсан) × үлдсэн хувь; орлого = lineTotal − буцаалт.
 *   НӨАТ = мөрийн НӨАТ × үлдсэн хувь; цэвэр = орлого − НӨАТ. Өртөг = unitCostSnapshot × үлдсэн тоо.
 * Зардал (P&L)
 *   Expense — цэвэр дүн (amount − vatAmount). Цалингийн зардлаас урамшууллыг тусад нь гаргана.
 *   ХХОАТ — ажилтны цалингаас суутгасан тул цалингийн зардалд АЛЬ ХЭДИЙН багтсан: P&L-д мэдээллийн мөр, нийлбэрт үгүй.
 * Мөнгөн гүйлгээ
 *   Орсон: амжилттай төлбөр (Payment.paidAt) хэлбэрээр — бэлэн (CASH), данс (CARD, QPAY, TRANSFER).
 *          Бэлэг карт, гишүүнчлэл — мөнгө биш (тусад нь харуулна, үлдэгдэлд оруулахгүй).
 *   Гарсан: зардал (paidVia: бэлэн / бусад нь данс; системийн мөр биш), буцаалт (Refund.completedAt, хэлбэрээр),
 *           олгосон цалин (PAID үеийн гарт олгох дүн, paidAt — данс), кассын PAY_OUT / PAY_IN, ээлжийн зөрүү (бэлэн).
 *   Үлдэгдэл: тохиргооны эхний үлдэгдэл (огноо, бэлэн, данс) + түүнээс хойших гүйлгээ.
 *   TODO(нягтлан): НДШ/ХХОАТ/НӨАТ-ын төлөлтийг "Нэмэлт зардал"-аар бүртгэх эсвэл тусдаа ангилал нэмэх.
 * Баланс — удирдлагын, хялбаршуулсан (давхар бичилт биш). Бараа = одоогийн үлдэгдэл × өртөг.
 */
import { Prisma, type PayMethod } from "@/generated/prisma/client";
import { addDays, ubDateKey } from "@/lib/time";
import { db } from "@/server/db";
import { getCurrentBranch } from "@/server/modules/branches/service";
import { toDbDate } from "@/server/modules/payroll/dates";
import { change, dayCount, previousRange, rangeBounds, type ReportRange } from "@/server/modules/reports/definitions";
import { getFinanceSettings } from "./settings";
import { packageLiability } from "@/server/modules/packages/service";
import { getQPaySettings, getTaxSettings } from "@/server/modules/settings/pos-settings";
import { payLabel } from "@/lib/pay-label";

// ───────────────────────── Хугацаа ─────────────────────────

export type FinancePeriod = "day" | "half" | "month" | "custom";

function monthEnd(day: string) {
  const [y, m] = day.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${day.slice(0, 8)}${String(last).padStart(2, "0")}`;
}

/** Өдөр / 15 хоног (1–15, 16–эцэс) / сар / дурын */
export function financeRange(sp: { period?: string; date?: string; from?: string; to?: string }, today = ubDateKey()): { period: FinancePeriod; range: ReportRange } {
  const isKey = (v?: string): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const period: FinancePeriod = (["day", "half", "month", "custom"] as const).find((p) => p === sp.period) ?? "month";
  const anchor = isKey(sp.date) ? sp.date : today;
  if (period === "custom" && isKey(sp.from) && isKey(sp.to)) {
    const [from, to] = sp.from <= sp.to ? [sp.from, sp.to] : [sp.to, sp.from];
    return { period, range: { from: dayCount({ from, to }) > 370 ? addDays(to, -369) : from, to } };
  }
  if (period === "day") return { period, range: { from: anchor, to: anchor } };
  if (period === "half") {
    const first = Number(anchor.slice(8)) <= 15;
    return { period, range: first ? { from: `${anchor.slice(0, 8)}01`, to: `${anchor.slice(0, 8)}15` } : { from: `${anchor.slice(0, 8)}16`, to: monthEnd(anchor) } };
  }
  return { period: period === "custom" ? "month" : period, range: { from: `${anchor.slice(0, 8)}01`, to: monthEnd(anchor) } };
}

/** Харьцуулах өмнөх үе: сар → өмнөх сар, хагас → өмнөх хагас, бусад — ижил урттай */
export function previousFinanceRange(period: FinancePeriod, r: ReportRange): ReportRange {
  if (period === "month") {
    const prevEnd = addDays(r.from, -1);
    return { from: `${prevEnd.slice(0, 8)}01`, to: prevEnd };
  }
  if (period === "half") return financeRange({ period: "half", date: addDays(r.from, -1) }).range;
  return previousRange(r);
}

// ───────────────────────── Орлого ─────────────────────────

export type RevenueLine = { gross: number; discount: number; total: number; vat: number; net: number; cost: number; qty: number };
const emptyLine = (): RevenueLine => ({ gross: 0, discount: 0, total: 0, vat: 0, net: 0, cost: 0, qty: 0 });

type KindRow = { kind: "SERVICE" | "PRODUCT"; pkg: boolean; gross: number; discount: number; total: number; vat: number; cost: number; qty: number };

/** Төрөл бүрээр (буцаалт хассан). Мөр бүрийн НӨАТ-ыг бөөрөнхийлөөд нийлүүлнэ. */
export async function revenueByKind(range: ReportRange): Promise<{ service: RevenueLine; product: RevenueLine; packagePrepaid: RevenueLine }> {
  const branch = await getCurrentBranch();
  const { start, end } = rangeBounds(range);
  const rows = await db.$queryRaw<KindRow[]>(Prisma.sql`
    WITH s AS (
      SELECT "id" FROM "Sale"
      WHERE "branchId" = ${branch.id} AND "status"::text IN ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED')
        AND "paidAt" >= ${start} AND "paidAt" < ${end}
    ), r AS (
      SELECT (e->>'saleItemId') AS "itemId", SUM((e->>'qty')::int) AS qty, SUM((e->>'amount')::int) AS amount
      FROM "Refund" rf JOIN s ON s."id" = rf."saleId" CROSS JOIN LATERAL jsonb_array_elements(rf."items") e
      WHERE rf."status"::text = 'COMPLETED' GROUP BY 1
    ), l AS (
      SELECT i."kind"::text AS kind,
        (i."packageTemplateId" IS NOT NULL) AS pkg,
        (i."qty" - COALESCE(r.qty, 0)) AS qty,
        i."qty" AS "origQty",
        i."unitPrice", i."unitCostSnapshot",
        (i."lineDiscount" + i."allocatedSaleDiscount") AS discount,
        i."lineTotal", i."vatAmount",
        (i."lineTotal" - COALESCE(r.amount, 0)) AS total
      FROM "SaleItem" i JOIN s ON s."id" = i."saleId" LEFT JOIN r ON r."itemId" = i."id"
    )
    SELECT kind, pkg,
      SUM("unitPrice" * qty)::int AS gross,
      SUM(ROUND(CASE WHEN "origQty" > 0 THEN discount::numeric * qty / "origQty" ELSE 0 END))::int AS discount,
      SUM(total)::int AS total,
      SUM(ROUND(CASE WHEN "lineTotal" > 0 THEN "vatAmount"::numeric * total / "lineTotal" ELSE 0 END))::int AS vat,
      SUM("unitCostSnapshot" * qty)::int AS cost,
      SUM(qty)::int AS qty
    FROM l GROUP BY kind, pkg
  `);
  // PROMPT 27: багц худалдсан мөр — урьдчилгаа (P&L-д ашиглах үед танигдана)
  const out = { service: emptyLine(), product: emptyLine(), packagePrepaid: emptyLine() };
  for (const r of rows) {
    const x = r.pkg ? out.packagePrepaid : r.kind === "SERVICE" ? out.service : out.product;
    Object.assign(x, { gross: r.gross, discount: r.discount, total: r.total, vat: r.vat, net: r.total - r.vat, cost: r.cost, qty: r.qty });
  }
  return out;
}

// ───────────────────────── Зардал ─────────────────────────

export type ExpenseRow = { categoryId: string; code: string; name: string; kind: string; isSystem: boolean; amount: number; vat: number; net: number };

export async function expensesByCategory(range: ReportRange): Promise<ExpenseRow[]> {
  const rows = await db.expense.groupBy({
    by: ["categoryId"],
    where: { date: { gte: toDbDate(range.from), lte: toDbDate(range.to) } },
    _sum: { amount: true, vatAmount: true },
  });
  const cats = await db.expenseCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return cats
    .map((c) => {
      const r = rows.find((x) => x.categoryId === c.id);
      const amount = r?._sum.amount ?? 0;
      const vat = r?._sum.vatAmount ?? 0;
      return { categoryId: c.id, code: c.code, name: c.name, kind: c.kind, isSystem: c.isSystem, amount, vat, net: amount - vat };
    })
    .filter((r) => r.amount !== 0);
}

/** Цалингийн зардалд багтсан урамшуулал (системийн мөр нь хугацаанд орсон үеүүдийн) */
async function payrollCommission(range: ReportRange) {
  const r = await db.payrollLine.aggregate({
    where: { period: { expenses: { some: { date: { gte: toDbDate(range.from), lte: toDbDate(range.to) }, category: { kind: "PAYROLL" } } } } },
    _sum: { serviceCommission: true, productCommission: true },
  });
  return { service: r._sum.serviceCommission ?? 0, product: r._sum.productCommission ?? 0 };
}

// ───────────────────────── P&L ─────────────────────────

export type ProfitAndLoss = {
  range: ReportRange;
  /** course — багцаас ашигласан удаагийн танигдсан орлого; packagePrepaid — худалдсан багцын мөнгө (P&L-д ороогүй) */
  revenue: { service: RevenueLine; product: RevenueLine; course: RevenueLine; packagePrepaid: RevenueLine; total: RevenueLine };
  cogs: number;
  grossProfit: number;
  expenses: { code: string; name: string; net: number; vat: number; info?: boolean }[];
  commission: { service: number; product: number };
  expensesTotal: number;
  netProfit: number;
};

export async function profitAndLoss(range: ReportRange): Promise<ProfitAndLoss> {
  const { start, end } = rangeBounds(range);
  const [rev, exp, comm, recognized, tax] = await Promise.all([
    revenueByKind(range),
    expensesByCategory(range),
    payrollCommission(range),
    db.packageRedemption.aggregate({ where: { reversedAt: null, createdAt: { gte: start, lt: end } }, _sum: { unitValue: true }, _count: true }),
    getTaxSettings(),
  ]);
  // Багцаас ашигласан удаа — танигдсан орлого (НӨАТ нь худалдах үед төлөгдсөн; P&L-д цэвэр дүнгээр)
  const courseTotal = recognized._sum.unitValue ?? 0;
  const courseVat = tax.vatIncluded ? Math.round((courseTotal * tax.vatRateBp) / (10_000 + tax.vatRateBp)) : 0;
  const course: RevenueLine = { ...emptyLine(), gross: courseTotal, total: courseTotal, vat: courseVat, net: courseTotal - courseVat, qty: recognized._count };
  const total = emptyLine();
  for (const k of ["gross", "discount", "total", "vat", "net", "cost", "qty"] as const) total[k] = rev.service[k] + rev.product[k] + course[k];
  const cogs = total.cost;
  const grossProfit = total.net - cogs;
  const commissionTotal = comm.service + comm.product;
  const expenses: ProfitAndLoss["expenses"] = [];
  for (const e of exp) {
    if (e.kind === "PIT") {
      expenses.push({ code: e.code, name: `${e.name} (цалингаас суутгасан — цалингийн зардалд багтсан)`, net: e.net, vat: e.vat, info: true });
    } else if (e.kind === "PAYROLL") {
      expenses.push({ code: e.code, name: e.name, net: e.net - commissionTotal, vat: e.vat });
    } else expenses.push({ code: e.code, name: e.name, net: e.net, vat: e.vat });
  }
  if (commissionTotal) {
    expenses.push({ code: "COMM-S", name: "Урамшуулал — үйлчилгээ", net: comm.service, vat: 0 });
    expenses.push({ code: "COMM-P", name: "Урамшуулал — бүтээгдэхүүн", net: comm.product, vat: 0 });
  }
  const expensesTotal = expenses.filter((e) => !e.info).reduce((s, e) => s + e.net, 0);
  return { range, revenue: { service: rev.service, product: rev.product, course, packagePrepaid: rev.packagePrepaid, total }, cogs, grossProfit, expenses, commission: comm, expensesTotal, netProfit: grossProfit - expensesTotal };
}

export function compare(now: ProfitAndLoss, before: ProfitAndLoss) {
  return {
    revenue: change(now.revenue.total.net, before.revenue.total.net),
    grossProfit: change(now.grossProfit, before.grossProfit),
    expenses: change(now.expensesTotal, before.expensesTotal),
    netProfit: change(now.netProfit, before.netProfit),
  };
}

// ───────────────────────── Мөнгөн гүйлгээ ─────────────────────────

const CASH: readonly PayMethod[] = ["CASH"];
const BANK: readonly PayMethod[] = ["CARD", "QPAY", "TRANSFER"];
const bucket = (m: PayMethod | null): "cash" | "bank" | "other" => (m && CASH.includes(m) ? "cash" : !m || BANK.includes(m) ? "bank" : "other");

export type CashFlowLine = { label: string; cash: number; bank: number };
export type CashFlow = {
  range: ReportRange;
  /** PROMPT 29: QPay — дансаар («QPay — Компанийн данс» / «QPay — Захирлын данс») */
  inflows: { method: PayMethod; account?: "A" | "B"; label: string; amount: number }[];
  nonCash: { method: PayMethod; amount: number }[];
  outflows: CashFlowLine[];
  totals: { inCash: number; inBank: number; outCash: number; outBank: number; netCash: number; netBank: number };
  opening: { cash: number; bank: number } | null;
  closing: { cash: number; bank: number } | null;
  openingNote: string | null;
  shifts: { id: string; openedAt: Date; closedAt: Date | null; expected: number | null; counted: number | null; difference: number | null }[];
};

/** Хугацааны мөнгөн урсгал (үлдэгдэлгүй) */
async function flows(range: ReportRange) {
  const branch = await getCurrentBranch();
  const { start, end } = rangeBounds(range);
  const [payments, refunds, expenses, payroll, movements, shifts, qpay] = await Promise.all([
    db.payment.groupBy({ by: ["method", "qpayAccount"], where: { status: "SUCCEEDED", paidAt: { gte: start, lt: end }, sale: { branchId: branch.id } }, _sum: { amount: true } }),
    db.refund.groupBy({ by: ["method"], where: { status: "COMPLETED", completedAt: { gte: start, lt: end }, sale: { branchId: branch.id } }, _sum: { amount: true } }),
    db.expense.groupBy({ by: ["paidVia"], where: { payrollPeriodId: null, date: { gte: toDbDate(range.from), lte: toDbDate(range.to) } }, _sum: { amount: true } }),
    db.payrollLine.aggregate({ where: { period: { status: "PAID", paidAt: { gte: start, lt: end } } }, _sum: { net: true } }),
    db.cashMovement.groupBy({ by: ["type"], where: { type: { in: ["PAY_IN", "PAY_OUT"] }, createdAt: { gte: start, lt: end }, shift: { branchId: branch.id } }, _sum: { amount: true } }),
    db.cashShift.findMany({ where: { branchId: branch.id, closedAt: { gte: start, lt: end } }, orderBy: { closedAt: "asc" }, select: { id: true, openedAt: true, closedAt: true, expectedCash: true, countedCash: true, difference: true } }),
    getQPaySettings(),
  ]);
  const labels = { A: qpay.accounts.A.label, B: qpay.accounts.B.label };
  // QPay-ийн null (хуучин) ба A — нэг мөр
  const byKey = new Map<string, { method: PayMethod; account?: "A" | "B"; label: string; amount: number }>();
  for (const p of payments) {
    const account = p.method === "QPAY" ? (p.qpayAccount ?? "A") : undefined;
    const k = `${p.method}:${account ?? ""}`;
    const x = byKey.get(k) ?? { method: p.method, ...(account ? { account } : {}), label: payLabel(p.method, account, labels), amount: 0 };
    x.amount += p._sum.amount ?? 0;
    byKey.set(k, x);
  }
  const inflows = [...byKey.values()]
    .filter((p) => p.amount !== 0)
    .sort((a, b) => a.label.localeCompare(b.label));
  const outflows: CashFlowLine[] = [];
  const line = (label: string) => {
    const l = { label, cash: 0, bank: 0 };
    outflows.push(l);
    return l;
  };
  const exp = line("Зардал");
  for (const e of expenses) {
    const b = bucket(e.paidVia);
    if (b !== "other") exp[b] += e._sum.amount ?? 0;
  }
  const ref = line("Буцаалт");
  for (const r of refunds) {
    const b = bucket(r.method);
    if (b !== "other") ref[b] += r._sum.amount ?? 0;
  }
  line("Олгосон цалин (гарт)").bank = payroll._sum.net ?? 0;
  const mv = (t: "PAY_IN" | "PAY_OUT") => movements.find((m) => m.type === t)?._sum.amount ?? 0;
  // PAY_OUT нь сөрөг дүнтэй (+орлого / −зарлага) — гарсан мөнгийг эерэгээр
  line("Кассын зарлага (PAY_OUT)").cash = -mv("PAY_OUT");
  line("Кассын орлого (PAY_IN)").cash = -mv("PAY_IN");
  // Ээлжийн зөрүү: илүү (+) бол бэлэн нэмэгдэнэ → гарсан мөнгийг сөрөг
  line("Кассын ээлжийн зөрүү").cash = -shifts.reduce((s, x) => s + (x.difference ?? 0), 0);

  const inCash = inflows.filter((p) => bucket(p.method) === "cash").reduce((s, p) => s + p.amount, 0);
  const inBank = inflows.filter((p) => bucket(p.method) === "bank").reduce((s, p) => s + p.amount, 0);
  const outCash = outflows.reduce((s, l) => s + l.cash, 0);
  const outBank = outflows.reduce((s, l) => s + l.bank, 0);
  return {
    inflows: inflows.filter((p) => bucket(p.method) !== "other"),
    nonCash: inflows.filter((p) => bucket(p.method) === "other"),
    outflows: outflows.filter((l) => l.cash !== 0 || l.bank !== 0),
    totals: { inCash, inBank, outCash, outBank, netCash: inCash - outCash, netBank: inBank - outBank },
    shifts: shifts.map((s) => ({ id: s.id, openedAt: s.openedAt, closedAt: s.closedAt, expected: s.expectedCash, counted: s.countedCash, difference: s.difference })),
  };
}

/** Тухайн өдрийн ЭХЭН дэх үлдэгдэл (тохиргооны эхний үлдэгдлээс). Тохируулаагүй эсвэл түүнээс өмнөх бол null. */
async function balanceAtStartOf(day: string): Promise<{ cash: number; bank: number } | null> {
  const { opening } = await getFinanceSettings();
  if (!opening || day < opening.asOf) return null;
  if (day === opening.asOf) return { cash: opening.cash, bank: opening.bank };
  const f = await flows({ from: opening.asOf, to: addDays(day, -1) });
  return { cash: opening.cash + f.totals.netCash, bank: opening.bank + f.totals.netBank };
}

export async function cashFlow(range: ReportRange): Promise<CashFlow> {
  const [f, opening, settings] = await Promise.all([flows(range), balanceAtStartOf(range.from), getFinanceSettings()]);
  const closing = opening ? { cash: opening.cash + f.totals.netCash, bank: opening.bank + f.totals.netBank } : null;
  const openingNote = settings.opening
    ? opening
      ? null
      : `Эхний үлдэгдэл ${settings.opening.asOf}-ны өдрөөс тохируулагдсан — түүнээс өмнөх хугацааны үлдэгдлийг тооцохгүй.`
    : "Эхний үлдэгдэл (бэлэн, данс) тохируулаагүй — Санхүү → Тохиргоо.";
  return { range, ...f, opening, closing, openingNote };
}

// ───────────────────────── Баланс (хялбаршуулсан) ─────────────────────────

export type Balance = {
  asOf: string;
  assets: { label: string; amount: number | null; note?: string }[];
  liabilities: { label: string; amount: number; note?: string }[];
  totalAssets: number;
  totalLiabilities: number;
  equity: number;
};

export async function balanceSheet(asOf: string): Promise<Balance> {
  const branch = await getCurrentBranch();
  const monthFrom = `${asOf.slice(0, 8)}01`;
  const [money, inventory, receivable, unpaidPayroll, taxes, vat, pkgLiability] = await Promise.all([
    balanceAtStartOf(addDays(asOf, 1)),
    db.$queryRaw<{ v: number }[]>`SELECT COALESCE(SUM(GREATEST("stock", 0)::bigint * "costPrice"), 0)::float8 AS v FROM "Variant"`,
    db.sale.aggregate({ where: { branchId: branch.id, status: "PARTIALLY_PAID" }, _sum: { total: true, paidAmount: true } }),
    db.payrollLine.aggregate({ where: { period: { status: "APPROVED" } }, _sum: { net: true } }),
    db.payrollLine.aggregate({
      where: { period: { status: { in: ["APPROVED", "PAID"] }, endDate: { gte: toDbDate(monthFrom), lte: toDbDate(asOf) } } },
      _sum: { siEmployee: true, siEmployer: true, pit: true },
    }),
    vatForRange({ from: monthFrom, to: asOf }),
    packageLiability(),
  ]);
  const assets: Balance["assets"] = [
    { label: "Бэлэн мөнгө", amount: money?.cash ?? null, note: money ? undefined : "Эхний үлдэгдэл тохируулаагүй" },
    { label: "Харилцах данс", amount: money?.bank ?? null, note: money ? undefined : "Эхний үлдэгдэл тохируулаагүй" },
    { label: "Бараа материал (үлдэгдэл × өртөг)", amount: Math.round(inventory[0]?.v ?? 0), note: "Одоогийн үлдэгдлээр" },
    { label: "Авлага (хэсэгчлэн төлөгдсөн борлуулалт)", amount: (receivable._sum.total ?? 0) - (receivable._sum.paidAmount ?? 0) },
  ];
  const liabilities: Balance["liabilities"] = [
    { label: "Олгоогүй цалин (батлагдсан)", amount: unpaidPayroll._sum.net ?? 0 },
    { label: "Төлөх НДШ (ажилтан + ажил олгогч)", amount: (taxes._sum.siEmployee ?? 0) + (taxes._sum.siEmployer ?? 0), note: "Энэ сарын үеүүд — төлсөн эсэхийг бүртгэдэггүй" },
    { label: "Төлөх ХХОАТ", amount: taxes._sum.pit ?? 0, note: "Энэ сарын үеүүд — төлсөн эсэхийг бүртгэдэггүй" },
    { label: "Төлөх НӨАТ (борлуулалтын − зардлын)", amount: Math.max(0, vat.payable), note: "Энэ сарын эхнээс" },
    { label: "Багцын үлдэгдэл өр (ашиглаагүй удаа × өртөг)", amount: pkgLiability, note: "Идэвхтэй багц — үйлчилгээ үзүүлэх үүрэг" },
  ];
  const totalAssets = assets.reduce((s, a) => s + (a.amount ?? 0), 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + l.amount, 0);
  return { asOf, assets, liabilities, totalAssets, totalLiabilities, equity: totalAssets - totalLiabilities };
}

// ───────────────────────── НӨАТ ─────────────────────────

export type VatRow = { month: string; salesNet: number; salesVat: number; expenseVat: number; payable: number; ebarimtVat: number };

async function vatForRange(range: ReportRange) {
  const [rev, exp, eb] = await Promise.all([
    revenueByKind(range),
    db.expense.aggregate({ where: { payrollPeriodId: null, date: { gte: toDbDate(range.from), lte: toDbDate(range.to) } }, _sum: { vatAmount: true } }),
    ebarimtVat(range),
  ]);
  // Багцын НӨАТ — худалдах үед бүтэн дүнгээр (PROMPT 27)
  const salesVat = rev.service.vat + rev.product.vat + rev.packagePrepaid.vat;
  const expenseVat = exp._sum.vatAmount ?? 0;
  return { salesNet: rev.service.net + rev.product.net + rev.packagePrepaid.net, salesVat, expenseVat, payable: salesVat - expenseVat, ebarimtVat: eb };
}

/** eBarimt илгээгдсэн (DONE) борлуулалтын НӨАТ — тулгалт. PosAPI 3.0-ийн дүн ирэхээр солино. */
async function ebarimtVat(range: ReportRange): Promise<number> {
  const branch = await getCurrentBranch();
  const { start, end } = rangeBounds(range);
  const r = await db.saleItem.aggregate({
    where: { sale: { branchId: branch.id, paidAt: { gte: start, lt: end }, status: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] }, ebarimt: { status: "DONE" } } },
    _sum: { vatAmount: true },
  });
  return r._sum.vatAmount ?? 0;
}

/** Сар бүрээр (from..to-д хамаарах сарууд) */
export async function vatReport(range: ReportRange): Promise<VatRow[]> {
  const out: VatRow[] = [];
  for (let m = `${range.from.slice(0, 8)}01`; m <= range.to && out.length < 24; m = addDays(monthEnd(m), 1)) {
    const r = { from: m < range.from ? range.from : m, to: monthEnd(m) > range.to ? range.to : monthEnd(m) };
    out.push({ month: m.slice(0, 7), ...(await vatForRange(r)) });
  }
  return out;
}

