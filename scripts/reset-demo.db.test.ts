/**
 * reset-demo (PROMPT 23): demo үйлчилгээ, цаг, гүйлгээ, үйлчлүүлэгч, цалин, ирц → цэвэр эхлэл.
 * Ангилал, хэрэглэгч, ONLINE үйлчлүүлэгч, тохиргоо үлдэнэ.
 */
import pg from "pg";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { checkout } from "@/server/modules/sales/service";
import { makeBookableStaff, makeService, makeUser, makeVariant, resetDb } from "../tests/db-helpers";
import { PACKAGE_COUNTS, demoCustomers, hasPackageTables, resetDemo } from "./lib/reset-sql";

beforeEach(resetDb);

async function withClient<T>(fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const c = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
  await c.connect();
  try {
    await c.query("BEGIN");
    const r = await fn(c);
    await c.query("COMMIT");
    return r;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    await c.end();
  }
}

describe("reset-demo", () => {
  it("үйлчилгээ, цаг, борлуулалт, төлбөр, demo үйлчлүүлэгч/цалин/ирц → 0; ангилал, хэрэглэгч, ONLINE үйлчлүүлэгч үлдэнэ", async () => {
    const admin = await makeUser("ADMIN", { email: "admin@example.mn" });
    const staff = await makeBookableStaff("Сараа");
    await db.user.update({ where: { id: staff.id }, data: { email: "staff1@example.mn" } });
    for (let i = 0; i < 14; i++) await db.collection.create({ data: { slug: `c${i}`, name: `Ангилал ${i}`, kind: "CATEGORY" } });
    const branch = await db.branch.findFirstOrThrow({ where: { code: "CL" } });
    const service = await makeService({ price: 250_000 });
    await db.serviceStaff.create({ data: { serviceId: service.id, staffId: staff.id } });
    const demo = await db.customer.create({ data: { name: "Туршилт Сараа", phone: "99110001", email: "test.saraa@example.mn" } });
    const online = await db.customer.create({ data: { name: "Бат Болд", phone: "85563793", registeredVia: "ONLINE" } });
    const start = new Date(Date.now() + 86_400_000);
    await db.appointment.create({ data: { customerId: demo.id, serviceId: service.id, staffId: staff.id, branchId: branch.id, startsAt: start, endsAt: new Date(start.getTime() + 3_600_000), blockedUntil: new Date(start.getTime() + 3_600_000) } });
    await db.appointment.create({ data: { customerId: online.id, serviceId: service.id, staffId: staff.id, branchId: branch.id, startsAt: new Date(start.getTime() + 7_200_000), endsAt: new Date(start.getTime() + 10_800_000), blockedUntil: new Date(start.getTime() + 10_800_000) } });
    await db.visitPhoto.create({ data: { customerId: demo.id, kind: "BEFORE", storageKey: "visits/unlinked/abc.webp", width: 1, height: 1, bytes: 1, createdById: admin.id } });
    const v = await makeVariant({ price: 10_000, stock: 3 });
    const s = await checkout({ items: [{ kind: "PRODUCT", variantId: v.id, qty: 1 }, { kind: "SERVICE", serviceId: service.id, qty: 1, staffId: staff.id }] }, { id: admin.id, role: "ADMIN" });
    await db.payment.create({ data: { saleId: s.saleId, method: "CARD", amount: s.total, status: "SUCCEEDED", idempotencyKey: "k1", createdById: admin.id, approvalCode: "X", paidAt: new Date() } });
    await db.workDay.create({ data: { staffId: staff.id, date: new Date("2026-11-24T00:00:00Z"), status: "WORKED", hours: 8 } });
    const period = await db.payrollPeriod.create({ data: { startDate: new Date("2026-11-01T00:00:00Z"), endDate: new Date("2026-11-15T00:00:00Z") } });
    await db.payrollLine.create({ data: { periodId: period.id, staffId: staff.id, baseSalary: 1, net: 1, details: {} } });

    expect((await withClient((c) => demoCustomers(c, false))).map((x) => x.name)).toEqual(["Туршилт Сараа"]);
    const users = await db.user.count();
    const r = await withClient((c) => resetDemo(c, { target: "test" }));

    expect(r.photoKeys).toEqual(["visits/unlinked/abc.webp"]);
    for (const [model, n] of [
      ["service", await db.service.count()],
      ["appointment", await db.appointment.count()],
      ["sale", await db.sale.count()],
      ["payment", await db.payment.count()],
      ["product", await db.product.count()],
      ["visitPhoto", await db.visitPhoto.count()],
      ["payrollPeriod", await db.payrollPeriod.count()],
      ["workDay", await db.workDay.count()],
    ] as const) expect(n, model).toBe(0);
    expect(await db.collection.count()).toBe(14);
    expect(await db.user.count()).toBe(users);
    expect(await db.customer.findMany({ select: { name: true } })).toEqual([{ name: "Бат Болд" }]);
    expect(await db.auditLog.count({ where: { action: "demo.reset" } })).toBe(1);
  });

  it("ONLINE demo (туршилт) үйлчлүүлэгч — зөвхөн --include-online үед; тэмдэггүй бодит ONLINE хэзээ ч үгүй", async () => {
    await db.customer.create({ data: { name: "Туршилт Онлайн", phone: "85000001", registeredVia: "ONLINE" } });
    await db.customer.create({ data: { name: "Бодит Хүн", phone: "85000002", registeredVia: "ONLINE" } });
    await withClient((c) => resetDemo(c, { target: "test" }));
    expect(await db.customer.count()).toBe(2);
    await withClient((c) => resetDemo(c, { target: "test", includeOnline: true }));
    expect(await db.customer.findMany({ select: { name: true } })).toEqual([{ name: "Бодит Хүн" }]);
  });
});

describe("reset-demo — багц (PROMPT 27, migration 20261209000000_packages)", () => {
  it("PackageRedemption → CustomerPackage → PackageTemplateService → PackageTemplate устана; хүснэгтгүй DB-д алдаагүй", async () => {
    const has = await withClient((c) => hasPackageTables(c));
    const admin = await makeUser("ADMIN", { email: "admin@example.mn" });
    const staff = await makeBookableStaff("Сараа");
    const service = await makeService({ price: 100_000 });
    const demo = await db.customer.create({ data: { name: "Туршилт Багц", phone: "99110002", email: "pkg@example.mn" } });
    if (has) {
      // Prisma client энэ салбарт багцын модельгүй байж болно — raw SQL
      await db.$executeRawUnsafe(`INSERT INTO "PackageTemplate" ("id","name","paidSessions","price","updatedAt") VALUES ('pt1','10+1',10,1000000,now())`);
      await db.$executeRawUnsafe(`INSERT INTO "PackageTemplateService" ("packageId","serviceId") VALUES ('pt1',$1)`, service.id);
      const s = await checkout({ customerId: demo.id, items: [{ kind: "SERVICE", serviceId: service.id, qty: 1, staffId: staff.id }] }, { id: admin.id, role: "ADMIN" });
      const item = await db.saleItem.findFirstOrThrow({ where: { saleId: s.saleId } });
      await db.$executeRawUnsafe(`UPDATE "SaleItem" SET "packageTemplateId" = 'pt1' WHERE "id" = $1`, item.id);
      await db.$executeRawUnsafe(
        `INSERT INTO "CustomerPackage" ("id","customerId","templateId","saleItemId","name","totalSessions","paidAmount","updatedAt") VALUES ('cp1',$1,'pt1',$2,'10+1',11,1000000,now())`,
        demo.id,
        item.id,
      );
      await db.$executeRawUnsafe(`INSERT INTO "PackageRedemption" ("id","customerPackageId","serviceId","unitValue") VALUES ('pr1','cp1',$1,90909)`, service.id);
    }

    const r = await withClient((c) => resetDemo(c, { target: "test" }));
    if (has) {
      const labels = PACKAGE_COUNTS.map(([l]) => l);
      expect(r.deleted.filter((d) => labels.includes(d.label)).map((d) => d.count)).toEqual([1, 1, 1, 1]);
      for (const t of ["PackageRedemption", "CustomerPackage", "PackageTemplateService", "PackageTemplate"]) {
        const rows = await db.$queryRawUnsafe<{ n: number }[]>(`SELECT count(*)::int AS n FROM "${t}"`);
        expect(rows[0]!.n, t).toBe(0);
      }
    } else {
      expect(r.deleted.some((d) => PACKAGE_COUNTS.some(([l]) => l === d.label))).toBe(false);
    }
    expect(await db.service.count()).toBe(0);
    expect(await db.customer.count({ where: { id: demo.id } })).toBe(0);
  });
});
