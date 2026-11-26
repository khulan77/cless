/**
 * PROMPT 22: Vercel дээрх арын ажил — tick (advisory lock, хуучирсан мэдэгдэл алгасах, heartbeat),
 * after()-аар шууд илгээх.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { workerStatus } from "@/server/modules/outbox/heartbeat";
import { enqueue } from "@/server/modules/outbox/service";
import { resetDb } from "../../../../tests/db-helpers";
import { countStaleNotifications } from "./stale";
import { LOCK_KEY, runTick } from "./tick";

const pendingAfter: Promise<unknown>[] = [];
let afterAvailable = false;
vi.mock("next/server", () => ({
  after: (fn: () => Promise<unknown>) => {
    if (!afterAvailable) throw new Error("after() outside a request");
    pendingAfter.push(fn());
  },
}));

beforeEach(async () => {
  await resetDb();
  pendingAfter.length = 0;
  afterAvailable = false;
});
afterEach(() => {
  afterAvailable = false;
});

const flushAfter = async () => {
  for (let i = 0; i < 20 && pendingAfter.length === 0; i++) await new Promise((r) => setTimeout(r, 10));
  await Promise.all(pendingAfter);
};

describe("tick", () => {
  it("зэрэг дуудалт → lock эзэмшсэн үед нөгөө нь алгасна", async () => {
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_KEY})`;
      expect(await runTick()).toEqual({ skipped: true, reason: "locked" });
    });
    const r = await runTick();
    expect(r.skipped).toBe(false);
  });

  it("хуучирсан SMS / сануулгыг SKIPPED, шинийг илгээнэ; heartbeat (cron)", async () => {
    const now = new Date();
    const old = new Date(now.getTime() - 5 * 86_400_000);
    await db.outboxJob.createMany({
      data: [
        { id: "j_old_sms", type: "SMS", payload: { appointmentId: "none", kind: "received", startsAt: old.toISOString() }, runAfter: old },
        { id: "j_old_rem", type: "APPT_REMINDER", payload: { appointmentId: "none" }, runAfter: new Date(now.getTime() - 2 * 86_400_000) },
        { id: "j_new_sms", type: "SMS", payload: { appointmentId: "none", kind: "received", startsAt: now.toISOString() }, runAfter: now },
      ],
    });
    expect(await countStaleNotifications(now)).toEqual(expect.arrayContaining([{ type: "SMS", count: 1 }, { type: "APPT_REMINDER", count: 1 }]));
    const r = await runTick(now);
    expect(r).toMatchObject({ skipped: false, staleSkipped: 2, outbox: 1 });
    const status = Object.fromEntries((await db.outboxJob.findMany({ select: { id: true, status: true } })).map((j) => [j.id, j.status]));
    expect(status).toEqual({ j_old_sms: "SKIPPED", j_old_rem: "SKIPPED", j_new_sms: "DONE" });
    expect(await workerStatus()).toMatchObject({ source: "cron", stale: false });
  });
});

describe("after() — шууд илгээх", () => {
  it("хүсэлтийн дотор enqueue → хариуны дараа нэг дор DONE; request-гүй бол tick хүлээнэ", async () => {
    afterAvailable = true;
    await db.$transaction((tx) => enqueue(tx, { type: "SMS", payload: { appointmentId: "none", kind: "confirmed", startsAt: new Date().toISOString() } }));
    await flushAfter();
    expect((await db.outboxJob.findFirstOrThrow()).status).toBe("DONE");

    afterAvailable = false;
    pendingAfter.length = 0;
    await db.$transaction((tx) => enqueue(tx, { type: "SMS", payload: { appointmentId: "none2", kind: "confirmed", startsAt: new Date().toISOString() } }));
    await new Promise((r) => setTimeout(r, 50));
    expect(await db.outboxJob.count({ where: { status: "PENDING" } })).toBe(1);
  });

  it("хугацаатай (runAfter) ажлыг шууд илгээхгүй", async () => {
    afterAvailable = true;
    await db.$transaction((tx) => enqueue(tx, { type: "APPT_REMINDER", payload: { appointmentId: "x" }, runAfter: new Date(Date.now() + 3_600_000) }));
    await new Promise((r) => setTimeout(r, 50));
    expect(pendingAfter).toHaveLength(0);
  });
});
