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
