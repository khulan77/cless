/** Айлчлалын тайлан имэйлээр (PROMPT 15 §5): зөвшөөрөл, засвар, түүх, агуулга (бүтээгдэхүүн, дараагийн цаг), автомат — анхдагч унтраатай */
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { createPayment } from "@/server/modules/payments/service";
import { checkout } from "@/server/modules/sales/service";
import { saveVisit } from "@/server/modules/visits/service";
import { processOutbox } from "@/server/modules/outbox/worker";
import { makeCustomer, makeUser, makeVariant, resetDb } from "../../../../tests/db-helpers";
import { customerEmailHistory, queueVisitReport } from "./service";

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "cless-report-"));
  process.env.EMAIL_FILE_DIR = dir;
  delete process.env.WESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
});
afterAll(async () => {
  delete process.env.EMAIL_FILE_DIR;
  await rm(dir, { recursive: true, force: true });
});
let manager: Awaited<ReturnType<typeof makeUser>>;
beforeEach(async () => {
  await resetDb();
  manager = await makeUser("MANAGER");
});

async function paidVisit() {
  const customer = await makeCustomer({ email: "guest@test.mn" });
  const v = await makeVariant({ price: 180_000, stock: 5, name: "LOTION P50" });
  const visit = await saveVisit({ customerId: customer.id, skinType: "DRY", diagnosisNotes: "Хуурай", recommendations: [{ variantId: v.id, instructions: "Өглөө, орой" }] }, manager.id);
  const sale = await checkout({ customerId: customer.id, visitId: visit.id, items: [{ kind: "PRODUCT", variantId: v.id, qty: 2 }] }, { id: manager.id, role: "MANAGER" });
  await createPayment({ saleId: sale.saleId, method: "CARD", amount: sale.total, approvalCode: "AB12", idempotencyKey: crypto.randomUUID() }, { id: manager.id, role: "MANAGER" });
  return { customer, visit };
}

describe("айлчлалын тайлан имэйлээр", () => {
  it("автомат — анхдагчаар унтраатай; зөвшөөрөлгүй бол илгээхгүй", async () => {
    const { customer, visit } = await paidVisit();
    expect(await db.outboxJob.count({ where: { type: "VISIT_EMAIL" } })).toBe(0);
    await expect(queueVisitReport({ visitId: visit.id, actorId: manager.id })).rejects.toThrow(/зөвшөөрөөгүй/);
    await db.customer.update({ where: { id: customer.id }, data: { email: null, emailConsentAt: new Date() } });
    await expect(queueVisitReport({ visitId: visit.id, actorId: manager.id })).rejects.toThrow(/имэйл хаяг алга/);
  });

  it("засвар → илгээх → түүх SENT; агуулгад бүтээгдэхүүн, арьсны төрөл, цаг захиалах холбоос; script/iframe/зураггүй", async () => {
    const { customer, visit } = await paidVisit();
    await db.customer.update({ where: { id: customer.id }, data: { emailConsentAt: new Date() } });
    await queueVisitReport({ visitId: visit.id, actorId: manager.id, edits: { skinType: "SENSITIVE", summary: "Мэдрэг, улайлттай" } });
    expect(await db.visit.findUniqueOrThrow({ where: { id: visit.id } })).toMatchObject({ skinType: "SENSITIVE", diagnosisNotes: "Мэдрэг, улайлттай" });
    expect(await processOutbox()).toBe(1);

    const [h] = await customerEmailHistory(customer.id);
    expect(h).toMatchObject({ kind: "VISIT_REPORT", status: "SENT", sentById: manager.id });
    const job = await db.outboxJob.findFirstOrThrow({ where: { type: "VISIT_EMAIL" } });
    const html = await readFile(path.join(dir, `${job.id}.html`), "utf8");
    expect(html).toContain("LOTION P50");
    expect(html).toContain("Мэдрэг");
    expect(html).toContain("Мэдрэг, улайлттай");
    expect(html).toContain("/booking");
    expect(html).not.toMatch(/<script|<iframe|<img/i);
  });

  it("тохиргоо асаалттай + зөвшөөрөлтэй бол төлбөр төлөгдөхөд автоматаар", async () => {
    await db.siteSetting.create({ data: { key: "notify", value: { autoVisitEmail: true } } });
    const customer = await makeCustomer({ email: "auto@test.mn" });
    await db.customer.update({ where: { id: customer.id }, data: { emailConsentAt: new Date() } });
    const v = await makeVariant({ price: 50_000, stock: 5 });
    const visit = await saveVisit({ customerId: customer.id, skinType: "OILY", recommendations: [] }, manager.id);
    const sale = await checkout({ customerId: customer.id, visitId: visit.id, items: [{ kind: "PRODUCT", variantId: v.id, qty: 1 }] }, { id: manager.id, role: "MANAGER" });
    await createPayment({ saleId: sale.saleId, method: "CARD", amount: sale.total, approvalCode: "AB12", idempotencyKey: crypto.randomUUID() }, { id: manager.id, role: "MANAGER" });
    expect(await db.customerEmail.count({ where: { customerId: customer.id, sentById: manager.id } })).toBe(1);
  });
});
