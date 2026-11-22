/**
 * ADMIN: ажилтны хуваарь, чөлөө, хийж чадах үйлчилгээ, isBookable, өрөө, салбарын ажлын цаг.
 */
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { ubAt, addDays } from "@/lib/time";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { UserError } from "@/server/errors";
import { getCurrentBranch } from "@/server/modules/branches/service";
import { bookingSettingsSchema } from "@/server/modules/settings/schema";
import { BLOCKING } from "./repo";
import { bookingHoursSchema, roomSchema, scheduleSchema, timeOffSchema } from "./schema";

/** 7 хоногийн хуваарийг бүхэлд нь солино */
export async function saveSchedule(raw: z.input<typeof scheduleSchema>, actorId: string) {
  const data = scheduleSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: data.staffId }, select: { id: true } });
    if (!user) throw new UserError("Ажилтан олдсонгүй.");
    const before = await tx.staffSchedule.findMany({ where: { staffId: data.staffId }, select: { weekday: true, startTime: true, endTime: true } });
    await tx.staffSchedule.deleteMany({ where: { staffId: data.staffId } });
    await tx.staffSchedule.createMany({ data: data.intervals.map((i) => ({ staffId: data.staffId, ...i })) });
    await audit(tx, { userId: actorId, action: "staff.schedule", entity: "User", entityId: data.staffId, before, after: data.intervals });
  });
}

/** Чөлөөтэй давхцах ирээдүйн идэвхтэй цагууд (автоматаар цуцлахгүй — ресепшн шийднэ) */
export async function overlappingAppointments(staffId: string, startsAt: Date, endsAt: Date) {
  return db.appointment.findMany({
    where: { staffId, status: BLOCKING, startsAt: { lt: endsAt }, blockedUntil: { gt: startsAt } },
    orderBy: { startsAt: "asc" },
    select: { id: true, startsAt: true, endsAt: true, status: true, customer: { select: { name: true } }, service: { select: { name: true } } },
  });
}

function timeOffRange(d: z.output<typeof timeOffSchema>) {
  const startsAt = ubAt(d.from, d.fromTime ?? "00:00");
  const endsAt = d.toTime ? ubAt(d.to, d.toTime) : ubAt(addDays(d.to, 1), "00:00");
  if (endsAt <= startsAt) throw new UserError("Дуусах хугацаа эхлэхээс хойш байх ёстой.", { toTime: ["Хугацаа буруу."] });
  return { startsAt, endsAt };
}

/** Чөлөө нэмэх. Давхцсан цагуудыг буцаана (анхааруулга) — цуцлахгүй. */
export async function addTimeOff(raw: z.input<typeof timeOffSchema>, actorId: string) {
  const d = timeOffSchema.parse(raw);
  const { startsAt, endsAt } = timeOffRange(d);
  const off = await db.$transaction(async (tx) => {
    const created = await tx.staffTimeOff.create({ data: { staffId: d.staffId, startsAt, endsAt, reason: d.reason, note: d.note ?? null, createdById: actorId } });
    await audit(tx, { userId: actorId, action: "staff.time_off", entity: "User", entityId: d.staffId, after: { startsAt, endsAt, reason: d.reason } });
    return created;
  });
  return { timeOff: off, conflicts: await overlappingAppointments(d.staffId, startsAt, endsAt) };
}

export async function deleteTimeOff(id: string, actorId: string) {
  return db.$transaction(async (tx) => {
    const off = await tx.staffTimeOff.findUnique({ where: { id } });
    if (!off) throw new UserError("Чөлөө олдсонгүй.");
    await tx.staffTimeOff.delete({ where: { id } });
    await audit(tx, { userId: actorId, action: "staff.time_off_delete", entity: "User", entityId: off.staffId, before: { startsAt: off.startsAt, endsAt: off.endsAt } });
  });
}

/** Ажилтны хийж чадах үйлчилгээ + календарьт сонгогдох эсэх */
export async function saveStaffServices(raw: { staffId: string; serviceIds: string[]; isBookable: boolean }, actorId: string) {
  const data = z.object({ staffId: z.string().min(1), serviceIds: z.array(z.string().min(1)).max(200), isBookable: z.boolean() }).parse(raw);
  return db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: data.staffId }, data: { isBookable: data.isBookable } });
    await tx.serviceStaff.deleteMany({ where: { staffId: data.staffId } });
    if (data.serviceIds.length) await tx.serviceStaff.createMany({ data: data.serviceIds.map((serviceId) => ({ serviceId, staffId: data.staffId })) });
    await audit(tx, { userId: actorId, action: "staff.services", entity: "User", entityId: data.staffId, after: data });
  });
}

export async function saveRoom(raw: z.input<typeof roomSchema>, actorId: string) {
  const d = roomSchema.parse(raw);
  const branch = await getCurrentBranch();
  return db.$transaction(async (tx) => {
    const room = d.id
      ? await tx.room.update({ where: { id: d.id }, data: { name: d.name, isActive: d.isActive, sortOrder: d.sortOrder } })
      : await tx.room.create({ data: { branchId: branch.id, name: d.name, isActive: d.isActive, sortOrder: d.sortOrder } });
    await audit(tx, { userId: actorId, action: d.id ? "room.update" : "room.create", entity: "Room", entityId: room.id, after: d });
    return room;
  });
}

export async function deleteRoom(id: string, actorId: string) {
  try {
    return await db.$transaction(async (tx) => {
      await tx.room.delete({ where: { id } });
      await audit(tx, { userId: actorId, action: "room.delete", entity: "Room", entityId: id });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      throw new UserError("Энэ өрөөнд цаг бүртгэгдсэн тул устгах боломжгүй — идэвхгүй болгоно уу.");
    }
    throw e;
  }
}

/** Салбарын ажлын цаг ба календарийн тохиргоо (SiteSetting "booking") */
export async function saveBookingHours(raw: z.input<typeof bookingHoursSchema>, actorId: string) {
  const input = bookingHoursSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const row = await tx.siteSetting.findUnique({ where: { key: "booking" } });
    const current = bookingSettingsSchema.parse(row?.value ?? {});
    const next = bookingSettingsSchema.parse({ ...current, ...input });
    if (next.slotMinutes !== input.slotMinutes) throw new UserError("Алхам 5, 10, 15, 20, 30, 60 минутын аль нэг байна.", { slotMinutes: ["Буруу утга."] });
    for (const [day, list] of Object.entries(input.hours)) {
      for (const i of list ?? []) if (i.start >= i.end) throw new UserError("Дуусах цаг эхлэхээс хойш байх ёстой.", { [`hours.${day}`]: ["Буруу интервал."] });
    }
    await tx.siteSetting.upsert({ where: { key: "booking" }, create: { key: "booking", value: next }, update: { value: next } });
    await audit(tx, { userId: actorId, action: "settings.booking", entity: "SiteSetting", entityId: "booking", before: row?.value, after: next });
    return next;
  });
}
