"use server";

/**
 * Цалин, ирц (PROMPT 14). Эрх: ирц тэмдэглэх — attendance:write (ADMIN, MANAGER); амралтын өдөр — holiday:write;
 * цалин — payroll:write (ADMIN, ACCOUNTANT); хувь хэмжээ, горим — payroll:settings. Бүх өөрчлөлт AuditLog-д.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/server/auth/session";
import { setWorkDay, setWorkDaySchema } from "@/server/modules/payroll/attendance";
import { addHoliday, holidaySchema, removeHoliday } from "@/server/modules/payroll/holidays";
import {
  addAdjustment,
  adjustmentSchema,
  approvePeriod,
  calculatePeriod,
  markPaid,
  monthSchema,
  openMonth,
  removeAdjustment,
  unapprovePeriod,
  unapproveSchema,
} from "@/server/modules/payroll/periods";
import { confirmRateSet, deleteRateSet, rateSetSchema, saveRateSet, type RateSetInput } from "@/server/modules/payroll/rates";
import { savePayrollSettings, savePayrollSettingsSchema } from "@/server/modules/payroll/settings";
import { addSalary, removeSalary, salarySchema, saveStaffPayroll, staffPayrollSchema } from "@/server/modules/payroll/staff";
import { parseInput, runAction } from "./result";

const id = z.string().min(1);
const refresh = (...paths: string[]) => paths.forEach((p) => revalidatePath(p));

// ───────── Ирц ─────────

export async function setWorkDayAction(input: z.input<typeof setWorkDaySchema>) {
  return runAction(async () => {
    const user = await requirePermission("attendance:write");
    const r = await setWorkDay(parseInput(setWorkDaySchema, input), user.id);
    refresh("/admin/attendance");
    return r;
  }, "Ирц хадгалагдлаа.");
}

// ───────── Амралтын өдөр ─────────

export async function addHolidayAction(input: z.input<typeof holidaySchema>) {
  return runAction(async () => {
    const user = await requirePermission("holiday:write");
    await addHoliday(parseInput(holidaySchema, input), user.id);
    refresh("/admin/holidays", "/admin/attendance");
  }, "Нэмэгдлээ.");
}

export async function removeHolidayAction(holidayId: string) {
  return runAction(async () => {
    const user = await requirePermission("holiday:write");
    await removeHoliday(parseInput(id, holidayId), user.id);
    refresh("/admin/holidays", "/admin/attendance");
  }, "Хасагдлаа.");
}

// ───────── Үе ─────────

export async function openMonthAction(month: string) {
  return runAction(async () => {
    const user = await requirePermission("payroll:write");
    const created = await openMonth(parseInput(monthSchema, month), user.id);
    refresh("/admin/payroll");
    return created.map((p) => p.id);
  }, "Үе нээгдлээ.");
}

export async function calculatePeriodAction(periodId: string) {
  return runAction(async () => {
    const user = await requirePermission("payroll:write");
    const r = await calculatePeriod(parseInput(id, periodId), user.id);
    refresh("/admin/payroll", `/admin/payroll/${periodId}`);
    return r;
  }, "Тооцоолсон.");
}

export async function approvePeriodAction(periodId: string) {
  return runAction(async () => {
    const user = await requirePermission("payroll:write");
    await approvePeriod(parseInput(id, periodId), user.id);
    refresh("/admin/payroll", `/admin/payroll/${periodId}`, "/admin/attendance");
  }, "Батлагдлаа.");
}

export async function unapprovePeriodAction(input: z.input<typeof unapproveSchema>) {
  return runAction(async () => {
    const user = await requirePermission("payroll:write");
    const v = parseInput(unapproveSchema, input);
    await unapprovePeriod(v, user.id);
    refresh("/admin/payroll", `/admin/payroll/${v.id}`, "/admin/attendance");
  }, "Батламж цуцлагдлаа.");
}

export async function markPaidAction(periodId: string) {
  return runAction(async () => {
    const user = await requirePermission("payroll:write");
    await markPaid(parseInput(id, periodId), user.id);
    refresh("/admin/payroll", `/admin/payroll/${periodId}`);
  }, "Олгосон гэж тэмдэглэлээ.");
}

export async function addAdjustmentAction(input: z.input<typeof adjustmentSchema>) {
  return runAction(async () => {
    const user = await requirePermission("payroll:write");
    const v = parseInput(adjustmentSchema, input);
    await addAdjustment(v, user.id);
    refresh(`/admin/payroll/${v.periodId}`);
  }, "Нэмэгдлээ — дахин тооцоолно уу.");
}

export async function removeAdjustmentAction(adjustmentId: string, periodId: string) {
  return runAction(async () => {
    const user = await requirePermission("payroll:write");
    await removeAdjustment(parseInput(id, adjustmentId), user.id);
    refresh(`/admin/payroll/${periodId}`);
  }, "Хасагдлаа — дахин тооцоолно уу.");
}

// ───────── Ажилтны цалин ─────────

export async function addSalaryAction(input: z.input<typeof salarySchema>) {
  return runAction(async () => {
    const user = await requirePermission("payroll:write");
    await addSalary(parseInput(salarySchema, input), user.id);
    refresh("/admin/payroll/staff");
  }, "Хадгалагдлаа.");
}

export async function removeSalaryAction(salaryId: string) {
  return runAction(async () => {
    const user = await requirePermission("payroll:write");
    await removeSalary(parseInput(id, salaryId), user.id);
    refresh("/admin/payroll/staff");
  }, "Устгагдлаа.");
}

export async function saveStaffPayrollAction(input: z.input<typeof staffPayrollSchema>) {
  return runAction(async () => {
    const user = await requirePermission("payroll:write");
    await saveStaffPayroll(parseInput(staffPayrollSchema, input), user.id);
    refresh("/admin/payroll/staff");
  }, "Хадгалагдлаа.");
}

// ───────── Хувь хэмжээ, горим ─────────

export async function saveRateSetAction(rateSetId: string | null, input: RateSetInput) {
  return runAction(async () => {
    const user = await requirePermission("payroll:settings");
    // Талбарын алдааг маягтад буцаана; хувь → bp хөрвүүлэлтийг saveRateSet нэг удаа хийнэ (давхар биш)
    parseInput(rateSetSchema, input);
    await saveRateSet(rateSetId, input, user.id);
    refresh("/admin/payroll/settings", "/admin/payroll");
  }, "Хадгалагдлаа — баталгаажуулна уу.");
}

export async function confirmRateSetAction(rateSetId: string) {
  return runAction(async () => {
    const user = await requirePermission("payroll:settings");
    await confirmRateSet(parseInput(id, rateSetId), user.id);
    refresh("/admin/payroll/settings", "/admin/payroll");
  }, "Баталгаажлаа.");
}

export async function deleteRateSetAction(rateSetId: string) {
  return runAction(async () => {
    const user = await requirePermission("payroll:settings");
    await deleteRateSet(parseInput(id, rateSetId), user.id);
    refresh("/admin/payroll/settings");
  }, "Устгагдлаа.");
}

export async function savePayrollSettingsAction(input: z.input<typeof savePayrollSettingsSchema>) {
  return runAction(async () => {
    const user = await requirePermission("payroll:settings");
    await savePayrollSettings(parseInput(savePayrollSettingsSchema, input), user.id);
    refresh("/admin/payroll/settings", "/admin/payroll");
  }, "Горим хадгалагдлаа.");
}
