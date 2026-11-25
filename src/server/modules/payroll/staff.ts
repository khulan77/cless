/**
 * Ажилтны цалингийн мэдээлэл: сарын үндсэн цалингийн түүх (огноотой), ажил олгогчийн НДШ-ийн ангилал,
 * банкны данс (шифрлэгдсэн — зөвхөн payroll:write). Бүх өөрчлөлт AuditLog-д — дансны дугаарыг audit-д бичихгүй.
 */
import { z } from "zod";
import { t } from "@/i18n";
import { ubDateKey } from "@/lib/time";
import { audit } from "@/server/audit";
import { decryptField, encryptField, maskAccount } from "@/server/crypto/field";
import { db } from "@/server/db";
import { UserError } from "@/server/errors";
import { salaryAt } from "./calc";
import { fromDbDate, toDbDate } from "./dates";
import { invalidateFrom, lockedPeriodFor } from "./locks";
import { payrollStaff } from "./attendance";

const P = t.admin.payroll;

export async function staffPayrollInfo() {
  const staff = await payrollStaff();
  const [history, bank] = await Promise.all([
    db.salaryHistory.findMany({ where: { staffId: { in: staff.map((s) => s.id) } }, orderBy: { effectiveFrom: "desc" } }),
    db.user.findMany({ where: { id: { in: staff.map((s) => s.id) } }, select: { id: true, bankAccountEnc: true } }),
  ]);
  const today = ubDateKey();
  return staff.map((s) => {
    const h = history.filter((x) => x.staffId === s.id).map((x) => ({ id: x.id, effectiveFrom: fromDbDate(x.effectiveFrom), monthly: x.monthly, note: x.note }));
    const enc = bank.find((b) => b.id === s.id)?.bankAccountEnc ?? null;
    return { ...s, history: h, current: salaryAt(h, today, s.baseSalary), bankMasked: maskAccount(decryptField(enc)), hasBank: !!enc };
  });
}

export const salarySchema = z.object({
  staffId: z.string().min(1),
  monthly: z.coerce.number({ error: P.badNumber }).int(P.badNumber).min(0, P.badNumber).max(1_000_000_000, P.badNumber),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, P.badDate),
  note: z.string().trim().max(200).optional(),
});

/** Шинэ цалин (огноотой). Батлагдсан үед хамаарах огноогоор оруулахгүй. Өнөөдөр хүчинтэй бол User.baseSalary-г ч шинэчилнэ. */
export async function addSalary(raw: z.input<typeof salarySchema>, actorId: string) {
  const v = salarySchema.parse(raw);
  if (await lockedPeriodFor(v.effectiveFrom)) throw new UserError(P.dayLocked);
  return db.$transaction(async (tx) => {
    const row = await tx.salaryHistory.upsert({
      where: { staffId_effectiveFrom: { staffId: v.staffId, effectiveFrom: toDbDate(v.effectiveFrom) } },
      create: { staffId: v.staffId, monthly: v.monthly, effectiveFrom: toDbDate(v.effectiveFrom), note: v.note || null, createdById: actorId },
      update: { monthly: v.monthly, note: v.note || null, createdById: actorId },
    });
    const all = await tx.salaryHistory.findMany({ where: { staffId: v.staffId } });
    const current = salaryAt(all.map((x) => ({ effectiveFrom: fromDbDate(x.effectiveFrom), monthly: x.monthly })), ubDateKey(), -1);
    if (current >= 0) await tx.user.update({ where: { id: v.staffId }, data: { baseSalary: current } });
    await invalidateFrom(v.effectiveFrom, tx);
    await audit(tx, { userId: actorId, action: "payroll.salary.set", entity: "SalaryHistory", entityId: row.id, after: { staffId: v.staffId, effectiveFrom: v.effectiveFrom, monthly: v.monthly } });
    return row;
  });
}

export async function removeSalary(id: string, actorId: string) {
  const row = await db.salaryHistory.findUnique({ where: { id } });
  if (!row) return;
  if (await lockedPeriodFor(fromDbDate(row.effectiveFrom))) throw new UserError(P.dayLocked);
  await db.$transaction(async (tx) => {
    await tx.salaryHistory.delete({ where: { id } });
    await invalidateFrom(fromDbDate(row.effectiveFrom), tx);
    await audit(tx, { userId: actorId, action: "payroll.salary.delete", entity: "SalaryHistory", entityId: id, before: { staffId: row.staffId, effectiveFrom: fromDbDate(row.effectiveFrom), monthly: row.monthly } });
  });
}

export const staffPayrollSchema = z.object({
  staffId: z.string().min(1),
  siCategory: z.string().trim().max(20).nullable(),
  /** undefined = өөрчлөхгүй, "" = устгах */
  bankAccount: z.string().trim().max(80).optional(),
});

export async function saveStaffPayroll(raw: z.input<typeof staffPayrollSchema>, actorId: string) {
  const v = staffPayrollSchema.parse(raw);
  const data: { siCategory: string | null; bankAccountEnc?: string | null } = { siCategory: v.siCategory || null };
  if (v.bankAccount !== undefined) data.bankAccountEnc = v.bankAccount ? encryptField(v.bankAccount) : null;
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: v.staffId }, data });
    // Ангилал (ажил олгогчийн НДШ) өөрчлөгдвөл ноорог үеүүдийг дахин тооцоолуулна
    await invalidateFrom("1970-01-01", tx);
    await audit(tx, {
      userId: actorId,
      action: "payroll.staff.update",
      entity: "User",
      entityId: v.staffId,
      // Дансны дугаарыг audit-д бичихгүй — зөвхөн өөрчлөгдсөн эсэх
      after: { siCategory: data.siCategory, bankAccount: v.bankAccount === undefined ? "unchanged" : v.bankAccount ? "set" : "cleared" },
    });
  });
}

/** Банкны шилжүүлгийн жагсаалтад (payroll:write) — тайлсан данс */
export async function bankAccounts(staffIds: string[]) {
  const rows = await db.user.findMany({ where: { id: { in: staffIds } }, select: { id: true, bankAccountEnc: true } });
  return new Map(rows.map((r) => [r.id, decryptField(r.bankAccountEnc)]));
}
