import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { createPayment } from "@/server/modules/payments/service";
import { checkout } from "@/server/modules/sales/service";
import { saveVisit } from "@/server/modules/visits/service";
import { makeCustomer, makeUser, makeVariant, resetDb } from "../../../../tests/db-helpers";
import { MAX_ATTEMPTS } from "./service";
import { claimJobs, handlers, processOutbox, recoverStuckJobs, runJob } from "./worker";

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "cless-emails-"));
  process.env.EMAIL_FILE_DIR = dir;
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

async function paidVisitSale() {
  const customer = await makeCustomer({ email: "guest@test.mn" });
  // PROMPT 15 §5: автоматаар илгээх нь тохиргоо + зөвшөөрөлтэй үед л
  await db.customer.update({ where: { id: customer.id }, data: { emailConsentAt: new Date() } });
  await db.siteSetting.upsert({ where: { key: "notify" }, create: { key: "notify", value: { autoVisitEmail: true } }, update: { value: { autoVisitEmail: true } } });
  const v = await makeVariant({ price: 180_000, stock: 2, name: "SÉRUM TEST" });
  const visit = await saveVisit({ customerId: customer.id, skinType: "DRY", diagnosisNotes: "Хуурай", recommendations: [{ variantId: v.id }] }, manager.id);
  const sale = await checkout({ customerId: customer.id, visitId: visit.id, items: [{ kind: "PRODUCT", variantId: v.id, qty: 1 }] }, { id: manager.id, role: "MANAGER" });
  await createPayment({ saleId: sale.saleId, method: "CARD", amount: sale.total, approvalCode: "AB12", idempotencyKey: crypto.randomUUID() }, { id: manager.id, role: "MANAGER" });
  return { visit, sale };
}

describe("outbox worker", () => {
  it("delivers the visit email to a file and marks the visit SENT", async () => {
    const { visit } = await paidVisitSale();
    expect((await db.visit.findUniqueOrThrow({ where: { id: visit.id } })).emailStatus).toBe("QUEUED");
    expect(await processOutbox()).toBe(1);
    const job = await db.outboxJob.findFirstOrThrow({ where: { type: "VISIT_EMAIL" } });
    expect(job.status).toBe("DONE");
    const after = await db.visit.findUniqueOrThrow({ where: { id: visit.id } });
    expect(after.emailStatus).toBe("SENT");
    const html = await readFile(path.join(dir, `${job.id}.html`), "utf8");
    expect(html).toContain("guest@test.mn");
    expect(html).toContain("SÉRUM TEST");
    expect(html).toContain("CLÉSS");
    // Дахин ажиллуулахад юу ч хийхгүй
    expect(await processOutbox()).toBe(0);
  });

  it("retries with backoff, then FAILED after max attempts (visit marked FAILED)", async () => {
    const { visit } = await paidVisitSale();
    const original = handlers.VISIT_EMAIL!.run;
    handlers.VISIT_EMAIL!.run = async () => {
      throw new Error("smtp down");
    };
    try {
      let now = new Date();
      for (let i = 1; i <= MAX_ATTEMPTS; i++) {
        const [job] = await claimJobs(10, now);
        expect(job?.attempts).toBe(i);
        const r = await runJob(job!, now);
        expect(r).toBe(i < MAX_ATTEMPTS ? "RETRY" : "FAILED");
        // Backoff дуусахаас өмнө дахин авахгүй
        expect(await claimJobs(10, now)).toHaveLength(0);
        now = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      }
      const job = await db.outboxJob.findFirstOrThrow({ where: { type: "VISIT_EMAIL" } });
      expect(job.status).toBe("FAILED");
      expect(job.lastError).toMatch(/smtp down/);
      expect((await db.visit.findUniqueOrThrow({ where: { id: visit.id } })).emailStatus).toBe("FAILED");
    } finally {
      handlers.VISIT_EMAIL!.run = original;
    }
  });

  it("concurrent claims never hand out the same job; stuck jobs are recovered", async () => {
    for (let i = 0; i < 6; i++) {
      await db.outboxJob.create({ data: { type: "EMAIL", payload: {}, dedupeKey: `t${i}` } });
    }
    const [a, b, c] = await Promise.all([claimJobs(3), claimJobs(3), claimJobs(3)]);
    const ids = [...a!, ...b!, ...c!].map((j) => j.id);
    expect(ids).toHaveLength(6);
    expect(new Set(ids).size).toBe(6);

    expect(await recoverStuckJobs(new Date(Date.now() + 11 * 60 * 1000))).toBe(6);
    expect(await db.outboxJob.count({ where: { status: "PENDING" } })).toBe(6);
  });
});
