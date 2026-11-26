/**
 * Цалингийн үе (PROMPT 14 §3, §7): нээх → тооцоолох → (нэмэлт/хасалт → дахин тооцоолох) → батлах → олгосон.
 *  - Сар бүр 2 үе: 1–splitDay, splitDay+1–сарын сүүл. Горим: ADVANCE + FINAL эсвэл FULL + FULL.
 *  - Ирц, амралт, цалин, хувь хэмжээ, нэмэлт/хасалт өөрчлөгдвөл ноорог үеийн тооцоо хүчингүй (calculatedAt = null)
 *    болж, батлахаас өмнө дахин тооцоолно.
 *  - Батлах: тооцоо шинэ, хувь хэмжээ баталгаажсан, гарт олгох сөрөг мөргүй. Батлагдсан үе түгжигдэнэ.
 *  - Батламж цуцлах: шалтгаантай (AuditLog). Олгосон (PAID) үеийг цуцлахгүй.
 * Цалингийн дүн, нэрийг console log-д бүү гарга.
 */
import { z } from "zod";
import type { PayrollKind, Prisma } from "@/generated/prisma/client";
import { t } from "@/i18n";
import { audit } from "@/server/audit";
import { removePayrollExpenses, syncPayrollExpenses } from "@/server/modules/finance/expenses";
import { hoursOf, periodHours } from "./hours";
import { closeStaleSessions } from "@/server/modules/attendance/service";
import { db } from "@/server/db";
import { UserError } from "@/server/errors";
import { basePay, computeFinal, computeLine, daysBetween, monthDays, monthOf, resolveAttendance, type WorkStatus } from "./calc";
import { commissionsByStaff, type CommissionDetail } from "./commissions";
import { fromDbDate, toDbDate } from "./dates";
import { markedDays, payrollStaff, workCalendars } from "./attendance";
import { rateSetFor, ratesFor } from "./rates";
import { getPayrollSettings } from "./settings";
export { invalidateDay, invalidateFrom, invalidateMonth } from "./locks";

const P = t.admin.payroll;

// ───────────────────────── Нээх, жагсаах ─────────────────────────

export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, P.badDate);

/** Сарын 2 үеийг тохиргооны дагуу үүсгэнэ (байвал алгасна) */
export async function openMonth(month: string, actorId: string) {
  monthSchema.parse(month);
  const s = await getPayrollSettings();
  const days = monthDays(month);
  const split = `${month}-${String(s.splitDay).padStart(2, "0")}`;
  const halves: { start: string; end: string; kind: PayrollKind }[] = [
    { start: days[0]!, end: split, kind: s.mode === "ADVANCE_FINAL" ? "ADVANCE" : "FULL" },
    { start: days[s.splitDay]!, end: days.at(-1)!, kind: s.mode === "ADVANCE_FINAL" ? "FINAL" : "FULL" },
  ];
  const existing = await db.payrollPeriod.findMany({ where: { startDate: { gte: toDbDate(days[0]!), lte: toDbDate(days.at(-1)!) } } });
  if (existing.length) throw new UserError(P.monthExists);
  return db.$transaction(async (tx) => {
    const created = [];
    for (const h of halves) {
      const p = await tx.payrollPeriod.create({ data: { startDate: toDbDate(h.start), endDate: toDbDate(h.end), kind: h.kind } });
      await audit(tx, { userId: actorId, action: "payroll.period.create", entity: "PayrollPeriod", entityId: p.id, after: h });
      created.push(p);
    }
    return created;
  });
}

export async function listPeriods() {
  const [periods, sums] = await Promise.all([
    db.payrollPeriod.findMany({ orderBy: { startDate: "desc" }, take: 48, include: { approvedBy: { select: { name: true } } } }),
    db.payrollLine.groupBy({ by: ["periodId"], _sum: { gross: true, net: true, siEmployer: true, siEmployee: true, pit: true }, _count: true }),
  ]);
  return periods.map((p) => {
    const s = sums.find((x) => x.periodId === p.id);
    return {
      ...p,
      from: fromDbDate(p.startDate),
      to: fromDbDate(p.endDate),
      lines: s?._count ?? 0,
      gross: s?._sum.gross ?? 0,
      net: s?._sum.net ?? 0,
      siEmployee: s?._sum.siEmployee ?? 0,
      pit: s?._sum.pit ?? 0,
      siEmployer: s?._sum.siEmployer ?? 0,
    };
  });
}

export type LineDetails = {
  attendance: { date: string; status: WorkStatus; weight: number; amount: number; marked: boolean }[];
  commissions: CommissionDetail[];
  adjustments: { type: "ADDITION" | "DEDUCTION"; amount: number; reason: string; period: "this" | "advance" }[];
  rates: null | { effectiveFrom: string; confirmed: boolean; employeeBp: number; employerBp: number; category: string | null; siCap: number | null; pitBp: number };
  tax: null | { siBase: number; taxable: number; pitBefore: number; credit: number };
  month: null | { from: string; base: number; serviceCommission: number; productCommission: number; gross: number; siEmployee: number; pit: number; net: number; advanceNet: number };
  /** PROMPT 18 §3: урамшууллын суурь (тооцоолсон хугацааны — FINAL бол бүтэн сар), NET = НӨАТ-гүй */
  bases?: { service: number; product: number; on: "NET" | "GROSS" };
  /** Ажилласан / нормын / илүү цаг (тооцоолсон хугацааны). Илүү цаг — зөвхөн мэдээлэл, цалинд ороогүй. */
  hours?: { worked: number; norm: number; overtime: number; weeks: { week: string; hours: number; overtime: number }[] };
  warnings: string[];
};

export async function getPeriod(id: string) {
  const p = await db.payrollPeriod.findUnique({
    where: { id },
    include: {
      approvedBy: { select: { name: true } },
      lines: { include: { staff: { select: { name: true, role: true } } }, orderBy: { staff: { name: "asc" } } },
      adjustments: { orderBy: { createdAt: "asc" }, include: { staff: { select: { name: true } } } },
    },
  });
  if (!p) return null;
  const from = fromDbDate(p.startDate);
  const rateSet = await rateSetFor(p.kind === "FINAL" ? `${monthOf(from)}-01` : from);
  return {
    ...p,
    from,
    to: fromDbDate(p.endDate),
    rateSet,
    lines: p.lines.map((l) => ({ ...l, details: l.details as unknown as LineDetails })),
  };
}

// ───────────────────────── Тооцоолох ─────────────────────────

type LineAmounts = {
  baseSalary: number;
  serviceCommission: number;
  productCommission: number;
  adjustments: number;
  deductions: number;
  gross: number;
  siEmployee: number;
  pit: number;
  siEmployer: number;
  net: number;
  advancePaid: number;
};

export async function calculatePeriod(id: string, actorId: string) {
  const period = await db.payrollPeriod.findUnique({ where: { id } });
  if (!period) throw new UserError(P.notFound);
  if (period.status !== "DRAFT") throw new UserError(P.notDraft);
  // "Явлаа" дараагүй сессийг тооцохоос өмнө хаана (Vercel дээр worker байхгүй)
  await closeStaleSessions();
  const from = fromDbDate(period.startDate);
  const to = fromDbDate(period.endDate);
  const month = monthOf(from);
  const md = monthDays(month);
  const settings = await getPayrollSettings();

  let advance: Prisma.PayrollPeriodGetPayload<{ include: { lines: true } }> | null = null;
  if (period.kind === "FINAL") {
    advance = await db.payrollPeriod.findFirst({ where: { kind: "ADVANCE", startDate: toDbDate(md[0]!) }, include: { lines: true } });
    if (advance && advance.status === "DRAFT") throw new UserError(P.advanceFirst);
  }
  // FINAL — бүтэн сараар (1-нээс)
  const earnFrom = period.kind === "FINAL" ? md[0]! : from;
  const withhold = period.kind !== "ADVANCE" || settings.advanceWithholding;
  const fraction = period.kind === "FINAL" || (from === md[0] && to === md.at(-1)) ? 1 : 0.5;
  const rateSet = await rateSetFor(earnFrom);

  const staff = await payrollStaff();
  const ids = staff.map((s) => s.id);
  const days = daysBetween(earnFrom, to);
  const [{ map: cals }, marked, history, comm, adjustments] = await Promise.all([
    workCalendars(ids, md[0]!, md.at(-1)!),
    markedDays(ids, earnFrom, to),
    db.salaryHistory.findMany({ where: { staffId: { in: ids } } }),
    commissionsByStaff(earnFrom, to, ids, { base: settings.commissionBase }),
    db.payrollAdjustment.findMany({ where: { periodId: { in: [id, ...(advance ? [advance.id] : [])] } } }),
  ]);

  const results = staff.flatMap((s) => {
    const cal = cals.get(s.id)!;
    const mine = new Map(marked.filter((m) => m.staffId === s.id).map((m) => [m.date, m.status as WorkStatus]));
    const att = resolveAttendance(days, mine, cal);
    const h = history.filter((x) => x.staffId === s.id).map((x) => ({ effectiveFrom: fromDbDate(x.effectiveFrom), monthly: x.monthly }));
    const base = basePay({ days: att.map(({ date, status }) => ({ date, status })), history: h, fallbackMonthly: s.baseSalary, cal });
    const c = comm.get(s.id)!;
    const adj = adjustments.filter((a) => a.staffId === s.id);
    const sum = (type: "ADDITION" | "DEDUCTION", periodId: string) => adj.filter((a) => a.type === type && a.periodId === periodId).reduce((x, a) => x + a.amount, 0);
    const adds = sum("ADDITION", id);
    const deds = sum("DEDUCTION", id);
    const rates = rateSet ? ratesFor(rateSet, s.siCategory) : null;
    const advLine = advance?.lines.find((l) => l.staffId === s.id) ?? null;

    let line: LineAmounts;
    let warnings: string[];
    let tax: LineDetails["tax"] = null;
    let monthInfo: LineDetails["month"] = null;
    if (period.kind === "FINAL") {
      const monthE = {
        base: base.amount,
        serviceCommission: c.service,
        productCommission: c.product,
        additions: adds + (advance ? sum("ADDITION", advance.id) : 0),
        deductions: deds + (advance ? sum("DEDUCTION", advance.id) : 0),
      };
      const f = computeFinal(monthE, advLine, rates);
      line = {
        baseSalary: base.amount - (advLine?.baseSalary ?? 0),
        serviceCommission: c.service - (advLine?.serviceCommission ?? 0),
        productCommission: c.product - (advLine?.productCommission ?? 0),
        adjustments: adds,
        ...f.line,
      };
      warnings = f.warnings;
      tax = f.month.tax && { siBase: f.month.tax.siBase, taxable: f.month.tax.taxable, pitBefore: f.month.tax.pitBefore, credit: f.month.tax.credit };
      monthInfo = { from: md[0]!, ...monthE, gross: f.month.gross, siEmployee: f.month.siEmployee, pit: f.month.pit, net: f.month.net, advanceNet: advLine?.net ?? 0 };
    } else {
      const r = computeLine({ base: base.amount, serviceCommission: c.service, productCommission: c.product, additions: adds, deductions: deds }, rates, { withhold, fraction });
      line = { baseSalary: r.base, serviceCommission: r.serviceCommission, productCommission: r.productCommission, adjustments: adds, deductions: deds, gross: r.gross, siEmployee: r.siEmployee, pit: r.pit, siEmployer: r.siEmployer, net: r.net, advancePaid: 0 };
      warnings = r.warnings;
      tax = r.tax && { siBase: r.tax.siBase, taxable: r.tax.taxable, pitBefore: r.tax.pitBefore, credit: r.tax.credit };
    }
    // Цалингүй, урамшуулалгүй, нэмэлтгүй ажилтныг оруулахгүй
    const monthly = h.length ? Math.max(...h.map((x) => x.monthly)) : s.baseSalary;
    if (monthly === 0 && !advLine && line.gross === 0 && line.deductions === 0) return [];
    if (withhold && rateSet && !rateSet.confirmedAt) warnings.push("RATES_UNCONFIRMED");
    const details: LineDetails = {
      attendance: base.breakdown.map((b, i) => ({ date: b.date, status: b.status, weight: b.weight, amount: b.amount, marked: att[i]!.marked })),
      commissions: c.details,
      adjustments: adj.map((a) => ({ type: a.type, amount: a.amount, reason: a.reason, period: a.periodId === id ? ("this" as const) : ("advance" as const) })),
      rates: rateSet && rates
        ? { effectiveFrom: rateSet.effectiveFrom, confirmed: !!rateSet.confirmedAt, employeeBp: rates.employeeSiBp, employerBp: rates.employerSiBp, category: s.siCategory, siCap: rates.siCap, pitBp: rates.pitBp }
        : null,
      tax,
      month: monthInfo,
      bases: { service: c.serviceBase, product: c.productBase, on: settings.commissionBase },
      hours: (() => {
        const hrs = new Map(marked.filter((m) => m.staffId === s.id).map((m) => [m.date, m.hours]));
        const ph = periodHours(att.map((d) => ({ date: d.date, planned: d.planned, hours: hoursOf(d.status, hrs.get(d.date)) })));
        return { worked: ph.worked, norm: ph.norm, overtime: ph.overtime, weeks: ph.weeks.map((w) => ({ week: w.week, hours: w.hours, overtime: w.overtime })) };
      })(),
      warnings: [...new Set([...base.warnings, ...warnings])],
    };
    return [{ staffId: s.id, plannedDays: base.plannedDays, workedDays: base.workedDays, ...line, details }];
  });

  await db.$transaction(async (tx) => {
    await tx.payrollLine.deleteMany({ where: { periodId: id, staffId: { notIn: results.map((r) => r.staffId) } } });
    for (const r of results) {
      const data = { ...r, details: r.details as unknown as Prisma.InputJsonValue };
      await tx.payrollLine.upsert({
        where: { periodId_staffId: { periodId: id, staffId: r.staffId } },
        create: { periodId: id, ...data },
        update: data,
      });
    }
    await tx.payrollPeriod.update({ where: { id }, data: { calculatedAt: new Date() } });
    // Дүн, нэрийг audit-д давхардуулахгүй — зөвхөн мөрийн тоо
    await audit(tx, { userId: actorId, action: "payroll.calculate", entity: "PayrollPeriod", entityId: id, after: { lines: results.length } });
  });
  return { lines: results.length };
}

// ───────────────────────── Нэмэлт / хасалт ─────────────────────────

export const adjustmentSchema = z.object({
  periodId: z.string().min(1),
  staffId: z.string().min(1),
  type: z.enum(["ADDITION", "DEDUCTION"]),
  amount: z.coerce.number({ error: P.badNumber }).int(P.badNumber).min(1, P.badNumber).max(1_000_000_000, P.badNumber),
  reason: z.string().trim().min(3, P.reasonRequired).max(200),
});

async function draftPeriod(id: string) {
  const p = await db.payrollPeriod.findUnique({ where: { id } });
  if (!p) throw new UserError(P.notFound);
  if (p.status !== "DRAFT") throw new UserError(P.notDraft);
  return p;
}

export async function addAdjustment(raw: z.input<typeof adjustmentSchema>, actorId: string) {
  const v = adjustmentSchema.parse(raw);
  await draftPeriod(v.periodId);
  return db.$transaction(async (tx) => {
    const a = await tx.payrollAdjustment.create({ data: { ...v, createdById: actorId } });
    await tx.payrollPeriod.update({ where: { id: v.periodId }, data: { calculatedAt: null } });
    await audit(tx, { userId: actorId, action: "payroll.adjustment.create", entity: "PayrollAdjustment", entityId: a.id, after: { periodId: v.periodId, staffId: v.staffId, type: v.type, amount: v.amount, reason: v.reason } });
    return a;
  });
}

export async function removeAdjustment(id: string, actorId: string) {
  const a = await db.payrollAdjustment.findUnique({ where: { id } });
  if (!a) return;
  await draftPeriod(a.periodId);
  await db.$transaction(async (tx) => {
    await tx.payrollAdjustment.delete({ where: { id } });
    await tx.payrollPeriod.update({ where: { id: a.periodId }, data: { calculatedAt: null } });
    await audit(tx, { userId: actorId, action: "payroll.adjustment.delete", entity: "PayrollAdjustment", entityId: id, before: { periodId: a.periodId, staffId: a.staffId, type: a.type, amount: a.amount, reason: a.reason } });
  });
}

// ───────────────────────── Батлах, цуцлах, олгосон ─────────────────────────

export async function approvePeriod(id: string, actorId: string) {
  const p = await getPeriod(id);
  if (!p) throw new UserError(P.notFound);
  if (p.status !== "DRAFT") throw new UserError(P.notDraft);
  if (!p.calculatedAt) throw new UserError(P.recalcFirst);
  if (p.lines.length === 0) throw new UserError(P.noLines);
  const settings = await getPayrollSettings();
  const withhold = p.kind !== "ADVANCE" || settings.advanceWithholding;
  if (withhold && (!p.rateSet || !p.rateSet.confirmedAt)) throw new UserError(P.ratesUnconfirmed);
  if (p.lines.some((l) => l.net < 0)) throw new UserError(P.negativeNet);
  await db.$transaction(async (tx) => {
    // Зэрэг батлахаас хамгаална: зөвхөн DRAFT + тооцоо хэвээр байвал
    const r = await tx.payrollPeriod.updateMany({
      where: { id, status: "DRAFT", calculatedAt: { not: null } },
      data: { status: "APPROVED", approvedById: actorId, approvedAt: new Date() },
    });
    if (r.count !== 1) throw new UserError(P.recalcFirst);
    // Зардал: нийт цалин, ажил олгогчийн НДШ, ХХОАТ (PROMPT 18 §1) — давхардахгүй
    await syncPayrollExpenses(tx, id, actorId);
    await audit(tx, { userId: actorId, action: "payroll.approve", entity: "PayrollPeriod", entityId: id, after: { lines: p.lines.length } });
  });
}

export const unapproveSchema = z.object({ id: z.string().min(1), reason: z.string().trim().min(5, P.reasonRequired).max(300) });

export async function unapprovePeriod(raw: z.input<typeof unapproveSchema>, actorId: string) {
  const { id, reason } = unapproveSchema.parse(raw);
  const p = await db.payrollPeriod.findUnique({ where: { id } });
  if (!p) throw new UserError(P.notFound);
  if (p.status === "PAID") throw new UserError(P.paidLocked);
  if (p.status !== "APPROVED") throw new UserError(P.notApproved);
  if (p.kind === "ADVANCE") {
    const month = monthDays(monthOf(fromDbDate(p.startDate)));
    const final = await db.payrollPeriod.findFirst({
      where: { kind: "FINAL", status: { in: ["APPROVED", "PAID"] }, startDate: { gte: toDbDate(month[0]!) }, endDate: { lte: toDbDate(month.at(-1)!) } },
    });
    if (final) throw new UserError(P.finalApproved);
  }
  await db.$transaction(async (tx) => {
    await tx.payrollPeriod.update({ where: { id }, data: { status: "DRAFT", approvedById: null, approvedAt: null, calculatedAt: null } });
    await removePayrollExpenses(tx, id);
    await audit(tx, { userId: actorId, action: "payroll.unapprove", entity: "PayrollPeriod", entityId: id, before: { status: "APPROVED" }, after: { status: "DRAFT", reason } });
  });
}

export async function markPaid(id: string, actorId: string) {
  await db.$transaction(async (tx) => {
    const r = await tx.payrollPeriod.updateMany({ where: { id, status: "APPROVED" }, data: { status: "PAID", paidAt: new Date() } });
    if (r.count !== 1) throw new UserError(P.notApproved);
    await audit(tx, { userId: actorId, action: "payroll.paid", entity: "PayrollPeriod", entityId: id, after: { status: "PAID" } });
  });
}

/** Ажилтны өөрийн цалингийн хуудас — зөвхөн батлагдсан/олгосон үе */
export async function myPayslips(staffId: string) {
  const lines = await db.payrollLine.findMany({
    where: { staffId, period: { status: { in: ["APPROVED", "PAID"] } } },
    include: { period: true },
    orderBy: { period: { startDate: "desc" } },
    take: 48,
  });
  return lines.map((l) => ({ ...l, from: fromDbDate(l.period.startDate), to: fromDbDate(l.period.endDate), details: l.details as unknown as LineDetails }));
}

/** Цалингийн хуудасны өгөгдөл (нэг ажилтан, нэг үе) */
export async function payslipFor(periodId: string, staffId: string) {
  const line = await db.payrollLine.findUnique({
    where: { periodId_staffId: { periodId, staffId } },
    include: { period: true, staff: { select: { name: true, role: true } } },
  });
  if (!line) return null;
  return { ...line, from: fromDbDate(line.period.startDate), to: fromDbDate(line.period.endDate), details: line.details as unknown as LineDetails };
}
