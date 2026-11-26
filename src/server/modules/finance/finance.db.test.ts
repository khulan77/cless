/**
 * Санхүү (PROMPT 18): НӨАТ, зардал, цалин → системийн зардал, P&L, мөнгөн гүйлгээ, баланс.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { ubDateKey } from "@/lib/time";
import { db } from "@/server/db";
import { applyPayment } from "@/server/modules/sales/finalize";
import { checkout } from "@/server/modules/sales/service";
import { vatOf } from "@/server/modules/sales/pricing";
import { approvePeriod, calculatePeriod, openMonth, unapprovePeriod } from "@/server/modules/payroll/periods";
import { confirmRateSet, saveRateSet } from "@/server/modules/payroll/rates";
import { addSalary } from "@/server/modules/payroll/staff";
import { makeService, makeUser, makeVariant, resetDb } from "../../../../tests/db-helpers";
import { createExpense, deleteExpense, lastReferences, updateExpense } from "./expenses";
import { balanceSheet, cashFlow, financeRange, profitAndLoss, vatReport } from "./reports";
import { saveFinanceSettings } from "./settings";

let acc: Awaited<ReturnType<typeof makeUser>>;
const today = ubDateKey();
const cat = (code: string) => db.expenseCategory.findUniqueOrThrow({ where: { code } });

beforeEach(async () => {
  await resetDb();
  acc = await makeUser("ACCOUNTANT");
});

async function paidSale(items: Parameters<typeof checkout>[0]["items"], method: "CASH" | "CARD" = "CASH") {
  const r = await checkout({ items }, { id: acc.id, role: "ADMIN" });
  await db.payment.create({ data: { saleId: r.saleId, method, amount: r.total, status: "SUCCEEDED", idempotencyKey: crypto.randomUUID(), createdById: acc.id, paidAt: new Date(), ...(method === "CASH" ? { tendered: r.total, change: 0 } : { approvalCode: "X" }) } });
  await db.$transaction((tx) => applyPayment(tx, r.saleId, acc.id));
  return r;
}

describe("НӨАТ", () => {
  it("vatOf(400 000, 10%, included) = 36 364 (цэвэр 363 636)", () => {
    expect(vatOf(400_000, 1000, true)).toBe(36_364);
    expect(400_000 - vatOf(400_000, 1000, true)).toBe(363_636);
  });
});

describe("зардал", () => {
  it("ашиглалтад код заавал; НӨАТ мөрөөр; сүүлийн код санал болгоно; системийн ангилалд гараар үгүй", async () => {
    const util = await cat("UTIL");
    await expect(createExpense({ categoryId: util.id, date: today, amount: 110_000 }, acc.id)).rejects.toThrow(/код/);
    const e = await createExpense({ categoryId: util.id, date: today, amount: 110_000, vatIncluded: true, reference: "UB-123456", vendor: "УБЦТС", paidVia: "TRANSFER" }, acc.id);
    expect(e.vatAmount).toBe(10_000);
    expect((await lastReferences())[util.id]).toEqual({ reference: "UB-123456", vendor: "УБЦТС" });
    await updateExpense(e.id, { categoryId: util.id, date: today, amount: 220_000, vatIncluded: true, reference: "UB-123456" }, acc.id);
    expect((await db.expense.findUniqueOrThrow({ where: { id: e.id } })).vatAmount).toBe(20_000);
    const payroll = await cat("PAYROLL");
    await expect(createExpense({ categoryId: payroll.id, date: today, amount: 1 }, acc.id)).rejects.toThrow(/Системийн/);
    await deleteExpense(e.id, acc.id);
    expect(await db.auditLog.count({ where: { entity: "Expense" } })).toBe(3);
  });
});

describe("цалин → системийн зардал", () => {
  it("батлахад 3 мөр (цалин, НДШ, ХХОАТ); дахин батлахад давхардахгүй; цуцлахад устна", async () => {
    const staff = await makeUser("STAFF");
    await addSalary({ staffId: staff.id, monthly: 2_000_000, effectiveFrom: "2020-01-01" }, acc.id);
    const set = await saveRateSet(null, { effectiveFrom: "2020-01-01", employeePct: 11.5, employerRates: [{ code: "A", label: "Ерөнхий", pct: 12.5 }], siCap: null, pitPct: 10, pitCredits: [] }, acc.id);
    await confirmRateSet(set.id, acc.id);
    await saveRateSetSettingsIndependent();
    await openMonth(today.slice(0, 7), acc.id);
    const p = (await db.payrollPeriod.findFirstOrThrow({ orderBy: { startDate: "asc" } }));
    await calculatePeriod(p.id, acc.id);
    await approvePeriod(p.id, acc.id);
    const rows = await db.expense.findMany({ where: { payrollPeriodId: p.id }, include: { category: true } });
    const line = await db.payrollLine.findFirstOrThrow({ where: { periodId: p.id } });
    expect(Object.fromEntries(rows.map((r) => [r.category.kind, r.amount]))).toEqual({ PAYROLL: line.gross, SOCIAL_INSURANCE: line.siEmployer, PIT: line.pit });

    await unapprovePeriod({ id: p.id, reason: "Дахин шалгах" }, acc.id);
    expect(await db.expense.count({ where: { payrollPeriodId: p.id } })).toBe(0);
    await calculatePeriod(p.id, acc.id);
    await approvePeriod(p.id, acc.id);
    expect(await db.expense.count({ where: { payrollPeriodId: p.id } })).toBe(3);
  });
});

/** Хагас бүрийг бие даан (суутгалтай) — эхний үе ч НДШ/ХХОАТ-тай */
async function saveRateSetSettingsIndependent() {
  await db.siteSetting.upsert({ where: { key: "payroll" }, create: { key: "payroll", value: { mode: "INDEPENDENT", splitDay: 15 } }, update: { value: { mode: "INDEPENDENT", splitDay: 15 } } });
}

describe("тайлан", () => {
  it("P&L: үйлчилгээ/бүтээгдэхүүн тусдаа, НӨАТ-гүй, өртөг, зардал → цэвэр ашиг; мөнгөн гүйлгээ; баланс; НӨАТ", async () => {
    const staff = await makeUser("STAFF");
    const facial = await makeService({ price: 440_000 });
    const serum = await makeVariant({ price: 110_000, stock: 5, cost: 40_000 });
    await paidSale([{ kind: "SERVICE", serviceId: facial.id, qty: 1, staffId: staff.id }], "CARD");
    await paidSale([{ kind: "PRODUCT", variantId: serum.id, qty: 2 }], "CASH");
    const net = await cat("NET");
    await createExpense({ categoryId: net.id, date: today, amount: 55_000, vatIncluded: true, reference: "UNI-9", paidVia: "CASH" }, acc.id);

    const { range } = financeRange({ period: "day", date: today });
    const pl = await profitAndLoss(range);
    const vatS = pl.revenue.service.vat;
    const vatP = pl.revenue.product.vat;
    expect(pl.revenue.service.total).toBe(440_000);
    expect(pl.revenue.product.total).toBe(220_000);
    expect(pl.revenue.service.net + vatS).toBe(440_000);
    expect(pl.revenue.total.net).toBe(660_000 - vatS - vatP);
    expect(pl.cogs).toBe(80_000);
    expect(pl.grossProfit).toBe(pl.revenue.total.net - 80_000);
    expect(pl.expenses).toEqual([{ code: "NET", name: "Интернэтийн төлбөр", net: 50_000, vat: 5_000 }]);
    expect(pl.netProfit).toBe(pl.grossProfit - 50_000);

    await saveFinanceSettings({ managerExpenses: false, managerFinance: false, opening: { asOf: today, cash: 100_000, bank: 1_000_000 } }, acc.id);
    const cf = await cashFlow(range);
    expect(cf.totals).toMatchObject({ inCash: 220_000, inBank: 440_000, outCash: 55_000, outBank: 0 });
    expect(cf.opening).toEqual({ cash: 100_000, bank: 1_000_000 });
    expect(cf.closing).toEqual({ cash: 265_000, bank: 1_440_000 });

    const bs = await balanceSheet(today);
    expect(bs.assets.find((a) => a.label === "Бэлэн мөнгө")!.amount).toBe(265_000);
    expect(bs.assets.find((a) => a.label.startsWith("Бараа"))!.amount).toBe(3 * 40_000);

    const [v] = await vatReport(range);
    expect(v).toMatchObject({ month: today.slice(0, 7), salesVat: vatS + vatP, expenseVat: 5_000, payable: vatS + vatP - 5_000 });
  });

  it("хугацаа: 15 хоног (1–15 / 16–эцэс), сар", () => {
    expect(financeRange({ period: "half", date: "2026-02-20" }).range).toEqual({ from: "2026-02-16", to: "2026-02-28" });
    expect(financeRange({ period: "half", date: "2026-02-03" }).range).toEqual({ from: "2026-02-01", to: "2026-02-15" });
    expect(financeRange({ period: "month", date: "2024-02-10" }).range).toEqual({ from: "2024-02-01", to: "2024-02-29" });
  });
});
