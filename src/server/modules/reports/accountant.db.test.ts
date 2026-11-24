import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ubDateKey } from "@/lib/time";
import { db } from "@/server/db";
import { closeShift, openShift } from "@/server/modules/cash-shifts/service";
import { createPayment } from "@/server/modules/payments/service";
import { createRefund } from "@/server/modules/refunds/service";
import { checkout } from "@/server/modules/sales/service";
import { MAX_ATTEMPTS } from "@/server/modules/outbox/service";
import { claimJobs, runJob } from "@/server/modules/outbox/worker";
import { makeService, makeUser, makeVariant, resetDb } from "../../../../tests/db-helpers";
import { dailySummary, getAccountantEmails, requestAccountantSend, saveAccountantEmails } from "./accountant";

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "cless-acct-"));
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
const as = () => ({ id: manager.id, role: manager.role });
const today = () => ubDateKey();

/** Үйлчилгээ 200к + серум 2×60к, нийт хөнгөлөлт 20к → 320к; 1 серум буцаасан; кассын ээлж −5к зөрүүтэй хаагдсан */
async function dayWithSales() {
  const staff = await makeUser("STAFF");
  const facial = await makeService({ price: 200_000 });
  const serum = await makeVariant({ price: 60_000, stock: 5 });
  const r = await checkout(
    {
      items: [
        { kind: "SERVICE", serviceId: facial.id, qty: 1, staffId: staff.id },
        { kind: "PRODUCT", variantId: serum.id, qty: 2 },
      ],
      saleDiscount: { type: "AMOUNT", value: 20_000 },
      saleDiscountReason: "VIP",
    },
    as(),
  );
  await createPayment({ saleId: r.saleId, method: "CARD", amount: r.total, approvalCode: "AB12", idempotencyKey: crypto.randomUUID() }, as());
  const product = await db.saleItem.findFirstOrThrow({ where: { saleId: r.saleId, kind: "PRODUCT" } });
  const refund = await createRefund({ saleId: r.saleId, items: [{ saleItemId: product.id, qty: 1 }], reason: "Харшил", method: "CARD", restock: true }, manager.id);
  const shift = await openShift({ openingCash: 100_000 }, manager.id);
  await closeShift({ shiftId: shift.id, countedCash: 95_000, note: "Хариулт дутуу" }, { id: manager.id, canAll: true });
  return { total: r.total, refunded: refund.refund.amount };
}

describe("Нягтланд илгээх (A11)", () => {
  it("emails setting: trims, lowercases, dedupes; rejects bad addresses", async () => {
    await saveAccountantEmails({ emails: [" Acc@Example.mn ", "acc@example.mn", "", "two@example.mn"] }, manager.id);
    expect(await getAccountantEmails()).toEqual(["acc@example.mn", "two@example.mn"]);
    await expect(saveAccountantEmails({ emails: ["not-an-email"] }, manager.id)).rejects.toThrow();
    expect(await db.auditLog.count({ where: { action: "settings.accountant" } })).toBe(1);
  });

  it("daily summary: service/product split, discounts, refunds, payments net of refunds, cash difference", async () => {
    const d = await dayWithSales();
    const s = await dailySummary(today());
    expect(s.total).toBe(d.total - d.refunded);
    expect(s.service + s.product).toBe(s.total);
    expect(s.serviceOneTime).toBe(s.service);
    expect(s.serviceCourse).toBe(0);
    expect(s.discounts).toBe(20_000);
    expect(s.refunds).toBe(d.refunded);
    expect(s.payments).toEqual([{ method: "CARD", amount: d.total - d.refunded }]);
    expect(s.cashDifference).toBe(-5_000);
    expect(s.closedShifts).toBe(1);
  });

  it("no recipients → clear error; future day rejected", async () => {
    await expect(requestAccountantSend({ day: today() }, manager.id)).rejects.toThrow(/имэйл тохируулаагүй/);
    await saveAccountantEmails({ emails: ["acc@example.mn"] }, manager.id);
    await expect(requestAccountantSend({ day: "2999-01-01" }, manager.id)).rejects.toThrow(/Ирээгүй/);
  });

  it("send → outbox → email with Excel attachment → SENT; same day again asks to confirm, resend creates a new dispatch", async () => {
    await dayWithSales();
    await saveAccountantEmails({ emails: ["acc@example.mn", "cfo@example.mn"] }, manager.id);
    const r = await requestAccountantSend({ day: today() }, manager.id);
    expect(r.status).toBe("queued");
    const [job] = await claimJobs();
    expect(job!.type).toBe("ACCOUNTANT_REPORT");
    await runJob(job!);

    const d = await db.reportDispatch.findFirstOrThrow();
    expect(d).toMatchObject({ status: "SENT", recipients: ["acc@example.mn", "cfo@example.mn"], sentById: manager.id, error: null });
    const files = await readdir(dir);
    const html = files.find((f) => f.startsWith(job!.id.replace(/[^\w.-]/g, "_")) && f.endsWith(".html"))!;
    const xlsx = files.find((f) => f.endsWith(`tailan_${today()}.xlsx`))!;
    const body = await readFile(path.join(dir, html), "utf8");
    expect(body).toContain("to: acc@example.mn, cfo@example.mn");
    expect(body).toContain("Кассын ээлжийн зөрүү");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path.join(dir, xlsx));
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Хураангуй", "Үйлчилгээ", "Бүтээгдэхүүн"]);

    const again = await requestAccountantSend({ day: today() }, manager.id);
    expect(again).toMatchObject({ status: "confirm-resend", previous: { status: "SENT", by: manager.name } });
    expect(await db.reportDispatch.count()).toBe(1);
    expect((await requestAccountantSend({ day: today(), resend: true }, manager.id)).status).toBe("queued");
    expect(await db.reportDispatch.count()).toBe(2);
  });

  it("delivery error is recorded; after the last attempt the dispatch is FAILED", async () => {
    await saveAccountantEmails({ emails: ["acc@example.mn"] }, manager.id);
    await requestAccountantSend({ day: today() }, manager.id);
    process.env.EMAIL_FILE_DIR = "/dev/null/cannot-write";
    try {
      const [job] = await claimJobs();
      await db.outboxJob.update({ where: { id: job!.id }, data: { attempts: MAX_ATTEMPTS } });
      await runJob({ ...job!, attempts: MAX_ATTEMPTS });
    } finally {
      process.env.EMAIL_FILE_DIR = dir;
    }
    const d = await db.reportDispatch.findFirstOrThrow();
    expect(d.status).toBe("FAILED");
    expect(d.error).toBeTruthy();
  });
});
