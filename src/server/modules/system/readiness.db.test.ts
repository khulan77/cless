import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { beat } from "@/server/modules/outbox/heartbeat";
import { saveSalonSettings } from "@/server/modules/settings/admin-settings";
import { makeBookableStaff, makeService, makeUser, makeVariant, resetDb } from "../../../../tests/db-helpers";
import { markLaunched, readiness } from "./readiness";

let admin: Awaited<ReturnType<typeof makeUser>>;
beforeEach(async () => {
  await resetDb();
  admin = await makeUser("ADMIN", { email: "owner@cless.mn" });
  process.env.RESEND_API_KEY = "re_test";
  process.env.EMAIL_FROM = "CLÉSS <no-reply@cless.mn>";
});
afterEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
});

const failing = async () => (await readiness()).items.filter((i) => !i.ok).map((i) => i.key);

describe("launch readiness", () => {
  it("lists what is missing, then passes when everything is set; launching locks seed/reset", async () => {
    expect(await failing()).toEqual(["salon", "services", "staff", "products", "hero", "productImages", "qpay", "worker"]);
    await expect(markLaunched(admin.id)).rejects.toThrow(/биелээгүй/);

    await saveSalonSettings(
      { name: "CLÉSS", address: "Улаанбаатар, СБД", phone: "77112233", email: "info@cless.mn", instagram: "", facebook: "", mapsUrl: "" },
      admin.id,
    );
    await makeService({ price: 100_000 });
    await makeBookableStaff();
    const v = await makeVariant({ price: 1000, stock: 1 });
    // A dev placeholder does not count as an image
    await db.productImage.create({ data: { productId: v.productId, url: "/placeholders/product-1.svg", alt: "x" } });
    await db.siteSetting.create({ data: { key: "hero", value: { image: { src: "/placeholders/hero.svg", alt: "" } } } });
    expect(await failing()).toEqual(expect.arrayContaining(["products", "hero", "productImages"]));
    await db.productImage.create({ data: { productId: v.productId, url: "/x.jpg", alt: "x" } });
    await db.siteSetting.update({ where: { key: "hero" }, data: { value: { image: { src: "/uploads/hero.jpg", alt: "Салон" } } } });
    await db.siteSetting.create({ data: { key: "qpay", value: { mode: "manual" } } });
    await beat();
    // makeUser / makeBookableStaff use @test.mn — not seed data
    expect(await failing()).toEqual([]);

    // Seed leftovers are reported
    await makeUser("STAFF", { email: "staff9@example.mn" });
    await db.customer.create({ data: { name: "Туршилт", phone: "99110001" } });
    const r = await readiness();
    expect(r.items.find((i) => i.key === "testData")).toMatchObject({ ok: false });
    expect(r.items.find((i) => i.key === "testData")!.detail).toMatch(/seed хэрэглэгч.*туршилтын үйлчлүүлэгч/);

    await db.user.deleteMany({ where: { email: { endsWith: "@example.mn" } } });
    await db.customer.deleteMany({ where: { phone: "99110001" } });
    const at = await markLaunched(admin.id);
    expect((await readiness()).launchedAt).toBe(at);
    expect(await db.auditLog.count({ where: { action: "system.launched" } })).toBe(1);
  });

  it("product images: under 90% of public products with a real photo fails", async () => {
    for (let i = 0; i < 10; i++) {
      const v = await makeVariant({ price: 1000, stock: 1 });
      if (i < 8) await db.productImage.create({ data: { productId: v.productId, url: `/uploads/${i}.jpg`, alt: "x" } });
    }
    expect((await readiness()).items.find((i) => i.key === "productImages")).toMatchObject({ ok: false, detail: "8/10 (80%)" });
    const missing = await db.product.findMany({ where: { images: { none: {} } } });
    await db.productImage.create({ data: { productId: missing[0]!.id, url: "/uploads/9.jpg", alt: "x" } });
    expect((await readiness()).items.find((i) => i.key === "productImages")).toMatchObject({ ok: true, detail: "9/10 (90%)" });
  });

  it("e-mail is not ready without a Resend key", async () => {
    delete process.env.RESEND_API_KEY;
    expect((await readiness()).items.find((i) => i.key === "email")).toMatchObject({ ok: false, detail: "RESEND_API_KEY алга" });
  });
});
