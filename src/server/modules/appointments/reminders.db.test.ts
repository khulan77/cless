import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ubAt } from "@/lib/time";
import { db } from "@/server/db";
import { claimJobs, runJob } from "@/server/modules/outbox/worker";
import { makeBookableStaff, makeCustomer, makeService, makeUser, resetDb } from "../../../../tests/db-helpers";
import { changeStatus, createAppointment, moveAppointment } from "./service";

const NOW = new Date("2026-12-01T00:00:00Z");
const at = (hm: string) => ubAt("2026-12-03", hm);
let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "cless-appt-mail-"));
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

/** Бүх хугацаа нь болсон ажлыг гүйцэтгэнэ */
async function runDue(now: Date) {
  const jobs = await claimJobs(50, now);
  for (const j of jobs) await runJob(j, now);
  return jobs.map((j) => j.type);
}

describe("appointment e-mails and reminders", () => {
  it("create → confirmation + reminder 24h before; move → old reminder skipped, new one sent; cancel → e-mail", async () => {
    const staff = await makeBookableStaff();
    const service = await makeService({ price: 100_000 });
    const customer = await makeCustomer({ email: "guest@test.mn" });
    const a = await createAppointment({ customerId: customer.id, serviceId: service.id, staffId: staff.id, startsAt: at("10:00") }, { id: manager.id, role: "MANAGER" }, NOW);

    const jobs = await db.outboxJob.findMany({ orderBy: { createdAt: "asc" } });
    expect(jobs.map((j) => j.type)).toEqual(["APPT_EMAIL", "APPT_REMINDER"]);
    expect(jobs[1]!.runAfter.toISOString()).toBe(new Date(at("10:00").getTime() - 24 * 3600_000).toISOString());
    expect(jobs[1]!.dedupeKey).toBe(`appt-reminder:${a.id}:${at("10:00").toISOString()}`);

    expect(await runDue(NOW)).toEqual(["APPT_EMAIL"]); // сануулга хараахан болоогүй
    expect((await readdir(dir)).length).toBe(1);

    await moveAppointment({ id: a.id, version: a.version, startsAt: at("14:00"), staffId: staff.id }, { id: manager.id, role: "MANAGER" }, NOW);
    expect(await db.outboxJob.count({ where: { type: "APPT_REMINDER" } })).toBe(2);

    // 24 цагийн өмнө: хуучин (10:00) сануулга алгасагдана, шинэ (14:00) илгээгдэнэ, өөрчлөлтийн имэйл
    const before = (await readdir(dir)).length;
    await runDue(new Date(at("14:00").getTime() - 23 * 3600_000));
    expect((await readdir(dir)).length - before).toBe(2); // changed + шинэ сануулга
    expect(await db.outboxJob.count({ where: { status: "DONE" } })).toBe(4);

    await changeStatus({ id: a.id, action: "cancel", reason: "Цаг өөрчилсөн" }, { id: manager.id, role: "MANAGER" }, NOW);
    await runDue(NOW);
    expect((await readdir(dir)).length).toBe(before + 3);
  });

  it("no e-mail address → no jobs; appointment soon (inside 24h) → no reminder", async () => {
    const staff = await makeBookableStaff();
    const service = await makeService({ price: 100_000 });
    const noMail = await makeCustomer({ email: null });
    await createAppointment({ customerId: noMail.id, serviceId: service.id, staffId: staff.id, startsAt: at("10:00") }, { id: manager.id, role: "MANAGER" }, NOW);
    expect(await db.outboxJob.count()).toBe(0);
    const mail = await makeCustomer({ email: "x@test.mn" });
    await createAppointment({ customerId: mail.id, serviceId: service.id, staffId: staff.id, startsAt: at("12:00") }, { id: manager.id, role: "MANAGER" }, new Date(at("12:00").getTime() - 3 * 3600_000));
    expect((await db.outboxJob.findMany()).map((j) => j.type)).toEqual(["APPT_EMAIL"]);
  });
});
