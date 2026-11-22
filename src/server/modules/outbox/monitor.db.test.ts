import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { makeCustomer, makeUser, resetDb } from "../../../../tests/db-helpers";
import { failedEmailCount, problemJobs, retryJob } from "./monitor";

let admin: Awaited<ReturnType<typeof makeUser>>;
beforeEach(async () => {
  await resetDb();
  admin = await makeUser("ADMIN");
});

describe("outbox monitor", () => {
  it("lists failed and slow jobs; retry re-queues and marks the visit e-mail QUEUED", async () => {
    const customer = await makeCustomer();
    const branch = await db.branch.findFirstOrThrow();
    const visit = await db.visit.create({ data: { branchId: branch.id, customerId: customer.id, conductedById: admin.id, emailStatus: "FAILED", emailError: "smtp" } });
    const failed = await db.outboxJob.create({ data: { type: "VISIT_EMAIL", payload: { visitId: visit.id }, status: "FAILED", attempts: 5, lastError: "Resend: 403" } });
    const old = new Date(Date.now() - 30 * 60_000);
    await db.outboxJob.create({ data: { type: "APPT_REMINDER", payload: {}, status: "PENDING", runAfter: old, createdAt: old } });
    await db.outboxJob.create({ data: { type: "APPT_EMAIL", payload: {}, status: "PENDING" } }); // fresh — not slow

    const r = await problemJobs();
    expect(r.failed.map((j) => j.id)).toEqual([failed.id]);
    expect(r.slow.map((j) => j.type)).toEqual(["APPT_REMINDER"]);
    expect(await failedEmailCount()).toBe(1);

    await retryJob(failed.id, admin.id);
    const after = await db.outboxJob.findUniqueOrThrow({ where: { id: failed.id } });
    expect(after).toMatchObject({ status: "PENDING", attempts: 0 });
    expect((await db.visit.findUniqueOrThrow({ where: { id: visit.id } })).emailStatus).toBe("QUEUED");
    expect(await failedEmailCount()).toBe(0);
    expect(await db.auditLog.count({ where: { action: "outbox.retry" } })).toBe(1);
  });

  it("refuses to retry a job that already succeeded", async () => {
    const done = await db.outboxJob.create({ data: { type: "EMAIL", payload: {}, status: "DONE" } });
    await expect(retryJob(done.id, admin.id)).rejects.toThrow(/амжилттай/);
  });
});
