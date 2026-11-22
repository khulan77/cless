import { beforeEach, describe, expect, it } from "vitest";
import { ubAt } from "@/lib/time";
import { db } from "@/server/db";
import { UserError } from "@/server/errors";
import { createPayment } from "@/server/modules/payments/service";
import { applyPayment } from "@/server/modules/sales/finalize";
import { checkout } from "@/server/modules/sales/service";
import { makeBookableStaff, makeCustomer, makeService, makeUser, resetDb } from "../../../../tests/db-helpers";
import { changeStatus, createAppointment, listSlots, moveAppointment, openInPos, overlapError, updateAppointment, updateApptNote } from "./service";

// 2026-12-02 = Лхагва; салбар 10–20 (default), ажилтан 10–19
const DAY = "2026-12-02";
const NOW = new Date("2026-12-01T00:00:00Z");
const at = (hm: string, d = DAY) => ubAt(d, hm);

let manager: Awaited<ReturnType<typeof makeUser>>;
let admin: Awaited<ReturnType<typeof makeUser>>;
const asManager = () => ({ id: manager.id, role: manager.role });
beforeEach(async () => {
  await resetDb();
  manager = await makeUser("MANAGER");
  admin = await makeUser("ADMIN");
});

async function setup(svc: { bufferMin?: number; requiresRoom?: boolean } = {}) {
  const staff = await makeBookableStaff("Сараа");
  const service = await makeService({ price: 250_000, durationMin: 60, ...svc });
  const customer = await makeCustomer();
  return { staff, service, customer };
}
const book = (s: Awaited<ReturnType<typeof setup>>, hm: string, extra: { staffId?: string; roomId?: string | null } = {}) =>
  createAppointment({ customerId: s.customer.id, serviceId: s.service.id, staffId: extra.staffId ?? s.staff.id, roomId: extra.roomId, startsAt: at(hm) }, asManager(), NOW);

describe("create / overlap", () => {
  it("creates with endsAt/blockedUntil/price snapshot and rejects an overlapping time for the same staff", async () => {
    const s = await setup({ bufferMin: 15 });
    const a = await book(s, "10:00");
    expect(a.endsAt.toISOString()).toBe(at("11:00").toISOString());
    expect(a.blockedUntil.toISOString()).toBe(at("11:15").toISOString());
    expect(a.priceSnapshot).toBe(250_000);
    await expect(book(s, "10:30")).rejects.toThrow(/өөр үйлчлүүлэгчтэй/);
    // Buffer: 11:00 давхцана, 11:15 болно
    await expect(book(s, "11:00")).rejects.toThrow(/өөр үйлчлүүлэгчтэй/);
    await expect(book(s, "11:15")).resolves.toBeTruthy();
  });

  it("two concurrent bookings for the same staff and time: exactly one succeeds", async () => {
    const s = await setup();
    const results = await Promise.allSettled([book(s, "12:00"), book(s, "12:00"), book(s, "12:15")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (const r of results) if (r.status === "rejected") expect(r.reason).toBeInstanceOf(UserError);
    expect(await db.appointment.count()).toBe(1);
  });

  it("the DB constraint is the final guard even when the server check is bypassed", async () => {
    const s = await setup();
    const a = await book(s, "10:00");
    const err = await db.appointment
      .create({
        data: { branchId: a.branchId, customerId: s.customer.id, staffId: s.staff.id, serviceId: s.service.id, startsAt: at("10:30"), endsAt: at("11:30"), blockedUntil: at("11:30") },
      })
      .catch((e) => e);
    expect(overlapError(err)?.code).toBe("APPT_OVERLAP");
  });

  it("a cancelled appointment frees the time", async () => {
    const s = await setup();
    const a = await book(s, "10:00");
    await changeStatus({ id: a.id, action: "cancel", reason: "Үйлчлүүлэгч цуцалсан" }, asManager(), NOW);
    await expect(book(s, "10:00")).resolves.toBeTruthy();
  });

  it("room overlap across different staff is rejected (server and DB)", async () => {
    const s = await setup({ requiresRoom: true });
    const other = await makeBookableStaff("Номин");
    const branch = await db.branch.findFirstOrThrow();
    const room = await db.room.create({ data: { branchId: branch.id, name: "Өрөө 1" } });
    await expect(book(s, "10:00")).rejects.toThrow(/өрөө сонгоно/);
    const a = await book(s, "10:00", { roomId: room.id });
    await expect(book(s, "10:30", { staffId: other.id, roomId: room.id })).rejects.toThrow(/өрөө энэ цагт завгүй/);
    const err = await db.appointment
      .create({
        data: { branchId: a.branchId, customerId: s.customer.id, staffId: other.id, serviceId: s.service.id, roomId: room.id, startsAt: at("10:30"), endsAt: at("11:30"), blockedUntil: at("11:30") },
      })
      .catch((e) => e);
    expect(overlapError(err)?.message).toMatch(/өрөө/);
  });

  it("time off and working hours are enforced; slots reflect them", async () => {
    const s = await setup();
    await db.staffTimeOff.create({ data: { staffId: s.staff.id, startsAt: at("13:00"), endsAt: at("15:00"), reason: "TRAINING" } });
    await expect(book(s, "13:30")).rejects.toThrow(/чөлөөтэй/);
    await expect(book(s, "18:30")).rejects.toThrow(/ажлын цагаас гадуур/);
    const { slots } = await listSlots({ serviceId: s.service.id, date: DAY }, NOW);
    const hours = slots.map((x) => x.startsAt.toISOString());
    expect(hours).toContain(at("12:00").toISOString());
    expect(hours).not.toContain(at("12:15").toISOString());
    expect(hours).toContain(at("15:00").toISOString());
  });

  it("only staff who can do the service (ServiceStaff) are accepted", async () => {
    const s = await setup();
    const other = await makeBookableStaff("Номин");
    await db.serviceStaff.create({ data: { serviceId: s.service.id, staffId: other.id } });
    await expect(book(s, "10:00")).rejects.toThrow(/энэ үйлчилгээг хийдэггүй/);
    await expect(book(s, "10:00", { staffId: other.id })).resolves.toBeTruthy();
  });

  it("stores the absolute instant (epoch) regardless of the DB server's TimeZone", async () => {
    const s = await setup();
    const a = await book(s, "10:00");
    const [row] = await db.$queryRaw<{ epoch: number }[]>`SELECT extract(epoch FROM "startsAt")::float8 AS epoch FROM "Appointment" WHERE "id" = ${a.id}`;
    expect(row!.epoch * 1000).toBe(at("10:00").getTime()); // 10:00 УБ = 02:00 UTC — 8 цагаар шилжээгүй
  });

  it("UB midnight boundary: a 00:30 UB appointment is stored on the previous UTC day", async () => {
    const s = await setup();
    await db.staffSchedule.deleteMany({ where: { staffId: s.staff.id } });
    await db.staffSchedule.create({ data: { staffId: s.staff.id, weekday: 3, startTime: "00:00", endTime: "03:00" } });
    await db.siteSetting.create({ data: { key: "booking", value: { hours: { "3": [{ start: "00:00", end: "24:00" }] } } } });
    const a = await book(s, "00:30");
    expect(a.startsAt.toISOString()).toBe("2026-12-01T16:30:00.000Z");
  });
});

describe("update / move / status", () => {
  it("move: re-checks availability, keeps the original on conflict, rejects a stale version", async () => {
    const s = await setup();
    const a = await book(s, "10:00");
    const b = await book(s, "12:00");
    await expect(moveAppointment({ id: b.id, version: b.version, startsAt: at("10:30"), staffId: s.staff.id }, asManager(), NOW)).rejects.toThrow(/өөр үйлчлүүлэгчтэй/);
    expect((await db.appointment.findUniqueOrThrow({ where: { id: b.id } })).startsAt.toISOString()).toBe(at("12:00").toISOString());
    const moved = await moveAppointment({ id: b.id, version: b.version, startsAt: at("11:00"), staffId: s.staff.id }, asManager(), NOW);
    expect(moved.version).toBe(b.version + 1);
    await expect(moveAppointment({ id: b.id, version: b.version, startsAt: at("14:00"), staffId: s.staff.id }, asManager(), NOW)).rejects.toThrow(/өөр хүн/);
    // Засварлаж буй цаг өөрийгөө завгүйд тооцохгүй (ижил цагт тэмдэглэл засах)
    await expect(
      updateAppointment({ id: a.id, version: a.version, customerId: s.customer.id, serviceId: s.service.id, staffId: s.staff.id, startsAt: at("10:00"), note: "Утсаар баталгаажсан" }, asManager(), NOW),
    ).resolves.toMatchObject({ note: "Утсаар баталгаажсан" });
    expect(await db.auditLog.count({ where: { entity: "Appointment", action: "appointment.move" } })).toBe(1);
  });

  it("status: cancel needs a reason, no-show only after start", async () => {
    const s = await setup();
    const a = await book(s, "10:00");
    await expect(changeStatus({ id: a.id, action: "cancel" }, asManager(), NOW)).rejects.toThrow(/шалтгаан/);
    await expect(changeStatus({ id: a.id, action: "noShow" }, asManager(), NOW)).rejects.toThrow(/эхлээгүй/);
    await changeStatus({ id: a.id, action: "noShow" }, asManager(), at("10:05"));
    expect((await db.appointment.findUniqueOrThrow({ where: { id: a.id } })).status).toBe("NO_SHOW");
    await expect(book(s, "10:00")).resolves.toBeTruthy(); // NO_SHOW чөлөөлнө
  });

  it("manual DONE: ADMIN only, only ARRIVED/IN_PROGRESS, only after the start time, reason required", async () => {
    const s = await setup();
    const a = await book(s, "10:00");
    const asAdmin = { id: admin.id, role: "ADMIN" as const };
    await expect(changeStatus({ id: a.id, action: "complete", reason: "x" }, asManager(), at("10:30"))).rejects.toThrow(/админ/);
    await expect(changeStatus({ id: a.id, action: "complete", reason: "x" }, asAdmin, at("10:30"))).rejects.toThrow(/ирсэн/); // BOOKED
    await changeStatus({ id: a.id, action: "arrive" }, asManager(), at("09:50"));
    await expect(changeStatus({ id: a.id, action: "complete", reason: "x" }, asAdmin, at("09:55"))).rejects.toThrow(/эхлээгүй/);
    await expect(changeStatus({ id: a.id, action: "complete" }, asAdmin, at("10:30"))).rejects.toThrow(/шалтгаан/);
    await changeStatus({ id: a.id, action: "complete", reason: "POS-гүй үйлчилгээ" }, asAdmin, at("10:30"));
    expect((await db.appointment.findUniqueOrThrow({ where: { id: a.id } })).status).toBe("DONE");
  });

  it("arrive / open in POS only on the appointment day (UB)", async () => {
    const s = await setup();
    const a = await book(s, "10:00");
    await expect(changeStatus({ id: a.id, action: "arrive" }, asManager(), NOW)).rejects.toThrow(/Зөвхөн цагийн өдөр/);
    await expect(openInPos(a.id, asManager(), NOW)).rejects.toThrow(/Зөвхөн цагийн өдөр/);
    // УБ-ийн өдрийн хил: 2026-12-01T16:00Z = 12/02 00:00 УБ (ижил өдөр), 15:59Z = 12/01 (өмнөх өдөр)
    await expect(openInPos(a.id, asManager(), new Date("2026-12-01T15:59:00Z"))).rejects.toThrow(/Зөвхөн цагийн өдөр/);
    await expect(openInPos(a.id, asManager(), new Date("2026-12-01T16:00:00Z"))).resolves.toMatchObject({ created: true });
    expect(await db.sale.count({ where: { appointmentId: a.id } })).toBe(1);
  });

  it("arrived or with an active sale: cannot move / change staff — only the note", async () => {
    const s = await setup();
    const other = await makeBookableStaff("Номин");
    const a = await book(s, "10:00");
    await openInPos(a.id, asManager(), at("09:00"));
    const arrived = await db.appointment.findUniqueOrThrow({ where: { id: a.id } });
    expect(arrived.status).toBe("ARRIVED");
    await expect(moveAppointment({ id: a.id, version: arrived.version, startsAt: at("12:00"), staffId: s.staff.id }, asManager(), NOW)).rejects.toThrow(
      "Ирсэн цагийг зөөх боломжгүй, POS-оос засна.",
    );
    await expect(
      updateAppointment({ id: a.id, version: arrived.version, customerId: s.customer.id, serviceId: s.service.id, staffId: other.id, startsAt: at("10:00") }, asManager(), NOW),
    ).rejects.toThrow(/POS-оос засна/);
    await expect(updateApptNote({ id: a.id, note: "Харшилтай" }, asManager())).resolves.toMatchObject({ note: "Харшилтай", startsAt: at("10:00") });

    // BOOKED боловч идэвхтэй ноорогтой (жишээ нь гараар холбосон) — мөн хориглоно
    const b = await book(s, "14:00");
    const branch = await db.branch.findFirstOrThrow();
    await db.sale.create({ data: { branchId: branch.id, createdById: manager.id, appointmentId: b.id } });
    await expect(moveAppointment({ id: b.id, version: b.version, startsAt: at("15:00"), staffId: s.staff.id }, asManager(), NOW)).rejects.toThrow(/POS-оос засна/);
    expect((await db.appointment.findUniqueOrThrow({ where: { id: b.id } })).startsAt.toISOString()).toBe(at("14:00").toISOString());
  });
});

describe("POS link", () => {
  it("open in POS → ARRIVED + draft with service/staff; opening again reuses it; PAID → DONE (idempotent)", async () => {
    const s = await setup();
    const a = await book(s, "10:00");
    const first = await openInPos(a.id, asManager(), at("09:30"));
    const again = await openInPos(a.id, asManager(), at("09:40"));
    expect(again.saleId).toBe(first.saleId);
    expect((await db.appointment.findUniqueOrThrow({ where: { id: a.id } })).status).toBe("ARRIVED");
    const draft = await db.sale.findUniqueOrThrow({ where: { id: first.saleId } });
    expect(draft.appointmentId).toBe(a.id);
    const data = draft.draftData as { lines: { refId: string; staffId: string }[]; customer: { id: string }; appointmentId: string };
    expect(data.lines[0]).toMatchObject({ refId: s.service.id, staffId: s.staff.id });
    expect(data.customer.id).toBe(s.customer.id);

    const locked = await checkout(
      { saleId: first.saleId, customerId: s.customer.id, items: [{ kind: "SERVICE", serviceId: s.service.id, staffId: s.staff.id, qty: 1 }] },
      asManager(),
    );
    expect((await db.sale.findUniqueOrThrow({ where: { id: locked.saleId } })).appointmentId).toBe(a.id); // cart-д ирээгүй ч хадгалагдана
    await createPayment({ saleId: locked.saleId, method: "CARD", amount: locked.total, approvalCode: "AB12", idempotencyKey: crypto.randomUUID() }, asManager());
    expect((await db.appointment.findUniqueOrThrow({ where: { id: a.id } })).status).toBe("DONE");
    // Дахин (зэрэг) дуудахад өөрчлөгдөхгүй
    await Promise.all([1, 2, 3].map(() => db.$transaction((tx) => applyPayment(tx, locked.saleId, manager.id))));
    expect(await db.auditLog.count({ where: { entityId: a.id, action: "appointment.complete" } })).toBe(1);
  });

  it("DB allows only one active sale per appointment: concurrent drafts and draft-while-partially-paid both fail", async () => {
    const s = await setup();
    const a = await book(s, "10:00");
    const branch = await db.branch.findFirstOrThrow();
    const draft = () => db.sale.create({ data: { branchId: branch.id, createdById: manager.id, appointmentId: a.id } });
    const both = await Promise.allSettled([draft(), draft()]);
    expect(both.filter((r) => r.status === "fulfilled")).toHaveLength(1);

    const [ok] = both.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<{ id: string }>[];
    await db.sale.update({ where: { id: ok!.value.id }, data: { status: "PARTIALLY_PAID", number: "CL-TEST-0001" } });
    await expect(draft()).rejects.toThrow();
    // Цуцлагдсан/төлсөн бол шинэ ноорог болно
    await db.sale.update({ where: { id: ok!.value.id }, data: { status: "CANCELLED" } });
    await expect(draft()).resolves.toBeTruthy();
  });
});
