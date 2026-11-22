/**
 * Боломжтой цаг тооцоход хэрэгтэй өгөгдлийг DB-ээс бэлдэнэ (availability.ts цэвэр хэвээр).
 */
import type { Prisma } from "@/generated/prisma/client";
import { addDays, ubDayRange } from "@/lib/time";
import { db } from "@/server/db";
import { UserError } from "@/server/errors";
import { getBookingSettings } from "@/server/modules/settings/pos-settings";
import { eligibleStaffIds, type AvailabilityRoom, type AvailabilityStaff, type HmInterval } from "./availability";

type Client = Prisma.TransactionClient | typeof db;

/** Давхцлын constraint-д тооцогдох төлөвүүд */
export const BLOCKING: Prisma.AppointmentWhereInput["status"] = { notIn: ["CANCELLED", "NO_SHOW"] };

export async function bookableStaff(client: Client = db) {
  return client.user.findMany({
    where: { isActive: true, isBookable: true },
    orderBy: [{ role: "desc" }, { name: "asc" }],
    select: { id: true, name: true, role: true },
  });
}

/** Үйлчилгээг хийж чадах bookable ажилтнууд (ServiceStaff хоосон бол бүгд) */
export async function staffForService(client: Client, serviceId: string) {
  const [staff, links] = await Promise.all([bookableStaff(client), client.serviceStaff.findMany({ where: { serviceId }, select: { staffId: true } })]);
  const ids = eligibleStaffIds(
    staff.map((s) => s.id),
    links.map((l) => l.staffId),
  );
  return staff.filter((s) => ids.includes(s.id));
}

export async function bookableService(client: Client, serviceId: string) {
  const service = await client.service.findUnique({
    where: { id: serviceId },
    select: { id: true, name: true, price: true, durationMin: true, bufferMin: true, requiresRoom: true, bookable: true, isActive: true },
  });
  if (!service || !service.isActive || !service.bookable) throw new UserError("Энэ үйлчилгээг цагаар захиалах боломжгүй.");
  return service;
}

/**
 * [from, to) хугацааны availability-ийн өгөгдөл: ажилтнууд (хуваарь, чөлөө, цагууд), өрөөнүүд, тохиргоо.
 * excludeId — засварлаж буй цагийг завгүйд тооцохгүй.
 */
export async function availabilityData(
  client: Client,
  opts: { serviceId: string; fromDate: string; toDate: string; excludeId?: string | null; staffIds?: string[] },
) {
  const service = await bookableService(client, opts.serviceId);
  const settings = await getBookingSettings(client);
  let staff = await staffForService(client, opts.serviceId);
  if (opts.staffIds) staff = staff.filter((s) => opts.staffIds!.includes(s.id));
  const start = ubDayRange(opts.fromDate).start;
  const end = ubDayRange(addDays(opts.toDate, 0)).end;
  const staffIds = staff.map((s) => s.id);
  const exclude = opts.excludeId ? { id: { not: opts.excludeId } } : {};

  const [schedules, timeOffs, appts, rooms] = await Promise.all([
    client.staffSchedule.findMany({ where: { staffId: { in: staffIds } } }),
    client.staffTimeOff.findMany({ where: { staffId: { in: staffIds }, startsAt: { lt: end }, endsAt: { gt: start } } }),
    client.appointment.findMany({
      where: { ...exclude, status: BLOCKING, startsAt: { lt: end }, blockedUntil: { gt: start }, OR: [{ staffId: { in: staffIds } }, { roomId: { not: null } }] },
      select: { staffId: true, roomId: true, startsAt: true, blockedUntil: true },
    }),
    client.room.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);

  const availabilityStaff: AvailabilityStaff[] = staff.map((s) => ({
    id: s.id,
    schedule: schedules.filter((x) => x.staffId === s.id),
    timeOff: timeOffs.filter((x) => x.staffId === s.id),
    busy: appts.filter((a) => a.staffId === s.id),
  }));
  const availabilityRooms: AvailabilityRoom[] = rooms.map((r) => ({ id: r.id, busy: appts.filter((a) => a.roomId === r.id) }));
  const hoursFor = (weekday: number): HmInterval[] => settings.hours[String(weekday) as "0"] ?? [];

  return { service, settings, staff, availabilityStaff, rooms, availabilityRooms, hoursFor };
}
