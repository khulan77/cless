/**
 * Цалингийн бүтэн урсгал (PROMPT 14): сар нээх → урьдчилгаа → батлах (ирц түгжигдэнэ) → сарын эцэс (бүтэн сараар
 * суутгал, урьдчилгаа хасах) → хуучирсан тооцоо → батлах → олгосон. Хувь хэмжээ — ТЕСТИЙН утга.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { ubDateKey } from "@/lib/time";
import { db } from "@/server/db";
import { createPayment } from "@/server/modules/payments/service";
import { checkout } from "@/server/modules/sales/service";
import { makeService, makeUser, resetDb } from "../../../../tests/db-helpers";
import { setWorkDay } from "./attendance";
import { computeFinal, daysBetween, monthDays, plannedDaysInMonth, weekdayOf } from "./calc";
import { toDbDate } from "./dates";
import { addHoliday } from "./holidays";
import { addAdjustment, approvePeriod, calculatePeriod, getPeriod, markPaid, myPayslips, openMonth, unapprovePeriod } from "./periods";
import { confirmRateSet, saveRateSet } from "./rates";
import { addSalary } from "./staff";

const RATES = {
  effectiveFrom: "2020-01-01",
  employeePct: 11.5,
  employerRates: [{ code: "A", label: "Ерөнхий", pct: 12.5 }],
  siCap: 5_000_000,
  pitPct: 10,
  pitCredits: [
    { from: 0, to: 1_000_000, credit: 18_000 },
    { from: 1_000_001, to: null, credit: 0 },
  ],
};

let admin: Awaited<ReturnType<typeof makeUser>>;
let staff: Awaited<ReturnType<typeof makeUser>>;
const month = ubDateKey().slice(0, 7);
const md = monthDays(month);
const MONFRI = { weekdays: new Set([1, 2, 3, 4, 5]), holidays: new Set<string>() };
const firstWeekday = md.find((d) => [1, 2, 3, 4, 5].includes(weekdayOf(d)))!;

beforeEach(async () => {
  await resetDb();
  admin = await makeUser("ACCOUNTANT");
  staff = await makeUser("STAFF");
  await db.staffSchedule.createMany({ data: [1, 2, 3, 4, 5].map((weekday) => ({ staffId: staff.id, weekday, startTime: "10:00", endTime: "19:00" })) });
  await addSalary({ staffId: staff.id, monthly: 2_100_000, effectiveFrom: "2020-01-01" }, admin.id);
});

async function periods() {
  const [adv, fin] = await db.payrollPeriod.findMany({ orderBy: { startDate: "asc" } });
  return { adv: adv!, fin: fin! };
}

describe("цалингийн үе (PROMPT 14)", () => {
  it("сар нээх: 1–15 урьдчилгаа, 16–сүүл сарын эцэс; давхар нээхгүй", async () => {
    await openMonth(month, admin.id);
    const { adv, fin } = await periods();
    expect(adv).toMatchObject({ kind: "ADVANCE", startDate: toDbDate(md[0]!), endDate: toDbDate(`${month}-15`) });
    expect(fin).toMatchObject({ kind: "FINAL", startDate: toDbDate(`${month}-16`), endDate: toDbDate(md.at(-1)!) });
    await expect(openMonth(month, admin.id)).rejects.toThrow(/аль хэдийн/);
  });

  it("бүтэн урсгал: урьдчилгаа → түгжээ → урамшуулал, нэмэлт → сарын эцэс → хуучирсан тооцоо → батлах → олгосон", async () => {
    const set = await saveRateSet(null, RATES, admin.id);
    await openMonth(month, admin.id);
    const { adv, fin } = await periods();

    // Ирц: эхний ажлын өдөр тасалсан
    await setWorkDay({ staffId: staff.id, date: firstWeekday, status: "ABSENT", note: "Тестийн засвар" }, admin.id);
    await calculatePeriod(adv.id, admin.id);
    const planned = plannedDaysInMonth(month, MONFRI);
    const firstHalfPlanned = daysBetween(md[0]!, `${month}-15`).filter((d) => MONFRI.weekdays.has(weekdayOf(d))).length;
    const a = (await getPeriod(adv.id))!.lines[0]!;
    expect(a.workedDays).toBe(firstHalfPlanned - 1);
    expect(a.baseSalary).toBe(Math.round((2_100_000 / planned) * (firstHalfPlanned - 1)));
    expect(a).toMatchObject({ siEmployee: 0, pit: 0, siEmployer: 0 }); // урьдчилгаа суутгалгүй

    // Урьдчилгааг батлахаас өмнө сарын эцсийг тооцохгүй; хувь хэмжээ баталгаажаагүй бол батлахгүй (урьдчилгаа — суутгалгүй тул болно)
    await expect(calculatePeriod(fin.id, admin.id)).rejects.toThrow(/урьдчилгааг/);
    await approvePeriod(adv.id, admin.id);
    await expect(setWorkDay({ staffId: staff.id, date: firstWeekday, status: "WORKED", note: "Тестийн засвар" }, admin.id)).rejects.toThrow(/батлагдсан/);
    await expect(addHoliday({ date: md[0]!, name: "Test" }, admin.id)).rejects.toThrow(/батлагдсан/);

    // Үйлчилгээ 200,000 × 10% = 20,000 урамшуулал (анхдагч GROSS — НӨАТ-тэй дүнгээс); нэмэлт 50,000
    await db.commissionRule.create({ data: { kind: "SERVICE", type: "PERCENT", value: 1000 } });
    const svc = await makeService({ price: 200_000 });
    const sale = await checkout({ items: [{ kind: "SERVICE", serviceId: svc.id, qty: 1, staffId: staff.id }] }, { id: admin.id, role: "ADMIN" });
    await createPayment({ saleId: sale.saleId, method: "CARD", amount: sale.total, approvalCode: "AP1", idempotencyKey: crypto.randomUUID() }, { id: admin.id, role: "ADMIN" });
    await addAdjustment({ periodId: fin.id, staffId: staff.id, type: "ADDITION", amount: 50_000, reason: "Шилдэг ажилтан" }, admin.id);

    await calculatePeriod(fin.id, admin.id);
    const f = (await getPeriod(fin.id))!.lines[0]!;
    const monthBase = Math.round((2_100_000 / planned) * (planned - 1));
    const expected = computeFinal(
      { base: monthBase, serviceCommission: 20_000, productCommission: 0, additions: 50_000, deductions: 0 },
      a,
      { employeeSiBp: 1150, employerSiBp: 1250, siCap: 5_000_000, pitBp: 1000, pitCredits: RATES.pitCredits },
    );
    expect(f.details.month).toMatchObject({ gross: monthBase + 70_000, advanceNet: a.net });
    expect(f).toMatchObject({ net: expected.line.net, siEmployee: expected.line.siEmployee, pit: expected.line.pit, advancePaid: a.net, adjustments: 50_000 });
    expect(a.net + f.net).toBe(expected.month.net);
    expect(f.details.commissions).toEqual([expect.objectContaining({ kind: "SERVICE", amount: 200_000, base: 200_000, commission: 20_000, rule: "10%" })]);
    expect(f.details.bases).toEqual({ service: 200_000, product: 0, on: "GROSS" });
    expect(f.details.hours).toMatchObject({ norm: planned * 8, worked: (planned - 1) * 8 });
    // Үйлчлүүлэгчийн мэдээлэл задаргаанд байхгүй
    expect(JSON.stringify(f.details)).not.toMatch(/customer|phone/i);

    // Хувь хэмжээ баталгаажаагүй → батлахгүй
    await expect(approvePeriod(fin.id, admin.id)).rejects.toThrow(/баталгаажуулаагүй/);
    await confirmRateSet(set.id, admin.id);
    // Баталгаажуулалт тооцоог хуучруулна → дахин тооцоолно
    await expect(approvePeriod(fin.id, admin.id)).rejects.toThrow(/Тооцоолох/);
    await calculatePeriod(fin.id, admin.id);

    // Сарын 2-р хагасын ирц өөрчлөгдвөл тооцоо хуучирна
    const lastWeekday = md.filter((d) => MONFRI.weekdays.has(weekdayOf(d))).at(-1)!;
    await setWorkDay({ staffId: staff.id, date: lastWeekday, status: "SICK", note: "Тестийн засвар" }, admin.id);
    expect((await db.payrollPeriod.findUniqueOrThrow({ where: { id: fin.id } })).calculatedAt).toBeNull();
    await expect(approvePeriod(fin.id, admin.id)).rejects.toThrow(/Тооцоолох/);
    await calculatePeriod(fin.id, admin.id);
    await approvePeriod(fin.id, admin.id);

    // Урьдчилгааны батламжийг сарын эцэс батлагдсан үед цуцлахгүй
    await expect(unapprovePeriod({ id: adv.id, reason: "Ирц буруу байсан" }, admin.id)).rejects.toThrow(/Сарын эцсийн/);
    await markPaid(fin.id, admin.id);
    await expect(unapprovePeriod({ id: fin.id, reason: "Ирц буруу байсан" }, admin.id)).rejects.toThrow(/Олгосон/);

    // Ажилтан зөвхөн батлагдсан цалингаа харна
    expect((await myPayslips(staff.id)).map((p) => p.periodId).sort()).toEqual([adv.id, fin.id].sort());

    const actions = (await db.auditLog.findMany({ select: { action: true } })).map((x) => x.action);
    expect(actions).toEqual(expect.arrayContaining(["payroll.calculate", "payroll.approve", "payroll.paid", "payroll.adjustment.create", "attendance.manual_edit", "payroll.rates.confirm"]));
    // Audit-д цалингийн дүн бичигдэхгүй (тооцооны мөрийн тоо л)
    const calc = await db.auditLog.findFirstOrThrow({ where: { action: "payroll.calculate" } });
    expect(calc.after).toEqual({ lines: 1 });
  });

  it("батламж цуцлах: шалтгаан заавал, ноорог болж тооцоо дахин шаардагдана", async () => {
    await openMonth(month, admin.id);
    const { adv } = await periods();
    await calculatePeriod(adv.id, admin.id);
    await approvePeriod(adv.id, admin.id);
    await expect(unapprovePeriod({ id: adv.id, reason: "" }, admin.id)).rejects.toThrow();
    await unapprovePeriod({ id: adv.id, reason: "Ирцийг засах хэрэгтэй" }, admin.id);
    const p = await db.payrollPeriod.findUniqueOrThrow({ where: { id: adv.id } });
    expect(p).toMatchObject({ status: "DRAFT", calculatedAt: null, approvedById: null });
    const log = await db.auditLog.findFirstOrThrow({ where: { action: "payroll.unapprove" } });
    expect(log.after).toMatchObject({ reason: "Ирцийг засах хэрэгтэй" });
  });

  it("хувь хэмжээ байхгүй → NO_RATES, сөрөг гарт олгох → батлахгүй", async () => {
    await db.siteSetting.create({ data: { key: "payroll", value: { mode: "INDEPENDENT", splitDay: 15, advanceWithholding: false } } });
    await openMonth(month, admin.id);
    const { adv } = await periods();
    expect(adv.kind).toBe("FULL");
    await addAdjustment({ periodId: adv.id, staffId: staff.id, type: "DEDUCTION", amount: 900_000_000, reason: "Тестийн хасалт" }, admin.id);
    await calculatePeriod(adv.id, admin.id);
    const line = (await getPeriod(adv.id))!.lines[0]!;
    expect(line.details.warnings).toEqual(expect.arrayContaining(["NO_RATES", "NEGATIVE_NET"]));
    await expect(approvePeriod(adv.id, admin.id)).rejects.toThrow(/баталгаажуулаагүй/);
  });

  it("засвар хийсэн хувь хэмжээ баталгаажуулалтаа алдана; батлагдсан үед ашиглагдсан бол засахгүй", async () => {
    const set = await saveRateSet(null, RATES, admin.id);
    await confirmRateSet(set.id, admin.id);
    await saveRateSet(set.id, { ...RATES, pitPct: 10 }, admin.id);
    expect((await db.payrollRateSet.findUniqueOrThrow({ where: { id: set.id } })).confirmedAt).toBeNull();

    await confirmRateSet(set.id, admin.id);
    await db.siteSetting.create({ data: { key: "payroll", value: { mode: "INDEPENDENT", splitDay: 15, advanceWithholding: false } } });
    await openMonth(month, admin.id);
    const { adv } = await periods();
    await calculatePeriod(adv.id, admin.id);
    await approvePeriod(adv.id, admin.id);
    await expect(saveRateSet(set.id, RATES, admin.id)).rejects.toThrow(/өөрчлөх боломжгүй/);
    // Ирээдүйн огноотой шинэ set оруулж болно
    await saveRateSet(null, { ...RATES, effectiveFrom: "2099-01-01" }, admin.id);
  });
});
