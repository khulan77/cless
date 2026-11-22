import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { resolveSender } from "@/server/modules/notifications/mailer";
import { makeUser, resetDb } from "../../../../tests/db-helpers";
import { getSalonSettings, saveEmailSettings, savePosSettings, saveQPayMode, saveSalonSettings } from "./admin-settings";
import { getEmailSettings, getPosSettings, getQPaySettings } from "./pos-settings";

let admin: Awaited<ReturnType<typeof makeUser>>;
beforeEach(async () => {
  await resetDb();
  admin = await makeUser("ADMIN");
});
afterEach(() => {
  for (const k of ["QPAY_BASE_URL", "QPAY_USERNAME", "QPAY_PASSWORD", "QPAY_INVOICE_CODE", "QPAY_CALLBACK_SECRET"]) delete process.env[k];
});

const salon = {
  name: "CLÉSS Spa",
  address: "Сүхбаатар дүүрэг, 1-р хороо",
  phone: "+976 7011 2233",
  email: "info@cless.mn",
  hours: ["Даваа–Бямба 10:00–20:00", "", "Ням амарна"],
  instagram: "https://instagram.com/cless",
  facebook: "",
  mapsUrl: "https://maps.app.goo.gl/abc123",
};

describe("ADMIN settings", () => {
  it("salon info updates the branch (e-mails) and the footer/contact, with an audit entry", async () => {
    await saveSalonSettings(salon, admin.id);
    const branch = await db.branch.findFirstOrThrow({ where: { code: "CL" } });
    expect(branch).toMatchObject({ name: "CLÉSS Spa", address: salon.address, phone: salon.phone });
    const footer = (await db.siteSetting.findUniqueOrThrow({ where: { key: "footer" } })).value as { contact: { hours: string[]; mapsUrl: string }; socials: { network: string }[] };
    expect(footer.contact.hours).toEqual(["Даваа–Бямба 10:00–20:00", "Ням амарна"]);
    expect(footer.contact.mapsUrl).toBe(salon.mapsUrl);
    expect(footer.socials.map((x) => x.network)).toEqual(["instagram"]);
    expect(await getSalonSettings()).toMatchObject({ name: "CLÉSS Spa", instagram: salon.instagram, facebook: "" });
    expect(await db.auditLog.count({ where: { action: "settings.salon" } })).toBe(1);
  });

  it("validates salon fields (phone, e-mail, social hosts, Maps link)", async () => {
    await expect(saveSalonSettings({ ...salon, email: "nope" }, admin.id)).rejects.toThrow();
    await expect(saveSalonSettings({ ...salon, instagram: "https://evil.com/x" }, admin.id)).rejects.toThrow();
    await expect(saveSalonSettings({ ...salon, mapsUrl: "http://maps.google.com/x" }, admin.id)).rejects.toThrow();
    await expect(saveSalonSettings({ ...salon, hours: ["", " "] }, admin.id)).rejects.toThrow();
  });

  it("POS limits and e-mail sender are stored; the sender falls back to EMAIL_FROM", async () => {
    await savePosSettings({ maxManagerDiscountPercent: 15, shiftDifferenceThreshold: 10_000, staleLockMinutes: 45 }, admin.id);
    expect(await getPosSettings()).toMatchObject({ maxManagerDiscountPercent: 15, shiftDifferenceThreshold: 10_000, staleLockMinutes: 45 });
    await expect(savePosSettings({ maxManagerDiscountPercent: 150, shiftDifferenceThreshold: 0, staleLockMinutes: 30 }, admin.id)).rejects.toThrow();

    expect(resolveSender(await getEmailSettings(), "CLÉSS <env@cless.mn>")).toEqual({ from: "CLÉSS <env@cless.mn>", replyTo: undefined });
    await saveEmailSettings({ fromName: "CLÉSS Spa", fromAddress: "hello@cless.mn", replyTo: "info@cless.mn" }, admin.id);
    expect(resolveSender(await getEmailSettings(), "CLÉSS <env@cless.mn>")).toEqual({ from: "CLÉSS Spa <hello@cless.mn>", replyTo: "info@cless.mn" });
    await expect(saveEmailSettings({ fromName: "", fromAddress: "bad", replyTo: "" }, admin.id)).rejects.toThrow();
  });

  it("QPay API mode can only be chosen when the QPAY_* keys are configured", async () => {
    await expect(saveQPayMode("api", admin.id)).rejects.toThrow(/QPAY_/);
    expect((await getQPaySettings()).mode).toBe("manual");
    Object.assign(process.env, {
      QPAY_BASE_URL: "https://merchant-sandbox.qpay.mn",
      QPAY_USERNAME: "u",
      QPAY_PASSWORD: "p",
      QPAY_INVOICE_CODE: "C",
      QPAY_CALLBACK_SECRET: "s".repeat(32),
    });
    await saveQPayMode("api", admin.id);
    expect((await getQPaySettings()).mode).toBe("api");
    expect(await db.auditLog.count({ where: { action: "settings.qpay" } })).toBe(1);
  });
});
