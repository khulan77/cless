import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { saveVisit } from "@/server/modules/visits/service";
import { makeUser, makeVariant, resetDb } from "../../../../tests/db-helpers";
import { createCustomer, customerProfile, findCustomerByPhone, normalizePhone, searchCustomers } from "./service";

let manager: Awaited<ReturnType<typeof makeUser>>;
beforeEach(async () => {
  await resetDb();
  manager = await makeUser("MANAGER");
});

describe("normalizePhone", () => {
  it.each([
    ["99110001", "99110001"],
    ["+976 9911-0001", "99110001"],
    ["976 99110001", "99110001"],
    ["9911 0001", "99110001"],
    // PROMPT 16: prod-д оруулсан хэлбэрүүд → WeSend-д 8 оронтой
    ["+97685563793", "85563793"],
    ["+976 8556-3793", "85563793"],
    ["976 85563793", "85563793"],
    ["85563793", "85563793"],
    ["1234567", null],
    ["09110001", null],
  ])("%s → %s", (input, out) => expect(normalizePhone(input)).toBe(out));
});

describe("customers + visits", () => {
  it("creates with a normalized phone, rejects duplicates, finds by partial phone", async () => {
    const c = await createCustomer({ name: "Болормаа", phone: "+976 8811-2233", email: "B@Test.mn" }, manager.id);
    expect(c.phone).toBe("88112233");
    expect(c.email).toBe("b@test.mn");
    await expect(createCustomer({ name: "Өөр", phone: "88112233" }, manager.id)).rejects.toThrow(/бүртгэлтэй/);
    expect((await searchCustomers("8811")).map((x) => x.id)).toEqual([c.id]);
    expect((await searchCustomers("болор")).map((x) => x.id)).toEqual([c.id]);
  });

  it("search starts at 3 characters; duplicate lookup accepts any phone format", async () => {
    const c = await createCustomer({ name: "Болормаа", phone: "88112233" }, manager.id);
    expect(await searchCustomers("бо")).toEqual([]);
    expect(await searchCustomers("88")).toEqual([]);
    expect((await searchCustomers("бол")).map((x) => x.id)).toEqual([c.id]);
    expect((await searchCustomers("881")).map((x) => x.id)).toEqual([c.id]);
    for (const typed of ["88112233", "8811-2233", "8811 2233", "+976 8811 2233"]) {
      expect(await findCustomerByPhone(typed), typed).toMatchObject({ id: c.id, name: "Болормаа" });
    }
    expect(await findCustomerByPhone("8811223")).toBeNull(); // not a full number yet
    expect(await findCustomerByPhone("88112233", c.id)).toBeNull(); // editing itself
  });

  it("saves a visit without a sale, prefilling instructions from howToUse", async () => {
    const c = await createCustomer({ name: "Сараа", phone: "99001122" }, manager.id);
    await db.collection.create({ data: { slug: "pigmentation", name: "Пигментаци", kind: "CONCERN" } });
    const v = await makeVariant({ price: 100_000, stock: 1 });
    await db.product.update({ where: { id: v.productId }, data: { howToUse: ["Өглөө", "Орой"] } });
    const visit = await saveVisit(
      { customerId: c.id, skinType: "DRY", concerns: ["pigmentation"], diagnosisNotes: "Хуурай", recommendations: [{ variantId: v.id }] },
      manager.id,
    );
    expect(visit.saleId).toBeNull();
    expect(visit.concerns).toEqual(["pigmentation"]);
    // Жагсаалтад байхгүй "асуудал" хадгалагдахгүй
    await expect(saveVisit({ customerId: c.id, concerns: ["free text"] }, manager.id)).rejects.toThrow(/жагсаалтад/);
    expect(visit.recommendations[0]!.instructions).toBe("1. Өглөө\n2. Орой");
    expect((await db.customer.findUniqueOrThrow({ where: { id: c.id } })).skinType).toBe("DRY");

    const edited = await saveVisit({ visitId: visit.id, customerId: c.id, recommendations: [{ variantId: v.id, instructions: "Орой л" }] }, manager.id);
    expect(edited.recommendations).toHaveLength(1);
    expect(edited.recommendations[0]!.instructions).toBe("Орой л");

    const profile = await customerProfile(c.id);
    expect(profile?.visits).toHaveLength(1);
    expect(profile?.totalSpent).toBe(0);
  });
});

describe("жагсаалт — төрсөн өдөр, ороогүй (PROMPT 27)", () => {
  it("энэ сард төрсөн өдөртэйгээр шүүнэ; «Ороогүй» тоо", async () => {
    const { listCustomersRanked } = await import("./history");
    const staff = await makeUser("STAFF");
    const svc = await db.service.create({ data: { slug: "s-bday", name: "FACIAL", description: "d", durationMin: 60, price: 1 } });
    const branch = await db.branch.findFirstOrThrow({ where: { code: "CL" } });
    const a = await db.customer.create({ data: { name: "Гуравдугаар Сар", phone: "99000101", birthday: new Date("1990-03-15T00:00:00Z") } });
    await db.customer.create({ data: { name: "Тавдугаар Сар", phone: "99000102", birthday: new Date("1992-05-01T00:00:00Z") } });
    const at = new Date("2026-03-01T03:00:00Z");
    await db.appointment.create({ data: { customerId: a.id, serviceId: svc.id, staffId: staff.id, branchId: branch.id, startsAt: at, endsAt: new Date(at.getTime() + 3_600_000), blockedUntil: new Date(at.getTime() + 3_600_000), status: "NO_SHOW" } });
    const march = await listCustomersRanked({ birthMonth: 3 });
    expect(march.rows.map((r) => r.name)).toEqual(["Гуравдугаар Сар"]);
    expect(march.rows[0]).toMatchObject({ noShows: 1, birthday: new Date("1990-03-15T00:00:00Z") });
    expect((await listCustomersRanked({})).count).toBe(2);
  });
});
