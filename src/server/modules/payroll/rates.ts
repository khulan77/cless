/**
 * НДШ / ХХОАТ-ын хувь хэмжээ (PROMPT 14 §6) — огноотой (effectiveFrom), ирээдүйн огноотойг урьдчилан оруулж болно.
 * Seed-д албан ёсны утга ОРУУЛАХГҮЙ: нягтлан оруулж "Баталгаажуулах" хүртэл тухайн set-тэй үеийг батлах боломжгүй.
 * Засвар бүр баталгаажуулалтыг цуцална. Батлагдсан үед ашиглагдсан set-ийг засахгүй. Бүх өөрчлөлт AuditLog-д.
 * Хувь нь UI-д "11.5" (%), DB-д basis point (1150).
 */
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { t } from "@/i18n";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { UserError } from "@/server/errors";
import type { PitCredit, Rates } from "./calc";
import { fromDbDate, toDbDate } from "./dates";
import { invalidateFrom } from "./locks";

const P = t.admin.payroll;

export type EmployerRate = { code: string; label: string; bp: number };
export type SiPart = { label: string; employeeBp: number; employerBp: number };

const pctToBp = (label: string) =>
  z.coerce.number({ error: `${label}: ${P.badNumber}` }).min(0, P.badNumber).max(100, P.badNumber).transform((v) => Math.round(v * 100));
const money = z.coerce.number({ error: P.badNumber }).int(P.badNumber).min(0, P.badNumber);

export const rateSetSchema = z
  .object({
    effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, P.badDate),
    employeePct: pctToBp(P.rates.employee),
    employerRates: z
      .array(z.object({ code: z.string().trim().min(1, P.required).max(20), label: z.string().trim().min(1, P.required).max(60), pct: pctToBp(P.rates.employer) }))
      .min(1, P.rates.needEmployer),
    siBreakdown: z
      .array(z.object({ label: z.string().trim().min(1, P.required).max(60), employeePct: pctToBp(P.rates.employee), employerPct: pctToBp(P.rates.employer) }))
      .default([]),
    siCap: money.nullable(),
    pitPct: pctToBp(P.rates.pit),
    pitCredits: z.array(z.object({ from: money, to: money.nullable(), credit: money })).default([]),
    note: z.string().trim().max(300).optional(),
  })
  .superRefine((v, ctx) => {
    const codes = v.employerRates.map((r) => r.code);
    if (new Set(codes).size !== codes.length) ctx.addIssue({ code: "custom", path: ["employerRates"], message: P.rates.dupCode });
    const sorted = [...v.pitCredits].sort((a, b) => a.from - b.from);
    sorted.forEach((c, i) => {
      if (c.to !== null && c.to < c.from) ctx.addIssue({ code: "custom", path: ["pitCredits", i], message: P.rates.badRange });
      const next = sorted[i + 1];
      if (next && (c.to === null || c.to >= next.from)) ctx.addIssue({ code: "custom", path: ["pitCredits", i], message: P.rates.overlap });
    });
  });

export type RateSetInput = z.input<typeof rateSetSchema>;

function toData(v: z.output<typeof rateSetSchema>) {
  return {
    effectiveFrom: toDbDate(v.effectiveFrom),
    employeeSiBp: v.employeePct,
    employerRates: v.employerRates.map((r) => ({ code: r.code, label: r.label, bp: r.pct })) as Prisma.InputJsonValue,
    siBreakdown: v.siBreakdown.map((r) => ({ label: r.label, employeeBp: r.employeePct, employerBp: r.employerPct })) as Prisma.InputJsonValue,
    siCap: v.siCap,
    pitBp: v.pitPct,
    pitCredits: [...v.pitCredits].sort((a, b) => a.from - b.from) as Prisma.InputJsonValue,
    note: v.note || null,
    // Засвар бүр дахин баталгаажуулалт шаардана
    confirmedById: null,
    confirmedAt: null,
  };
}

export function parseRateSet<T extends { employerRates: unknown; siBreakdown: unknown; pitCredits: unknown; effectiveFrom: Date }>(row: T) {
  return {
    ...row,
    effectiveFrom: fromDbDate(row.effectiveFrom),
    employerRates: (row.employerRates as EmployerRate[]) ?? [],
    siBreakdown: (row.siBreakdown as SiPart[]) ?? [],
    pitCredits: (row.pitCredits as PitCredit[]) ?? [],
  };
}
export type RateSet = ReturnType<typeof parseRateSet<Prisma.PayrollRateSetGetPayload<object>>>;

export async function listRateSets() {
  const rows = await db.payrollRateSet.findMany({ orderBy: { effectiveFrom: "desc" }, include: { confirmedBy: { select: { name: true } } } });
  return rows.map(parseRateSet);
}

/** Тухайн өдөр хүчинтэй set (effectiveFrom ≤ өдөр, хамгийн сүүлийнх) */
export async function rateSetFor(day: string): Promise<RateSet | null> {
  const row = await db.payrollRateSet.findFirst({ where: { effectiveFrom: { lte: toDbDate(day) } }, orderBy: { effectiveFrom: "desc" } });
  return row ? parseRateSet(row) : null;
}

/** Calc-д: ажилтны ангиллын ажил олгогчийн хувь (ангилал олдохгүй бол эхнийх) */
export function ratesFor(set: RateSet, category: string | null): Rates {
  const er = set.employerRates.find((r) => r.code === category) ?? set.employerRates[0];
  return { employeeSiBp: set.employeeSiBp, employerSiBp: er?.bp ?? 0, siCap: set.siCap, pitBp: set.pitBp, pitCredits: set.pitCredits };
}

/** Энэ set-ийг ашигласан батлагдсан үе байгаа эсэх (дараагийн set эхлэхээс өмнөх) */
async function usedByApproved(id: string) {
  const set = await db.payrollRateSet.findUniqueOrThrow({ where: { id } });
  const next = await db.payrollRateSet.findFirst({ where: { effectiveFrom: { gt: set.effectiveFrom } }, orderBy: { effectiveFrom: "asc" } });
  return db.payrollPeriod.findFirst({
    where: { status: { in: ["APPROVED", "PAID"] }, startDate: { gte: set.effectiveFrom, ...(next && { lt: next.effectiveFrom }) } },
    select: { id: true },
  });
}

export async function saveRateSet(id: string | null, raw: RateSetInput, actorId: string) {
  const v = rateSetSchema.parse(raw);
  if (id && (await usedByApproved(id))) throw new UserError(P.rates.inUse);
  const clash = await db.payrollRateSet.findUnique({ where: { effectiveFrom: toDbDate(v.effectiveFrom) }, select: { id: true } });
  if (clash && clash.id !== id) throw new UserError(P.rates.sameDate);
  return db.$transaction(async (tx) => {
    const before = id ? await tx.payrollRateSet.findUnique({ where: { id } }) : null;
    const row = id ? await tx.payrollRateSet.update({ where: { id }, data: toData(v) }) : await tx.payrollRateSet.create({ data: toData(v) });
    await invalidateFrom(v.effectiveFrom, tx);
    if (before) await invalidateFrom(fromDbDate(before.effectiveFrom), tx);
    await audit(tx, { userId: actorId, action: id ? "payroll.rates.update" : "payroll.rates.create", entity: "PayrollRateSet", entityId: row.id, before, after: row });
    return row;
  });
}

export async function confirmRateSet(id: string, actorId: string) {
  return db.$transaction(async (tx) => {
    const row = await tx.payrollRateSet.update({ where: { id }, data: { confirmedById: actorId, confirmedAt: new Date() } });
    await invalidateFrom(fromDbDate(row.effectiveFrom), tx);
    await audit(tx, { userId: actorId, action: "payroll.rates.confirm", entity: "PayrollRateSet", entityId: id, after: { effectiveFrom: fromDbDate(row.effectiveFrom) } });
    return row;
  });
}

export async function deleteRateSet(id: string, actorId: string) {
  if (await usedByApproved(id)) throw new UserError(P.rates.inUse);
  await db.$transaction(async (tx) => {
    const before = await tx.payrollRateSet.delete({ where: { id } });
    await invalidateFrom(fromDbDate(before.effectiveFrom), tx);
    await audit(tx, { userId: actorId, action: "payroll.rates.delete", entity: "PayrollRateSet", entityId: id, before });
  });
}
