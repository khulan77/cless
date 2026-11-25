/**
 * Онлайн цаг захиалга (PROMPT 15 §4): үйлчилгээ → гоо сайханч ("Хэн ч болно") → огноо, сул цаг
 * (findSlots — УБ цаг, өрөө, buffer) → нэвтрэх → тэмдэглэл → баталгаажуулах.
 * Хамгаалалт: хугацааны хүрээ, 3 ирээдүйн захиалга, 2+ ирээгүй бол хаагдана, анхны үйлчлүүлэгчид оношлогоо.
 */
import { addDays, ubDateKey } from "@/lib/time";
import { db } from "@/server/db";
import { UserError } from "@/server/errors";
import { cancelByCustomer, createOnlineAppointment, OVERLAP, searchFreeSlots } from "@/server/modules/appointments/service";
import { staffForService } from "@/server/modules/appointments/repo";
import { blockedByNoShows, bookingWindowProblem, canCustomerCancel, RULE_MESSAGES as R, tooManyFuture } from "./rules";
import { getOnlineBookingSettings, type OnlineBookingSettings } from "./settings";

const FUTURE = ["PENDING", "BOOKED", "CONFIRMED"] as const;

export async function onlineServices(settings?: OnlineBookingSettings) {
  const s = settings ?? (await getOnlineBookingSettings());
  return db.service.findMany({
    where: { isActive: true, bookable: true, isPublic: true, ...(s.allServices ? {} : { id: { in: s.serviceIds } }) },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, slug: true, name: true, category: true, price: true, priceFrom: true, durationMin: true, shortDescription: true },
  });
}

async function assertServiceAllowed(serviceId: string, s: OnlineBookingSettings) {
  if (!s.enabled) throw new UserError(R.disabled);
  const svc = (await onlineServices(s)).find((x) => x.id === serviceId);
  if (!svc) throw new UserError(R.serviceNotAllowed);
  return svc;
}

export async function onlineStaff(serviceId: string) {
  const s = await getOnlineBookingSettings();
  await assertServiceAllowed(serviceId, s);
  return (await staffForService(db, serviceId)).map((u) => ({ id: u.id, name: u.name }));
}

/** Тухайн өдрийн сул цагууд: "Хэн ч болно" бол цаг бүрт боломжтой ажилтнууд */
export async function onlineSlots(p: { serviceId: string; staffId?: string | null; date: string }, now = new Date()) {
  const s = await getOnlineBookingSettings();
  await assertServiceAllowed(p.serviceId, s);
  const r = await searchFreeSlots({ serviceId: p.serviceId, staffId: p.staffId ?? null, from: p.date, days: 1 }, now);
  const byTime = new Map<string, { startsAt: string; staffIds: string[] }>();
  for (const slot of r.days[0]?.slots ?? []) {
    if (bookingWindowProblem(slot.startsAt, now, s)) continue;
    const k = slot.startsAt.toISOString();
    const e = byTime.get(k) ?? { startsAt: k, staffIds: [] };
    e.staffIds.push(slot.staffId);
    byTime.set(k, e);
  }
  return [...byTime.values()];
}

/** Захиалах боломжтой огноонууд (minLead … maxDaysAhead) */
export async function bookingDates(now = new Date()) {
  const s = await getOnlineBookingSettings();
  const first = ubDateKey(new Date(now.getTime() + s.minLeadHours * 3_600_000));
  return Array.from({ length: s.maxDaysAhead + 1 }, (_, i) => addDays(first, i)).filter((d) => d <= ubDateKey(new Date(now.getTime() + s.maxDaysAhead * 86_400_000)));
}

/** Онлайн захиалга хаагдсан эсэх (2+ ирээгүй, менежер нээсний дараахыг л тоолно) */
export async function onlineBlocked(customerId: string) {
  const c = await db.customer.findUniqueOrThrow({ where: { id: customerId }, select: { onlineUnblockedAt: true } });
  const noShows = await db.appointment.count({ where: { customerId, status: "NO_SHOW", ...(c.onlineUnblockedAt ? { startsAt: { gt: c.onlineUnblockedAt } } : {}) } });
  return blockedByNoShows(noShows);
}

export async function bookOnline(p: { customerId: string; serviceId: string; staffId: string | null; startsAt: string; note?: string | null }, now = new Date()) {
  const s = await getOnlineBookingSettings();
  await assertServiceAllowed(p.serviceId, s);
  const startsAt = new Date(p.startsAt);
  if (Number.isNaN(startsAt.getTime())) throw new UserError("Цаг буруу байна.");
  const w = bookingWindowProblem(startsAt, now, s);
  if (w === "TOO_SOON") throw new UserError(R.TOO_SOON(s.minLeadHours));
  if (w === "TOO_FAR") throw new UserError(R.TOO_FAR(s.maxDaysAhead));
  if (await onlineBlocked(p.customerId)) throw new UserError(R.blocked, undefined, "ONLINE_BLOCKED");
  const future = await db.appointment.count({ where: { customerId: p.customerId, status: { in: [...FUTURE] }, startsAt: { gt: now } } });
  if (tooManyFuture(future)) throw new UserError(R.tooMany, undefined, "TOO_MANY_BOOKINGS");
  // Анхны үйлчлүүлэгч: оношлогоо (Skin Instant©) заавал
  if (s.firstVisitServiceId && p.serviceId !== s.firstVisitServiceId) {
    const visited = await db.appointment.count({ where: { customerId: p.customerId, status: "DONE" } });
    const sold = await db.sale.count({ where: { customerId: p.customerId, status: { in: ["PAID", "PARTIALLY_REFUNDED"] } } });
    if (visited + sold === 0) {
      const diag = await db.service.findUnique({ where: { id: s.firstVisitServiceId }, select: { name: true } });
      throw new UserError(R.firstVisit(diag?.name ?? "Оношлогоо"), undefined, "FIRST_VISIT_DIAGNOSIS");
    }
  }
  // Ажилтан: сонгосон, эсвэл тухайн цагт сул эхний ажилтан
  const slots = await onlineSlots({ serviceId: p.serviceId, staffId: p.staffId, date: ubDateKey(startsAt) }, now);
  const slot = slots.find((x) => x.startsAt === startsAt.toISOString());
  if (!slot) throw new UserError(R.slotTaken, undefined, OVERLAP);
  const staffId = p.staffId ?? slot.staffIds[0]!;
  return createOnlineAppointment(
    { customerId: p.customerId, serviceId: p.serviceId, staffId, startsAt, note: p.note?.trim() || null, status: s.mode === "INSTANT" ? "CONFIRMED" : "PENDING" },
    now,
  );
}

export async function myAppointments(customerId: string, now = new Date()) {
  const s = await getOnlineBookingSettings();
  const rows = await db.appointment.findMany({
    where: { customerId },
    orderBy: { startsAt: "desc" },
    take: 100,
    select: { id: true, startsAt: true, endsAt: true, status: true, source: true, cancelReason: true, service: { select: { name: true } }, staff: { select: { name: true } } },
  });
  const upcoming = rows.filter((a) => a.startsAt > now && FUTURE.includes(a.status as (typeof FUTURE)[number])).reverse();
  const past = rows.filter((a) => !upcoming.includes(a));
  return { upcoming: upcoming.map((a) => ({ ...a, canCancel: canCustomerCancel(a.startsAt, now, s.cancelHours) })), past, cancelHours: s.cancelHours };
}

export async function cancelMine(customerId: string, appointmentId: string, now = new Date()) {
  const s = await getOnlineBookingSettings();
  const a = await db.appointment.findUnique({ where: { id: appointmentId }, select: { customerId: true, startsAt: true } });
  if (!a || a.customerId !== customerId) throw new UserError(R.notFound);
  if (!canCustomerCancel(a.startsAt, now, s.cancelHours)) throw new UserError(R.cancelLate(s.cancelHours));
  return cancelByCustomer(appointmentId, customerId, now);
}
