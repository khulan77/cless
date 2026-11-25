/**
 * Сайтын нэвтрэлт + онлайн захиалга (PROMPT 15 §3–4): утсаар код → (шинэ бол профайл) → захиалга PENDING →
 * ресепшн батлах/татгалзах → SMS; цагийг түр барина; 3 захиалгын хязгаар; ирээгүй 2+; цуцлах эрх; сануулга давхардахгүй.
 */
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ubAt } from "@/lib/time";
import { db } from "@/server/db";
import { changeStatus } from "@/server/modules/appointments/service";
import { completeCustomerProfile, requestCustomerCode, verifyCustomerCode } from "@/server/modules/customer-auth/login";
import { makeBookableStaff, makeService, makeUser, resetDb } from "../../../../tests/db-helpers";
import { bookOnline, cancelMine, myAppointments, onlineSlots } from "./service";

const DAY = "2026-12-02"; // Лхагва; салбар 10–20, ажилтан 10–19
const NOW = new Date("2026-11-30T00:00:00Z");
const at = (hm: string, d = DAY) => ubAt(d, hm);

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "cless-online-"));
  process.env.EMAIL_FILE_DIR = dir;
  delete process.env.WESEND_API_KEY;
});
afterAll(async () => {
  delete process.env.EMAIL_FILE_DIR;
  await rm(dir, { recursive: true, force: true });
});

let manager: Awaited<ReturnType<typeof makeUser>>;
beforeEach(async () => {
  await resetDb();
  manager = await makeUser("MANAGER");
  await db.siteSetting.create({
    data: { key: "online-booking", value: { enabled: true, mode: "APPROVAL", minLeadHours: 2, maxDaysAhead: 60, cancelHours: 24, allServices: true, serviceIds: [], firstVisitServiceId: null } },
  });
});

async function setup() {
  const staff = await makeBookableStaff("Сараа");
  const service = await makeService({ price: 250_000, durationMin: 60 });
  return { staff, service };
}

async function login(phone: string, name = "Онлайн Үйлчлүүлэгч") {
  const r = await requestCustomerCode({ to: phone, ip: "9.9.9.9" });
  const v = await verifyCustomerCode({ id: r.id, to: phone, code: r.devCode! });
  if (v.status === "signed-in") return v.customerId;
  return (await completeCustomerProfile({ verificationId: v.verificationId, to: phone, name, consent: true })).customerId;
}

describe("үйлчлүүлэгчийн нэвтрэлт", () => {
  it("шинэ утас → нэр + зөвшөөрөл → ONLINE бүртгэл; дахин нэвтрэхэд шууд", async () => {
    const id = await login("99887766");
    expect(await db.customer.findUniqueOrThrow({ where: { id } })).toMatchObject({ phone: "99887766", registeredVia: "ONLINE", dataConsentAt: expect.any(Date) });
    // 1 минутын хязгаарыг тойрох (дахин нэвтрэлт өөр үед)
    await db.verification.updateMany({ data: { createdAt: new Date(Date.now() - 2 * 60_000) } });
    expect(await login("+976 9988-7766")).toBe(id);
    expect(await db.customer.count()).toBe(1);
  });

  it("ресепшн бүртгэсэн үйлчлүүлэгч → шинэ мөр үүсгэхгүй, нэгтгэнэ (түүх хадгалагдана)", async () => {
    const c = await db.customer.create({ data: { name: "Ресепшн бүртгэсэн", phone: "99001111" } });
    const id = await login(c.phone, "Өөр нэр");
    expect(id).toBe(c.id);
    const after = await db.customer.findUniqueOrThrow({ where: { id } });
    expect(after).toMatchObject({ name: c.name, registeredVia: "ADMIN", onlineRegisteredAt: expect.any(Date) });
    expect(await db.customer.count()).toBe(1);
  });

  it("баталгаажуулалтыг профайлд 2 удаа ашиглахгүй; зөвшөөрөлгүй бол үүсгэхгүй", async () => {
    const r = await requestCustomerCode({ to: "88776655", ip: "9.9.9.9" });
    const v = await verifyCustomerCode({ id: r.id, to: "88776655", code: r.devCode! });
    if (v.status !== "needs-profile") throw new Error("expected profile");
    await expect(completeCustomerProfile({ verificationId: v.verificationId, to: "88776655", name: "Нэр Нэр", consent: false as true })).rejects.toThrow();
    await completeCustomerProfile({ verificationId: v.verificationId, to: "88776655", name: "Нэр Нэр", consent: true });
    await expect(completeCustomerProfile({ verificationId: v.verificationId, to: "88776655", name: "Нэр Нэр", consent: true })).rejects.toThrow(/хугацаа дууссан|ашиглагдсан/);
  });
});

describe("онлайн захиалга", () => {
  it("PENDING → цаг баригдана → ресепшн батлах → SMS; татгалзах → шалтгаантай SMS", async () => {
    const s = await setup();
    const cid = await login("99112244");
    const slots = await onlineSlots({ serviceId: s.service.id, date: DAY }, NOW);
    expect(slots[0]!.startsAt).toBe(at("10:00").toISOString());
    const a = await bookOnline({ customerId: cid, serviceId: s.service.id, staffId: null, startsAt: at("10:00").toISOString(), note: "Анх удаа" }, NOW);
    expect(a).toMatchObject({ status: "PENDING", source: "ONLINE", staffId: s.staff.id, createdById: null });
    // Цаг түр баригдсан — дахин санал болгохгүй
    expect((await onlineSlots({ serviceId: s.service.id, date: DAY }, NOW)).some((x) => x.startsAt === at("10:00").toISOString())).toBe(false);
    expect(await db.outboxJob.findFirst({ where: { type: "SMS", dedupeKey: { startsWith: `appt-sms:${a.id}:created` } } })).not.toBeNull();
    // "баталгаажлаа" имэйл PENDING үед явахгүй
    expect(await db.outboxJob.count({ where: { type: "APPT_EMAIL" } })).toBe(0);

    await changeStatus({ id: a.id, action: "approve" }, { id: manager.id, role: "MANAGER" }, NOW);
    expect((await db.appointment.findUniqueOrThrow({ where: { id: a.id } })).status).toBe("CONFIRMED");
    expect(await db.outboxJob.findFirst({ where: { type: "SMS", dedupeKey: { startsWith: `appt-sms:${a.id}:approved` } } })).not.toBeNull();

    const b = await bookOnline({ customerId: cid, serviceId: s.service.id, staffId: s.staff.id, startsAt: at("12:00").toISOString() }, NOW);
    await expect(changeStatus({ id: b.id, action: "reject" }, { id: manager.id, role: "MANAGER" }, NOW)).rejects.toThrow(/шалтгаан/);
    await changeStatus({ id: b.id, action: "reject", reason: "Гоо сайханч чөлөөтэй" }, { id: manager.id, role: "MANAGER" }, NOW);
    expect(await db.appointment.findUniqueOrThrow({ where: { id: b.id } })).toMatchObject({ status: "CANCELLED", cancelCategory: "REJECTED", cancelReason: "Гоо сайханч чөлөөтэй" });
  });

  it("сануулга давхардахгүй: нэг цагт нэг л APPT_REMINDER", async () => {
    const s = await setup();
    const cid = await login("99112255");
    const a = await bookOnline({ customerId: cid, serviceId: s.service.id, staffId: null, startsAt: at("11:00").toISOString() }, NOW);
    await changeStatus({ id: a.id, action: "approve" }, { id: manager.id, role: "MANAGER" }, NOW);
    expect(await db.outboxJob.count({ where: { type: "APPT_REMINDER", dedupeKey: `appt-reminder:${a.id}:${at("11:00").toISOString()}` } })).toBe(1);
  });

  it("хугацааны хүрээ, 3 ирээдүйн захиалга, ирээгүй 2+ → хаагдана, менежер нээнэ", async () => {
    const s = await setup();
    const cid = await login("99112266");
    await expect(bookOnline({ customerId: cid, serviceId: s.service.id, staffId: null, startsAt: new Date(NOW.getTime() + 3_600_000).toISOString() }, NOW)).rejects.toThrow(/2 цагийн өмнө/);
    for (const hm of ["10:00", "12:00", "14:00"]) await bookOnline({ customerId: cid, serviceId: s.service.id, staffId: null, startsAt: at(hm).toISOString() }, NOW);
    await expect(bookOnline({ customerId: cid, serviceId: s.service.id, staffId: null, startsAt: at("16:00").toISOString() }, NOW)).rejects.toThrow(/хамгийн ихдээ 3/);

    await db.appointment.updateMany({ where: { customerId: cid }, data: { status: "NO_SHOW" } });
    await expect(bookOnline({ customerId: cid, serviceId: s.service.id, staffId: null, startsAt: at("16:00").toISOString() }, NOW)).rejects.toThrow(/түр хаагдсан/);
    await db.customer.update({ where: { id: cid }, data: { onlineUnblockedAt: new Date(at("18:00").getTime()) } });
    await expect(bookOnline({ customerId: cid, serviceId: s.service.id, staffId: null, startsAt: at("16:00").toISOString() }, NOW)).resolves.toBeTruthy();
  });

  it("цуцлах эрх: 24 цагаас өмнө — болно; дараа — үгүй; өөр хүний цагийг үгүй", async () => {
    const s = await setup();
    const cid = await login("99112277");
    const other = await login("99112288");
    const a = await bookOnline({ customerId: cid, serviceId: s.service.id, staffId: null, startsAt: at("10:00").toISOString() }, NOW);
    await expect(cancelMine(other, a.id, NOW)).rejects.toThrow(/олдсонгүй/);
    await expect(cancelMine(cid, a.id, new Date(at("10:00").getTime() - 23 * 3_600_000))).rejects.toThrow(/24 цагийн өмнө/);
    await cancelMine(cid, a.id, NOW);
    expect(await db.appointment.findUniqueOrThrow({ where: { id: a.id } })).toMatchObject({ status: "CANCELLED", cancelCategory: "ONLINE" });
    const mine = await myAppointments(cid, NOW);
    expect(mine.upcoming).toHaveLength(0);
    expect(mine.past[0]!.status).toBe("CANCELLED");
  });

  it("анхны үйлчлүүлэгч: оношлогоо заавал (тохиргоогоор)", async () => {
    const s = await setup();
    const diag = await makeService({ price: 50_000, durationMin: 30, name: "Skin Instant©" });
    await db.siteSetting.update({ where: { key: "online-booking" }, data: { value: { enabled: true, mode: "INSTANT", minLeadHours: 2, maxDaysAhead: 60, cancelHours: 24, allServices: true, serviceIds: [], firstVisitServiceId: diag.id } } });
    const cid = await login("99112299");
    await expect(bookOnline({ customerId: cid, serviceId: s.service.id, staffId: null, startsAt: at("10:00").toISOString() }, NOW)).rejects.toThrow(/Skin Instant/);
    const a = await bookOnline({ customerId: cid, serviceId: diag.id, staffId: null, startsAt: at("10:00").toISOString() }, NOW);
    expect(a.status).toBe("CONFIRMED"); // INSTANT горим
  });

  it("унтраалттай бол захиалахгүй", async () => {
    const s = await setup();
    const cid = await login("99112200");
    await db.siteSetting.update({ where: { key: "online-booking" }, data: { value: { enabled: false } } });
    await expect(bookOnline({ customerId: cid, serviceId: s.service.id, staffId: null, startsAt: at("10:00").toISOString() }, NOW)).rejects.toThrow(/хаалттай/);
  });
});
