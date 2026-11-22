/**
 * Боломжтой цаг тооцох — ЦЭВЭР функц (DB-гүй, цаг нь `now` параметрээр). repo.ts өгөгдлийг бэлдэнэ.
 *
 * Ажилтан бүрийн хувьд тухайн өдөр:
 *   ажлын интервал (StaffSchedule ∩ салбарын ажлын цаг)
 *   − StaffTimeOff − идэвхтэй цагуудын [startsAt, blockedUntil) − (одоо + minLead)-ээс өмнөх
 * → slotMinutes алхмаар (УБ-ийн шөнө дундаас) эхлэх цэгүүд; [start, start+duration+buffer) бүхэлдээ багтана.
 * requiresRoom бөгөөд идэвхтэй өрөө байвал тухайн хугацаанд сул өрөө заавал.
 */
import { ubAt, ubDateKey, ubWeekday } from "@/lib/time";

/** [start, end) — epoch ms */
export type Interval = { start: number; end: number };
export type HmInterval = { start: string; end: string };
export type Busy = { startsAt: Date; blockedUntil: Date };

export type AvailabilityStaff = {
  id: string;
  /** Бүх гаригийн интервалууд (weekday 0 = Ням) */
  schedule: { weekday: number; startTime: string; endTime: string }[];
  timeOff: { startsAt: Date; endsAt: Date }[];
  busy: Busy[];
};
export type AvailabilityRoom = { id: string; busy: Busy[] };
export type AvailabilityService = { durationMin: number; bufferMin: number; requiresRoom: boolean };

export type AvailabilityInput = {
  date: string;
  now: Date;
  service: AvailabilityService;
  /** Үйлчилгээг хийж чадах, bookable ажилтнууд (eligibleStaff) */
  staff: AvailabilityStaff[];
  /** Идэвхтэй өрөөнүүд (sortOrder дарааллаар). Хоосон = өрөөний логик унтарна. */
  rooms: AvailabilityRoom[];
  /** Салбарын тухайн гаригийн ажлын цаг */
  branchHours: HmInterval[];
  slotMinutes: number;
  minLeadMinutes: number;
  staffId?: string | null;
  roomId?: string | null;
};

export type Slot = { startsAt: Date; staffId: string; roomId: string | null };

const MIN = 60_000;

/** Интервалуудыг эрэмбэлж нийлүүлнэ */
export function normalize(list: Interval[]): Interval[] {
  const sorted = list.filter((i) => i.end > i.start).sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const i of sorted) {
    const last = out[out.length - 1];
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
    else out.push({ ...i });
  }
  return out;
}

export function intersect(a: Interval[], b: Interval[]): Interval[] {
  const out: Interval[] = [];
  for (const x of normalize(a)) for (const y of normalize(b)) {
    const start = Math.max(x.start, y.start);
    const end = Math.min(x.end, y.end);
    if (end > start) out.push({ start, end });
  }
  return normalize(out);
}

export function subtract(from: Interval[], cuts: Interval[]): Interval[] {
  let result = normalize(from);
  for (const c of normalize(cuts)) {
    result = result.flatMap((r) => {
      if (c.end <= r.start || c.start >= r.end) return [r];
      const parts: Interval[] = [];
      if (c.start > r.start) parts.push({ start: r.start, end: c.start });
      if (c.end < r.end) parts.push({ start: c.end, end: r.end });
      return parts;
    });
  }
  return result;
}

const contains = (list: Interval[], i: Interval) => list.some((x) => x.start <= i.start && x.end >= i.end);
const overlapsAny = (list: Interval[], i: Interval) => list.some((x) => x.start < i.end && i.start < x.end);
const busyToIntervals = (busy: Busy[]): Interval[] => busy.map((b) => ({ start: b.startsAt.getTime(), end: b.blockedUntil.getTime() }));

function hmToIntervals(date: string, list: HmInterval[]): Interval[] {
  return list.map((h) => ({ start: ubAt(date, h.start).getTime(), end: ubAt(date, h.end).getTime() }));
}

/** ServiceStaff хоосон бол бүх bookable ажилтан, үгүй бол зөвхөн жагсаалтынх */
export function eligibleStaffIds(bookableIds: string[], serviceStaffIds: string[]): string[] {
  if (serviceStaffIds.length === 0) return bookableIds;
  const allowed = new Set(serviceStaffIds);
  return bookableIds.filter((id) => allowed.has(id));
}

/** Ажилтны тухайн өдрийн ажлын цаг (хуваарь ∩ салбар) — busy/timeOff хасаагүй */
export function workingIntervals(date: string, staff: Pick<AvailabilityStaff, "schedule">, branchHours: HmInterval[]): Interval[] {
  const weekday = ubWeekday(date);
  const own = staff.schedule.filter((s) => s.weekday === weekday).map((s) => ({ start: s.startTime, end: s.endTime }));
  return intersect(hmToIntervals(date, own), hmToIntervals(date, branchHours));
}

/** Ажилтны тухайн өдрийн сул интервалууд (ажлын цаг − чөлөө − цагууд) */
export function freeIntervals(date: string, staff: AvailabilityStaff, branchHours: HmInterval[]): Interval[] {
  const work = workingIntervals(date, staff, branchHours);
  const off = staff.timeOff.map((o) => ({ start: o.startsAt.getTime(), end: o.endsAt.getTime() }));
  return subtract(work, [...off, ...busyToIntervals(staff.busy)]);
}

function pickRoom(rooms: AvailabilityRoom[], block: Interval, roomId?: string | null): string | null | undefined {
  const candidates = roomId ? rooms.filter((r) => r.id === roomId) : rooms;
  return candidates.find((r) => !overlapsAny(busyToIntervals(r.busy), block))?.id;
}

export function findSlots(input: AvailabilityInput): Slot[] {
  const { date, service, slotMinutes } = input;
  if (service.durationMin <= 0 || slotMinutes <= 0) return [];
  const blockMs = (service.durationMin + service.bufferMin) * MIN;
  const earliest = input.now.getTime() + input.minLeadMinutes * MIN;
  const dayStart = ubAt(date, "00:00").getTime();
  const step = slotMinutes * MIN;
  const roomsOn = service.requiresRoom && input.rooms.length > 0;

  const staff = input.staffId ? input.staff.filter((s) => s.id === input.staffId) : input.staff;
  const slots: Slot[] = [];
  for (const s of staff) {
    for (const free of freeIntervals(date, s, input.branchHours)) {
      // УБ-ийн шөнө дундаас slotMinutes-ийн торонд тааруулна
      let start = dayStart + Math.ceil((Math.max(free.start, earliest) - dayStart) / step) * step;
      for (; start + blockMs <= free.end; start += step) {
        let roomId: string | null = null;
        if (roomsOn) {
          const r = pickRoom(input.rooms, { start, end: start + blockMs }, input.roomId);
          if (!r) continue;
          roomId = r;
        }
        slots.push({ startsAt: new Date(start), staffId: s.id, roomId });
      }
    }
  }
  const order = new Map(staff.map((s, i) => [s.id, i]));
  return slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime() || order.get(a.staffId)! - order.get(b.staffId)!);
}

export type SlotProblem = "PAST" | "OUTSIDE_HOURS" | "TIME_OFF" | "STAFF_BUSY" | "ROOM_REQUIRED" | "ROOM_BUSY";

/**
 * Тодорхой цагийг (үүсгэх / зөөх) шалгана. Засварлаж буй цагийг busy-с хасаж өгнө.
 * Тор (slotMinutes)-д тааруулахыг шаардахгүй — зөвхөн боломжтой эсэх.
 */
export function checkSlot(input: Omit<AvailabilityInput, "staffId" | "date"> & { startsAt: Date; staffId: string }): SlotProblem | null {
  const { service } = input;
  const block: Interval = { start: input.startsAt.getTime(), end: input.startsAt.getTime() + (service.durationMin + service.bufferMin) * MIN };
  if (block.start < input.now.getTime() + input.minLeadMinutes * MIN) return "PAST";
  const staff = input.staff.find((s) => s.id === input.staffId);
  if (!staff) return "OUTSIDE_HOURS";
  // Цаг шөнө дундыг давж болохгүй тул эхлэх өдрийн хуваариар шалгана
  const date = ubDateKey(input.startsAt);
  if (!contains(workingIntervals(date, staff, input.branchHours), block)) return "OUTSIDE_HOURS";
  if (overlapsAny(staff.timeOff.map((o) => ({ start: o.startsAt.getTime(), end: o.endsAt.getTime() })), block)) return "TIME_OFF";
  if (overlapsAny(busyToIntervals(staff.busy), block)) return "STAFF_BUSY";
  if (service.requiresRoom && input.rooms.length > 0) {
    if (!input.roomId) return "ROOM_REQUIRED";
    if (pickRoom(input.rooms, block, input.roomId) === undefined) return "ROOM_BUSY";
  }
  return null;
}
