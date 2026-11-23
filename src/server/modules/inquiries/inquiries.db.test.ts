import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { handlers } from "@/server/modules/outbox/worker";
import { makeUser, makeVariant, resetDb } from "../../../../tests/db-helpers";
import { countNewInquiries, listInquiries, normalizeMnPhone, setInquiryStatus, submitInquiry } from "./service";

// UB = UTC+8. 2026-11-24 (Мягмар) 12:00 UB = 04:00 UTC; default hours Да–Бя 10:00–20:00, Ням амарна
const TUE_NOON = new Date("2026-11-24T04:00:00Z");
const TUE_NIGHT = new Date("2026-11-24T14:00:00Z"); // 22:00 UB
const SAT_NIGHT = new Date("2026-11-28T14:00:00Z"); // Бямба 22:00 → Ням амарна → Даваа

let variantId: string;
beforeEach(async () => {
  await resetDb();
  variantId = (await makeVariant({ price: 120_000, stock: 2, name: "LOTION P50" })).id;
});

const form = (over: Partial<Parameters<typeof submitInquiry>[0]> = {}) => ({
  name: "Сараа",
  phone: "+976 9911-2233",
  items: [{ variantId, qty: 1 }],
  note: "Бямба гарагт ирнэ",
  ...over,
});

describe("normalizeMnPhone", () => {
  it.each([
    ["99112233", "99112233"],
    ["+976 9911 2233", "99112233"],
    ["976-8811-2233", "88112233"],
  ])("%s → %s", (raw, want) => expect(normalizeMnPhone(raw)).toBe(want));
  it.each(["9911223", "12345678", "+1 555 123 4567", "утас"])("rejects %s", (raw) => expect(normalizeMnPhone(raw)).toBeNull());
});

describe("product inquiries", () => {
  it("creates an inquiry with names/prices from the DB and queues the reception e-mail", async () => {
    const r = await submitInquiry(form({ items: [{ variantId, qty: 2 }] }), { ip: "203.0.113.5", now: TUE_NOON });
    expect(r.message).toBe("Хүсэлт хүлээн авлаа. Ажлын цагаар 1 цагийн дотор холбогдоно.");
    const [row] = await listInquiries();
    expect(row).toMatchObject({ name: "Сараа", phone: "99112233", status: "NEW", note: "Бямба гарагт ирнэ" });
    expect(row!.items).toEqual([{ variantId, productName: "LOTION P50", size: "30 мл", qty: 2, price: 120_000 }]);
    const job = await db.outboxJob.findFirstOrThrow({ where: { type: "INQUIRY_EMAIL" } });
    expect(job.payload).toEqual({ inquiryId: row!.id });
    expect(await countNewInquiries()).toBe(1);
    // Stock is not reserved
    expect((await db.variant.findUniqueOrThrow({ where: { id: variantId } })).reserved).toBe(0);
  });

  it("reply depends on opening hours: tomorrow / next open day", async () => {
    expect((await submitInquiry(form(), { ip: null, now: TUE_NIGHT })).message).toBe("Хүсэлт хүлээн авлаа. Маргааш ажлын цагаар холбогдоно.");
    expect((await submitInquiry(form({ phone: "88112233" }), { ip: null, now: SAT_NIGHT })).message).toBe(
      "Хүсэлт хүлээн авлаа. Даваа гарагт ажлын цагаар холбогдоно.",
    );
  });

  it("honeypot: pretends success, stores nothing", async () => {
    const r = await submitInquiry(form({ website: "http://spam" }), { ip: "203.0.113.9", now: TUE_NOON });
    expect(r.message).toContain("Хүсэлт хүлээн авлаа");
    expect(await db.productInquiry.count()).toBe(0);
    expect(await db.outboxJob.count()).toBe(0);
  });

  it("rate limit: at most 3 per phone and per IP in 10 minutes", async () => {
    for (let i = 0; i < 3; i++) await submitInquiry(form(), { ip: `198.51.100.${i}`, now: TUE_NOON });
    await expect(submitInquiry(form(), { ip: "198.51.100.99", now: TUE_NOON })).rejects.toThrow("Хэт олон хүсэлт");
    for (const p of ["88110001", "88110002", "88110003"]) await submitInquiry(form({ phone: p }), { ip: "203.0.113.50", now: TUE_NOON });
    await expect(submitInquiry(form({ phone: "88110004" }), { ip: "203.0.113.50", now: TUE_NOON })).rejects.toThrow("Хэт олон хүсэлт");
    // Window passes
    const later = new Date(TUE_NOON.getTime() + 11 * 60 * 1000);
    await expect(submitInquiry(form(), { ip: "198.51.100.99", now: later })).resolves.toBeTruthy();
  });

  it("rejects bad phones and unpublished products", async () => {
    await expect(submitInquiry(form({ phone: "1234" }), { ip: null, now: TUE_NOON })).rejects.toThrow();
    await db.product.updateMany({ data: { isPublished: false } });
    await expect(submitInquiry(form(), { ip: null, now: TUE_NOON })).rejects.toThrow("Бүтээгдэхүүн олдсонгүй");
  });

  it("status change records who handled it (audit)", async () => {
    const manager = await makeUser("MANAGER");
    await submitInquiry(form(), { ip: null, now: TUE_NOON });
    const [row] = await listInquiries();
    await setInquiryStatus(row!.id, "CONTACTED", manager.id);
    expect(await listInquiries("CONTACTED")).toHaveLength(1);
    expect((await listInquiries())[0]!.handledBy?.name).toBe(manager.name);
    expect(await db.auditLog.count({ where: { action: "inquiry.status" } })).toBe(1);
    expect(await countNewInquiries()).toBe(0);
  });

  it("worker e-mails reception (file mailer) and skips when no address is set", async () => {
    await submitInquiry(form(), { ip: null, now: TUE_NOON });
    const job = await db.outboxJob.findFirstOrThrow({ where: { type: "INQUIRY_EMAIL" } });
    await expect(handlers.INQUIRY_EMAIL!.run(job)).resolves.toBeUndefined(); // no reception e-mail → skipped
    await db.siteSetting.create({
      data: { key: "footer", value: { columns: [], contact: { title: "", address: "", phone: "", email: "reception@cless.test", hours: [] }, socials: [], newsletter: {}, copyright: "" } },
    });
    await expect(handlers.INQUIRY_EMAIL!.run(job)).resolves.toBeUndefined();
  });
});
