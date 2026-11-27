/**
 * PROMPT 27 §4 — багц үйлчилгээ (10+1).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { changeStatus } from "@/server/modules/appointments/service";
import { createPayment } from "@/server/modules/payments/service";
import { checkout } from "@/server/modules/sales/service";
import { makeBookableStaff, makeCustomer, makeService, makeUser, resetDb } from "../../../../tests/db-helpers";
import {
  attachPackage,
  customerPackages,
  expireAndRemindPackages,
  packageLiability,
  recognizedPackageRevenue,
  refundCalc,
  refundPackage,
  reverseRedemption,
  saveTemplate,
  unitValueFor,
  usablePackages,
} from "./service";

let manager: Awaited<ReturnType<typeof makeUser>>;
let admin: Awaited<ReturnType<typeof makeUser>>;
beforeEach(async () => {
  await resetDb();
  manager = await makeUser("MANAGER");
  admin = await makeUser("ADMIN");
});

const asManager = () => ({ id: manager.id, role: "MANAGER" as const });

async function setup(price = 2_500_000) {
  const staff = await makeBookableStaff("Сараа");
  const service = await makeService({ price: 250_000, name: "Нүүрний эмчилгээ" });
  const customer = await makeCustomer();
  const t = await saveTemplate(null, { name: "Нүүрний эмчилгээ 10+1", serviceIds: [service.id], paidSessions: 10, bonusSessions: 1, price, validDays: 365 }, admin.id);
  const sale = await checkout({ customerId: customer.id, items: [{ kind: "SERVICE", serviceId: service.id, packageTemplateId: t.id, qty: 1 }] }, asManager());
  await createPayment({ saleId: sale.saleId, method: "CARD", amount: sale.total, approvalCode: "AP1", idempotencyKey: crypto.randomUUID() }, asManager());
  const [cp] = await customerPackages(customer.id);
  return { staff, service, customer, t, sale, cp: cp! };
}

async function appt(customerId: string, serviceId: string, staffId: string, i: number) {
  const branch = await db.branch.findFirstOrThrow({ where: { code: "CL" } });
  const at = new Date(Date.now() - (i + 2) * 86_400_000);
  return db.appointment.create({
    data: { customerId, serviceId, staffId, branchId: branch.id, startsAt: at, endsAt: new Date(at.getTime() + 3_600_000), blockedUntil: new Date(at.getTime() + 3_600_000), status: "IN_PROGRESS" },
  });
}

describe("багц 10+1", () => {
  it("анхдагч үнэ = үйлчилгээний үнэ × төлөх тоо", async () => {
    const service = await makeService({ price: 250_000 });
    const t = await saveTemplate(null, { name: "10+1", serviceIds: [service.id], paidSessions: 10, bonusSessions: 1 }, admin.id);
    expect(t.price).toBe(2_500_000);
  });

  it("худалдах (бүтэн төлбөр) → 11 удаа; «Орсон» → 10 үлдэнэ; давхар «Орсон» → ганц хасалт; буцаалт", async () => {
    const { staff, service, customer, cp } = await setup();
    expect(cp).toMatchObject({ totalSessions: 11, usedSessions: 0, paidAmount: 2_500_000, status: "ACTIVE" });
    expect(await usablePackages(customer.id, service.id)).toEqual([expect.objectContaining({ id: cp.id, left: 11 })]);

    const a = await appt(customer.id, service.id, staff.id, 0);
    await attachPackage(a.id, cp.id, manager.id);
    await changeStatus({ id: a.id, action: "complete", reason: "Багцаар" }, { id: admin.id, role: "ADMIN" });
    let p = (await customerPackages(customer.id))[0]!;
    expect(p.usedSessions).toBe(1);
    expect(p.totalSessions - p.usedSessions).toBe(10);
    expect(p.redemptions[0]).toMatchObject({ unitValue: 227_272 }); // floor(2 500 000 / 11)

    // Давхар: дахин холбох / redeem оролдлого — ганц хасалт
    await expect(attachPackage(a.id, cp.id, manager.id)).rejects.toThrow(/аль хэдийн/);
    p = (await customerPackages(customer.id))[0]!;
    expect(p.usedSessions).toBe(1);
    expect(await db.packageRedemption.count()).toBe(1);

    // Буруу хассаныг буцаах (шалтгаантай) → 0
    await reverseRedemption({ redemptionId: p.redemptions[0]!.id, reason: "Буруу хассан" }, manager.id);
    expect((await customerPackages(customer.id))[0]!.usedSessions).toBe(0);
  });

  it("«Ороогүй» → хасахгүй (анхдагч); цуцалбал хасахгүй", async () => {
    const { staff, service, customer, cp } = await setup();
    const branch = await db.branch.findFirstOrThrow({ where: { code: "CL" } });
    const at = new Date(Date.now() - 86_400_000);
    const a = await db.appointment.create({ data: { customerId: customer.id, serviceId: service.id, staffId: staff.id, branchId: branch.id, startsAt: at, endsAt: new Date(at.getTime() + 3_600_000), blockedUntil: new Date(at.getTime() + 3_600_000), status: "CONFIRMED" } });
    await attachPackage(a.id, cp.id, manager.id);
    await changeStatus({ id: a.id, action: "noShow" }, asManager());
    expect((await customerPackages(customer.id))[0]!.usedSessions).toBe(0);
  });

  it("11 удаагийн нийлбэр = төлсөн дүн (сүүлийн удаа үлдэгдэл); USED_UP; орлого танилт; өр", async () => {
    const { staff, service, customer, cp } = await setup();
    expect(await packageLiability()).toBe(2_500_000);
    for (let i = 0; i < 11; i++) {
      const a = await appt(customer.id, service.id, staff.id, i);
      await attachPackage(a.id, cp.id, manager.id);
      await changeStatus({ id: a.id, action: "complete", reason: "Багцаар" }, { id: admin.id, role: "ADMIN" });
    }
    const p = (await customerPackages(customer.id))[0]!;
    expect(p).toMatchObject({ usedSessions: 11, status: "USED_UP" });
    expect(p.redemptions.reduce((s, r) => s + r.unitValue, 0)).toBe(2_500_000);
    expect(p.redemptions.find((r) => r.unitValue !== 227_272)!.unitValue).toBe(2_500_000 - 227_272 * 10);
    const rev = await recognizedPackageRevenue(new Date(0), new Date(Date.now() + 86_400_000));
    expect(rev).toEqual({ amount: 2_500_000, sessions: 11 });
    expect(await packageLiability()).toBe(0);
    expect(await usablePackages(customer.id, service.id)).toEqual([]);
  });

  it("хугацаа дууссан → санал болгохгүй, EXPIRED; 7 хоногийн өмнө SMS сануулга нэг удаа", async () => {
    const { customer, service, cp } = await setup();
    await db.customerPackage.update({ where: { id: cp.id }, data: { expiresAt: new Date(Date.now() + 3 * 86_400_000) } });
    expect(await expireAndRemindPackages()).toEqual({ expired: 0, reminded: 1 });
    expect(await expireAndRemindPackages()).toEqual({ expired: 0, reminded: 0 });
    expect(await db.outboxJob.count({ where: { type: "PACKAGE_EXPIRY" } })).toBe(1);
    await db.customerPackage.update({ where: { id: cp.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await usablePackages(customer.id, service.id)).toEqual([]);
    expect((await expireAndRemindPackages()).expired).toBe(1);
  });

  it("буцаалт: үлдсэн удаа × өртөг − торгууль %; Refund + REFUNDED", async () => {
    expect(refundCalc({ paidAmount: 2_500_000 }, 227_272 * 4, 10)).toEqual({ remaining: 1_590_912, penalty: 159_091, refund: 1_431_821 });
    expect(unitValueFor({ paidAmount: 100, totalSessions: 3 }, 2, 66)).toBe(34);
    const { customer, cp, sale } = await setup();
    await db.siteSetting.create({ data: { key: "packages", value: { refundPenaltyPct: 10 } } });
    const r = await refundPackage({ customerPackageId: cp.id, method: "TRANSFER", reason: "Үйлчлүүлэгч болиулсан" }, admin.id);
    expect(r).toEqual({ remaining: 2_500_000, penalty: 250_000, refund: 2_250_000 });
    expect((await customerPackages(customer.id))[0]).toMatchObject({ status: "REFUNDED", refundAmount: 2_250_000 });
    expect(await db.sale.findUniqueOrThrow({ where: { id: sale.saleId } })).toMatchObject({ refundedAmount: 2_250_000, status: "PARTIALLY_REFUNDED" });
  });

  it("хэсэгчилсэн төлбөр → бүтэн төлөгдөхөөс өмнө багц үүсэхгүй", async () => {
    const service = await makeService({ price: 100_000 });
    const customer = await makeCustomer();
    const t = await saveTemplate(null, { name: "5+1", serviceIds: [service.id], paidSessions: 5, bonusSessions: 1 }, admin.id);
    const sale = await checkout({ customerId: customer.id, items: [{ kind: "SERVICE", serviceId: service.id, packageTemplateId: t.id, qty: 1 }] }, asManager());
    await createPayment({ saleId: sale.saleId, method: "CARD", amount: 200_000, approvalCode: "AP1", idempotencyKey: crypto.randomUUID() }, asManager());
    expect(await db.customerPackage.count()).toBe(0);
    await createPayment({ saleId: sale.saleId, method: "CARD", amount: sale.total - 200_000, approvalCode: "AP2", idempotencyKey: crypto.randomUUID() }, asManager());
    expect(await db.customerPackage.count()).toBe(1);
  });

  it("үйлчлүүлэгчгүйгээр багц худалдахгүй", async () => {
    const service = await makeService({ price: 100_000 });
    const t = await saveTemplate(null, { name: "5 удаа", serviceIds: [service.id], paidSessions: 5 }, admin.id);
    await expect(checkout({ items: [{ kind: "SERVICE", serviceId: service.id, packageTemplateId: t.id, qty: 1 }] }, asManager())).rejects.toThrow(/үйлчлүүлэгч/);
  });
});

describe("багц — урамшуулал, тайлан", () => {
  it("гоо сайханчийн урамшуулал: багц худалдсан мөрөөс үгүй, ашигласан удаагаас (1 удаагийн өртөг) — тайланд урьдчилгаа/танигдсан тусдаа", async () => {
    const { commissionsByStaff } = await import("@/server/modules/payroll/commissions");
    const { loadReport } = await import("@/server/modules/reports/queries");
    const { ubDateKey } = await import("@/lib/time");
    const { staff, service, customer, cp } = await setup();
    await db.commissionRule.create({ data: { kind: "SERVICE", type: "PERCENT", value: 1000 } });
    const today = ubDateKey();
    expect((await commissionsByStaff(today, today, [staff.id])).get(staff.id)!.service).toBe(0);
    const a = await appt(customer.id, service.id, staff.id, 0);
    await attachPackage(a.id, cp.id, manager.id);
    await changeStatus({ id: a.id, action: "complete", reason: "Багцаар" }, { id: admin.id, role: "ADMIN" });
    const c = (await commissionsByStaff(today, today, [staff.id])).get(staff.id)!;
    expect(c).toMatchObject({ service: 22_727, serviceBase: 227_272 }); // 10% × 227 272 (GROSS)
    const r = await loadReport({ from: today, to: today }, { canCost: false });
    expect(r.kpi).toMatchObject({ packagePrepaid: 2_500_000, serviceCourse: 227_272, service: 0, total: 2_500_000 });
  });
});
