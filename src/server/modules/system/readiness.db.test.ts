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
    expect(await failing()).toEqual(["salon", "services", "staff", "products", "qpay", "worker"]);
    await expect(markLaunched(admin.id)).rejects.toThrow(/биелээгүй/);

    await saveSalonSettings(
      { name: "CLÉSS", address: "Улаанбаатар, СБД", phone: "77112233", email: "info@cless.mn", hours: ["Да–Бя 10–20"], instagram: "", facebook: "", mapsUrl: "" },
      admin.id,
    );
    await makeService({ price: 100_000 });
    await makeBookableStaff();
    const v = await makeVariant({ price: 1000, stock: 1 });
    await db.productImage.create({ data: { productId: v.productId, url: "/x.jpg", alt: "x" } });
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

  it("e-mail is not ready without a Resend key", async () => {
    delete process.env.RESEND_API_KEY;
    expect((await readiness()).items.find((i) => i.key === "email")).toMatchObject({ ok: false, detail: "RESEND_API_KEY алга" });
  });
});
