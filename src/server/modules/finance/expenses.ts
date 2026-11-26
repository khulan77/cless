/**
 * Зардал (PROMPT 18 §1).
 *  - Дүн нь НӨАТ-тэй нийт (₮, Int). НӨАТ-тэй бол vatAmount = vatOf(amount, 10%, true) — мөр бүрээр бөөрөнхийлнө.
 *  - Ашиглалт / интернэтийн мөрөнд reference (хэрэглэгчийн код г.м.) заавал; ангилал бүрт сүүлд ашигласан кодыг санал болгоно.
 *  - Системийн ангилал (цалин, НДШ, ХХОАТ) — цалингийн үе батлагдахад автоматаар (syncPayrollExpenses), гараар үгүй.
 *  - Баримт (зураг/PDF) — хувийн storage (receiptPath), зөвхөн эрхтэй route-оор уншина.
 * Бүх засвар AuditLog-д (дүнгүйгээр биш — зардал эмзэг биш, харин тайлбарыг хуулбарлахгүй).
 */
import { z } from "zod";
import type { ExpenseKind, PayMethod, Prisma } from "@/generated/prisma/client";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { UserError } from "@/server/errors";
import { fromDbDate, toDbDate } from "@/server/modules/payroll/dates";
import { vatOf } from "@/server/modules/sales/pricing";

type Tx = Prisma.TransactionClient;

/** НӨАТ 10% (basis point) — борлуулалттай ижил */
export const VAT_BP = 1000;
export const REFERENCE_REQUIRED: readonly ExpenseKind[] = ["UTILITY", "INTERNET"];
export const SYSTEM_KINDS: readonly ExpenseKind[] = ["PAYROLL", "SOCIAL_INSURANCE", "PIT"];
export const PAID_VIA = ["CASH", "TRANSFER", "CARD", "QPAY"] as const satisfies readonly PayMethod[];

const M = {
  notFound: "Зардал олдсонгүй.",
  system: "Системийн зардлыг (цалин, НДШ, ХХОАТ) гараар засахгүй — цалингийн үеэс автоматаар үүснэ.",
  category: "Ангилал олдсонгүй эсвэл идэвхгүй.",
  reference: "Төлбөрийн код (хэрэглэгчийн код, гэрээний №) заавал.",
} as const;

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Огноо буруу.");

export const expenseInputSchema = z.object({
  categoryId: z.string().min(1, "Ангилал сонгоно уу."),
  date: dateKey,
  amount: z.coerce.number({ error: "Дүн буруу." }).int("Дүн бүхэл тоо.").min(1, "Дүн 0-ээс их.").max(10_000_000_000, "Дүн хэт их."),
  vatIncluded: z.boolean().default(false),
  reference: z.string().trim().max(100).nullish().transform((v) => v || null),
  vendor: z.string().trim().max(120).nullish().transform((v) => v || null),
  note: z.string().trim().max(500).nullish().transform((v) => v || null),
  paidVia: z.enum(PAID_VIA).nullish().transform((v) => v ?? null),
});
export type ExpenseInput = z.input<typeof expenseInputSchema>;

async function assertCategory(tx: Tx, categoryId: string, reference: string | null) {
  const c = await tx.expenseCategory.findUnique({ where: { id: categoryId } });
  if (!c || !c.isActive) throw new UserError(M.category, { categoryId: [M.category] });
  if (c.isSystem) throw new UserError(M.system);
  if (REFERENCE_REQUIRED.includes(c.kind) && !reference) throw new UserError(M.reference, { reference: [M.reference] });
  return c;
}

const snapshot = (e: { categoryId: string; date: Date; amount: number; vatAmount: number; reference: string | null; vendor: string | null; paidVia: PayMethod | null }) => ({
  categoryId: e.categoryId,
  date: fromDbDate(e.date),
  amount: e.amount,
  vatAmount: e.vatAmount,
  reference: e.reference,
  vendor: e.vendor,
  paidVia: e.paidVia,
});

export async function createExpense(raw: ExpenseInput, actorId: string, extra: { receiptPath?: string | null } = {}) {
  const v = expenseInputSchema.parse(raw);
  return db.$transaction(async (tx) => {
    await assertCategory(tx, v.categoryId, v.reference);
    const e = await tx.expense.create({
      data: {
        categoryId: v.categoryId,
        date: toDbDate(v.date),
        amount: v.amount,
        vatIncluded: v.vatIncluded,
        vatAmount: v.vatIncluded ? vatOf(v.amount, VAT_BP, true) : 0,
        reference: v.reference,
        vendor: v.vendor,
        note: v.note,
        paidVia: v.paidVia,
        receiptPath: extra.receiptPath ?? null,
        createdById: actorId,
      },
    });
    await audit(tx, { userId: actorId, action: "expense.create", entity: "Expense", entityId: e.id, after: snapshot(e) });
    return e;
  });
}

export async function updateExpense(id: string, raw: ExpenseInput, actorId: string, extra: { receiptPath?: string | null } = {}) {
  const v = expenseInputSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const before = await tx.expense.findUnique({ where: { id }, include: { category: true } });
    if (!before) throw new UserError(M.notFound);
    if (before.category.isSystem || before.payrollPeriodId) throw new UserError(M.system);
    await assertCategory(tx, v.categoryId, v.reference);
    const e = await tx.expense.update({
      where: { id },
      data: {
        categoryId: v.categoryId,
        date: toDbDate(v.date),
        amount: v.amount,
        vatIncluded: v.vatIncluded,
        vatAmount: v.vatIncluded ? vatOf(v.amount, VAT_BP, true) : 0,
        reference: v.reference,
        vendor: v.vendor,
        note: v.note,
        paidVia: v.paidVia,
        ...(extra.receiptPath !== undefined ? { receiptPath: extra.receiptPath } : {}),
      },
    });
    await audit(tx, { userId: actorId, action: "expense.update", entity: "Expense", entityId: id, before: snapshot(before), after: snapshot(e) });
    return { expense: e, oldReceipt: extra.receiptPath !== undefined && before.receiptPath !== extra.receiptPath ? before.receiptPath : null };
  });
}

export async function deleteExpense(id: string, actorId: string) {
  return db.$transaction(async (tx) => {
    const before = await tx.expense.findUnique({ where: { id }, include: { category: true } });
    if (!before) throw new UserError(M.notFound);
    if (before.category.isSystem || before.payrollPeriodId) throw new UserError(M.system);
    await tx.expense.delete({ where: { id } });
    await audit(tx, { userId: actorId, action: "expense.delete", entity: "Expense", entityId: id, before: snapshot(before) });
    return { receiptPath: before.receiptPath };
  });
}

// ───────────────────────── Жагсаалт ─────────────────────────

export type ExpenseFilter = { from: string; to: string; categoryId?: string | null; q?: string | null };

function whereOf(f: ExpenseFilter): Prisma.ExpenseWhereInput {
  return {
    date: { gte: toDbDate(f.from), lte: toDbDate(f.to) },
    ...(f.categoryId ? { categoryId: f.categoryId } : {}),
    ...(f.q
      ? { OR: [{ reference: { contains: f.q, mode: "insensitive" } }, { vendor: { contains: f.q, mode: "insensitive" } }, { note: { contains: f.q, mode: "insensitive" } }] }
      : {}),
  };
}

export async function listExpenses(f: ExpenseFilter, take = 500) {
  const rows = await db.expense.findMany({
    where: whereOf(f),
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take,
    include: { category: { select: { id: true, code: true, name: true, kind: true, isSystem: true } }, createdBy: { select: { name: true } } },
  });
  return rows.map((e) => ({
    id: e.id,
    date: fromDbDate(e.date),
    category: e.category,
    amount: e.amount,
    vatIncluded: e.vatIncluded,
    vatAmount: e.vatAmount,
    net: e.amount - e.vatAmount,
    reference: e.reference,
    vendor: e.vendor,
    note: e.note,
    paidVia: e.paidVia,
    hasReceipt: !!e.receiptPath,
    payrollPeriodId: e.payrollPeriodId,
    createdBy: e.createdBy.name,
  }));
}

/** Сар бүрийн нийлбэр (YYYY-MM) — НӨАТ-тэй, НӨАТ (шүүлттэй ижил) */
export async function monthlyTotals(f: ExpenseFilter) {
  const rows = await db.expense.findMany({ where: whereOf(f), select: { date: true, amount: true, vatAmount: true } });
  const m = new Map<string, { month: string; amount: number; vat: number; count: number }>();
  for (const r of rows) {
    const k = fromDbDate(r.date).slice(0, 7);
    const x = m.get(k) ?? { month: k, amount: 0, vat: 0, count: 0 };
    x.amount += r.amount;
    x.vat += r.vatAmount;
    x.count += 1;
    m.set(k, x);
  }
  return [...m.values()].sort((a, b) => a.month.localeCompare(b.month));
}

export async function expenseCategories(opts: { includeInactive?: boolean } = {}) {
  return db.expenseCategory.findMany({ where: opts.includeInactive ? {} : { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
}

/** Ангилал бүрт сүүлд ашигласан код, нийлүүлэгч — формд санал болгоно */
export async function lastReferences(): Promise<Record<string, { reference: string | null; vendor: string | null }>> {
  const rows = await db.$queryRaw<{ categoryId: string; reference: string | null; vendor: string | null }[]>`
    SELECT DISTINCT ON ("categoryId") "categoryId", "reference", "vendor"
    FROM "Expense" WHERE "payrollPeriodId" IS NULL AND "reference" IS NOT NULL
    ORDER BY "categoryId", "date" DESC, "createdAt" DESC`;
  return Object.fromEntries(rows.map((r) => [r.categoryId, { reference: r.reference, vendor: r.vendor }]));
}

// ───────────────────────── Ангилал ─────────────────────────

export const categoryInputSchema = z.object({
  code: z.string().trim().toUpperCase().min(1, "Код заавал.").max(20).regex(/^[A-Z0-9._-]+$/, "Код: латин үсэг, тоо."),
  name: z.string().trim().min(2, "Нэр заавал.").max(80),
  kind: z.enum(["UTILITY", "INTERNET", "OTHER"]),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
});

export async function saveCategory(id: string | null, raw: z.input<typeof categoryInputSchema>, actorId: string) {
  const v = categoryInputSchema.parse(raw);
  return db.$transaction(async (tx) => {
    if (id) {
      const before = await tx.expenseCategory.findUnique({ where: { id } });
      if (!before) throw new UserError("Ангилал олдсонгүй.");
      // Системийн ангилалд зөвхөн код (нягтлангийн данс), нэрийг засна
      const data = before.isSystem ? { code: v.code, name: v.name } : v;
      const c = await tx.expenseCategory.update({ where: { id }, data });
      await audit(tx, { userId: actorId, action: "expense.category.update", entity: "ExpenseCategory", entityId: id, before: { code: before.code, name: before.name, kind: before.kind, isActive: before.isActive }, after: data });
      return c;
    }
    const c = await tx.expenseCategory.create({ data: v });
    await audit(tx, { userId: actorId, action: "expense.category.create", entity: "ExpenseCategory", entityId: c.id, after: v });
    return c;
  });
}

// ───────────────────────── Цалин → системийн зардал ─────────────────────────

const SYSTEM_CODES: { kind: ExpenseKind; field: "gross" | "siEmployer" | "pit" }[] = [
  { kind: "PAYROLL", field: "gross" },
  { kind: "SOCIAL_INSURANCE", field: "siEmployer" },
  { kind: "PIT", field: "pit" },
];

/**
 * Цалингийн үе APPROVED болоход (approvePeriod-ийн transaction дотор): нийт цалин (gross), ажил олгогчийн НДШ,
 * суутгасан ХХОАТ — үеийн эцсийн өдрөөр 3 мөр. periodId+ангилал unique тул дахин батлахад давхардахгүй (upsert).
 * ADVANCE + FINAL — FINAL мөр нь сарын дүнгээс урьдчилгааг хассан тул нийлбэр давхардахгүй.
 * 0 дүнтэй мөр үүсгэхгүй.
 */
export async function syncPayrollExpenses(tx: Tx, periodId: string, actorId: string) {
  const period = await tx.payrollPeriod.findUniqueOrThrow({ where: { id: periodId }, select: { endDate: true } });
  const sums = await tx.payrollLine.aggregate({ where: { periodId }, _sum: { gross: true, siEmployer: true, pit: true } });
  const cats = await tx.expenseCategory.findMany({ where: { isSystem: true, kind: { in: SYSTEM_CODES.map((s) => s.kind) } } });
  for (const s of SYSTEM_CODES) {
    const cat = cats.find((c) => c.kind === s.kind);
    if (!cat) continue;
    const amount = sums._sum[s.field] ?? 0;
    const where = { payrollPeriodId_categoryId: { payrollPeriodId: periodId, categoryId: cat.id } };
    if (amount <= 0) {
      await tx.expense.deleteMany({ where: { payrollPeriodId: periodId, categoryId: cat.id } });
      continue;
    }
    await tx.expense.upsert({
      where,
      create: { categoryId: cat.id, date: period.endDate, amount, payrollPeriodId: periodId, createdById: actorId, note: "Цалингийн үеэс автоматаар" },
      update: { amount, date: period.endDate },
    });
  }
}

/** Батламж цуцлахад — системийн мөрүүд устна */
export async function removePayrollExpenses(tx: Tx, periodId: string) {
  await tx.expense.deleteMany({ where: { payrollPeriodId: periodId } });
}
