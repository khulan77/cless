/**
 * Цаг захиалга: үүсгэх, засах, зөөх, төлөв, POS-оор нээх, Sale PAID → DONE.
 * Давхардлаас 2 давхар хамгаалалт: (1) checkSlot (availability), (2) DB-ийн EXCLUDE constraint.
 * Next-ээс хамааралгүй — server action эрх шалгаад энд дуудна.
 */
import type { Prisma, Role } from "@/generated/prisma/client";
import { addMinutes, ubDateKey } from "@/lib/time";
import { audit } from "@/server/audit";
import { can } from "@/server/auth/permissions";
import { db } from "@/server/db";
import { ForbiddenError, UserError } from "@/server/errors";
import { getCurrentBranch } from "@/server/modules/branches/service";
import { enqueue } from "@/server/modules/outbox/service";
import { draftDataSchema } from "@/server/modules/sales/drafts";
import { checkSlot, findSlots, type SlotProblem } from "./availability";
import { availabilityData } from "./repo";
import {
  apptExtraSchema,
  apptInputSchema,
  apptMoveSchema,
  apptStatusSchema,
  apptUpdateSchema,
  freeSearchSchema,
  slotQuerySchema,
  type ApptExtraInput,
  type ApptInput,
  type ApptMoveInput,
  type ApptStatusInput,
  type ApptUpdateInput,
  type SlotQuery,
} from "./schema";
import { isEditable, nextApptStatus, ApptStateError } from "./state";
import type { ApptEmailKind } from "@/server/modules/notifications/appointment-email";
export { completeForSale } from "./complete";
import { getBookingSettings } from "@/server/modules/settings/pos-settings";
import { addDays, ubWeekday } from "@/lib/time";

type Tx = Prisma.TransactionClient;
export type Actor = { id: string; role: Role };

const TX_OPTS = { maxWait: 10_000, timeout: 30_000 } as const;

export const SLOT_MESSAGES: Record<SlotProblem, string> = {
  PAST: "Өнгөрсөн цагт захиалга үүсгэх боломжгүй.",
  OUTSIDE_HOURS: "Ажилтны ажлын цагаас гадуур байна.",
  TIME_OFF: "Ажилтан энэ үед чөлөөтэй (амралт/чөлөө).",
  STAFF_BUSY: "Ажилтан энэ цагт өөр үйлчлүүлэгчтэй байна.",
  ROOM_REQUIRED: "Энэ үйлчилгээнд өрөө сонгоно уу.",
  ROOM_BUSY: "Сонгосон өрөө энэ цагт завгүй байна.",
};
export const OVERLAP = "APPT_OVERLAP";

/**
 * DB-ийн EXCLUDE constraint зөрчлийг (зэрэг 2 хүсэлт) Монгол мессеж болгоно.
 * Prisma + adapter-pg алдааны бүтэц хувилбараас хамаарч өөр байдаг тул нэр/кодоор нь танина.
 */
export function overlapError(e: unknown): UserError | null {
  const text = (() => {
    try {
      return `${String(e)} ${JSON.stringify(e, Object.getOwnPropertyNames(e as object))}`;
    } catch {
      return String(e);
    }
  })();
  if (text.includes("Appointment_no_room_overlap")) return new UserError(SLOT_MESSAGES.ROOM_BUSY, { startsAt: [SLOT_MESSAGES.ROOM_BUSY] }, OVERLAP);
  if (text.includes("Appointment_no_staff_overlap") || text.includes("23P01")) {
    return new UserError("Энэ цаг дөнгөж сая өөр захиалгаар дүүрсэн байна. Өөр цаг сонгоно уу.", { startsAt: ["Цаг давхцаж байна."] }, OVERLAP);
  }
  return null;
}

async function withOverlapGuard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    throw overlapError(e) ?? e;
  }
}

// ─────────────────────────── Боломжтой цаг ───────────────────────────

export async function listSlots(raw: SlotQuery, now = new Date()) {
  const q = slotQuerySchema.parse(raw);
  const data = await availabilityData(db, { serviceId: q.serviceId, fromDate: q.date, toDate: q.date, excludeId: q.excludeId });
  const slots = findSlots({
    date: q.date,
    now,
    // Нэмэлт цаг нь buffer-ийн адил дараагийн цагийг хаана
    service: { ...data.service, bufferMin: data.service.bufferMin + q.extraMin },
    staff: data.availabilityStaff,
    rooms: data.availabilityRooms,
    branchHours: data.hoursFor(ubWeekday(q.date)),
    slotMinutes: data.settings.slotMinutes,
    minLeadMinutes: data.settings.minLeadMinutes,
    staffId: q.staffId,
    roomId: q.roomId,
  });
  return { service: data.service, staff: data.staff, rooms: data.rooms, slots };
}

/** "Сул цаг хайх": огнооны хүрээнд өдөр бүрийн сул цагууд */
export async function searchFreeSlots(raw: { serviceId: string; staffId?: string | null; from: string; days?: number }, now = new Date()) {
  const q = freeSearchSchema.parse(raw);
  const to = addDays(q.from, q.days - 1);
  const data = await availabilityData(db, { serviceId: q.serviceId, fromDate: q.from, toDate: to });
  const days: { date: string; slots: ReturnType<typeof findSlots> }[] = [];
  for (let i = 0; i < q.days; i++) {
    const date = addDays(q.from, i);
    days.push({
      date,
      slots: findSlots({
        date,
        now,
        service: data.service,
        staff: data.availabilityStaff,
        rooms: data.availabilityRooms,
        branchHours: data.hoursFor(ubWeekday(date)),
        slotMinutes: data.settings.slotMinutes,
        minLeadMinutes: data.settings.minLeadMinutes,
        staffId: q.staffId,
      }),
    });
  }
  return { service: data.service, staff: data.staff, days };
}

// ─────────────────────────── Үүсгэх / засах ───────────────────────────

type Placement = { serviceId: string; staffId: string; roomId?: string | null; startsAt: Date; extraMin?: number };

/** Сервер талын шалгалт (1-р давхар хамгаалалт). Буцаах: endsAt, blockedUntil, үнэ */
async function validatePlacement(tx: Tx, p: Placement, opts: { excludeId?: string; now: Date }) {
  const date = ubDateKey(p.startsAt);
  const data = await availabilityData(tx, { serviceId: p.serviceId, fromDate: date, toDate: date, excludeId: opts.excludeId });
  if (!data.staff.some((s) => s.id === p.staffId)) {
    throw new UserError("Энэ ажилтан энэ үйлчилгээг хийдэггүй эсвэл цаг авах боломжгүй.", { staffId: ["Ажилтан тохирохгүй."] });
  }
  if (p.roomId && !data.rooms.some((r) => r.id === p.roomId)) throw new UserError("Өрөө олдсонгүй.", { roomId: ["Өрөө олдсонгүй."] });
  const extra = p.extraMin ?? 0;
  const problem = checkSlot({
    startsAt: p.startsAt,
    staffId: p.staffId,
    roomId: p.roomId ?? null,
    now: opts.now,
    // Өрөө сонгосон бол (шаардлагагүй үйлчилгээнд ч) өрөөний давхцлыг шалгана
    service: { ...data.service, bufferMin: data.service.bufferMin + extra, requiresRoom: data.service.requiresRoom || Boolean(p.roomId) },
    staff: data.availabilityStaff,
    rooms: data.availabilityRooms,
    branchHours: data.hoursFor(ubWeekday(date)),
    slotMinutes: data.settings.slotMinutes,
    minLeadMinutes: data.settings.minLeadMinutes,
  });
  if (problem) throw new UserError(SLOT_MESSAGES[problem], { startsAt: [SLOT_MESSAGES[problem]] }, `SLOT_${problem}`);
  const endsAt = addMinutes(p.startsAt, data.service.durationMin);
  return {
    service: data.service,
    endsAt,
    blockedUntil: addMinutes(endsAt, data.service.bufferMin + extra),
    extraMin: extra,
    roomId: data.rooms.length > 0 ? (p.roomId ?? null) : null,
  };
}

export async function createAppointment(raw: ApptInput, actor: Actor, now = new Date()) {
  const input = apptInputSchema.parse(raw);
  return withOverlapGuard(() =>
    db.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({ where: { id: input.customerId }, select: { id: true } });
      if (!customer) throw new UserError("Үйлчлүүлэгч олдсонгүй.", { customerId: ["Үйлчлүүлэгчээ сонгоно уу."] });
      const v = await validatePlacement(tx, input, { now });
      const branch = await getCurrentBranch(tx);
      const appt = await tx.appointment.create({
        data: {
          branchId: branch.id,
          customerId: input.customerId,
          staffId: input.staffId,
          serviceId: input.serviceId,
          roomId: v.roomId,
          startsAt: input.startsAt,
          endsAt: v.endsAt,
          blockedUntil: v.blockedUntil,
          extraMin: v.extraMin,
          source: input.source,
          note: input.note ?? null,
          priceSnapshot: v.service.price,
          createdById: actor.id,
        },
      });
      await audit(tx, { userId: actor.id, action: "appointment.create", entity: "Appointment", entityId: appt.id, after: snapshot(appt) });
      await notify(tx, appt.id, "created", now);
      return appt;
    }, TX_OPTS),
  );
}

function snapshot(a: { startsAt: Date; endsAt: Date; staffId: string; serviceId: string; roomId: string | null; status: string; note?: string | null; source?: string }) {
  return {
    startsAt: a.startsAt.toISOString(),
    endsAt: a.endsAt.toISOString(),
    staffId: a.staffId,
    serviceId: a.serviceId,
    roomId: a.roomId,
    status: a.status,
    note: a.note ?? null,
    source: a.source,
  };
}

async function lockAppt(tx: Tx, id: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Appointment" WHERE "id" = ${id} FOR UPDATE`;
  if (!rows[0]) throw new UserError("Цаг олдсонгүй.");
  return tx.appointment.findUniqueOrThrow({ where: { id } });
}

async function applyChange(
  tx: Tx,
  current: Awaited<ReturnType<typeof lockAppt>>,
  next: { customerId: string; serviceId: string; staffId: string; roomId?: string | null; startsAt: Date; extraMin?: number; source?: string; note?: string | null },
  version: number,
  actor: Actor,
  now: Date,
  action: string,
) {
  if (current.version !== version) throw new UserError("Энэ цагийг өөр хүн дөнгөж сая өөрчилсөн. Хуудсаа шинэчилнэ үү.", undefined, "STALE");
  await assertPlacementChangeable(tx, current);
  // Moving on the calendar keeps the extra time; the edit form sends it explicitly
  const v = await validatePlacement(tx, { ...next, extraMin: next.extraMin ?? current.extraMin }, { excludeId: current.id, now });
  const updated = await tx.appointment.update({
    where: { id: current.id },
    data: {
      customerId: next.customerId,
      serviceId: next.serviceId,
      staffId: next.staffId,
      roomId: v.roomId,
      startsAt: next.startsAt,
      endsAt: v.endsAt,
      blockedUntil: v.blockedUntil,
      extraMin: v.extraMin,
      ...(next.source ? { source: next.source as "PHONE" } : {}),
      ...(next.note !== undefined ? { note: next.note ?? null } : {}),
      priceSnapshot: next.serviceId !== current.serviceId ? v.service.price : current.priceSnapshot,
      version: { increment: 1 },
    },
  });
  await audit(tx, { userId: actor.id, action, entity: "Appointment", entityId: current.id, before: snapshot(current), after: snapshot(updated) });
  const timeChanged = updated.startsAt.getTime() !== current.startsAt.getTime() || updated.staffId !== current.staffId || updated.serviceId !== current.serviceId;
  if (timeChanged) await notify(tx, updated.id, "changed", now);
  return updated;
}

export const ARRIVED_LOCKED = "Ирсэн цагийг зөөх боломжгүй, POS-оос засна.";

/**
 * Ирсэн / үйлчилгээнд байгаа эсвэл идэвхтэй борлуулалттай (POS ноорог, төлбөр хүлээж буй) цагийн
 * цаг, ажилтан, үйлчилгээ, өрөө, үйлчлүүлэгчийг өөрчлөхгүй — зөвхөн тэмдэглэл (updateApptNote).
 */
async function assertPlacementChangeable(tx: Tx, current: Awaited<ReturnType<typeof lockAppt>>) {
  if (current.status === "ARRIVED" || current.status === "IN_PROGRESS") throw new UserError(ARRIVED_LOCKED, undefined, "APPT_LOCKED");
  if (!isEditable(current.status)) throw new UserError("Дууссан эсвэл цуцлагдсан цагийг засах боломжгүй.", undefined, "APPT_LOCKED");
  const activeSale = await tx.sale.count({ where: { appointmentId: current.id, status: { in: [...ACTIVE_SALE] } } });
  if (activeSale > 0) throw new UserError(ARRIVED_LOCKED, undefined, "APPT_LOCKED");
}

/**
 * "+ Нэмэлт цаг" (өрөө бэлдэх, цэвэрлэх) — календарийн дэлгэрэнгүйгээс. Зөвхөн дуусах хилийг
 * (blockedUntil) хөдөлгөнө, тиймээс ирсэн / үйлчилгээнд байгаа цагт ч болно. Дараагийн цагтай
 * давхцвал DB-ийн EXCLUDE constraint татгалзана.
 */
export async function setExtraTime(raw: ApptExtraInput, actor: Actor) {
  const input = apptExtraSchema.parse(raw);
  return withOverlapGuard(() =>
    db.$transaction(async (tx) => {
      const current = await lockAppt(tx, input.id);
      if (!isEditable(current.status) && current.status !== "ARRIVED" && current.status !== "IN_PROGRESS") {
        throw new UserError("Дууссан эсвэл цуцлагдсан цагт нэмэлт цаг өгөх боломжгүй.", undefined, "APPT_LOCKED");
      }
      if (current.extraMin === input.extraMin) return current;
      const blockedUntil = addMinutes(current.blockedUntil, input.extraMin - current.extraMin);
      const updated = await tx.appointment.update({
        where: { id: current.id },
        data: { extraMin: input.extraMin, blockedUntil, version: { increment: 1 } },
      });
      await audit(tx, {
        userId: actor.id,
        action: "appointment.extra_time",
        entity: "Appointment",
        entityId: current.id,
        before: { extraMin: current.extraMin },
        after: { extraMin: updated.extraMin },
      });
      return updated;
    }, TX_OPTS),
  );
}

/** Тэмдэглэл засах — бүх идэвхтэй төлөвт (ирсэн цагт ч) болно; байршилд хүрэхгүй */
export async function updateApptNote(raw: { id: string; note: string | null }, actor: Actor) {
  const id = String(raw.id);
  const note = raw.note?.trim() ? raw.note.trim().slice(0, 1000) : null;
  return db.$transaction(async (tx) => {
    const current = await lockAppt(tx, id);
    if (current.status === "CANCELLED" || current.status === "NO_SHOW") throw new UserError("Цуцлагдсан цагийг засах боломжгүй.");
    const updated = await tx.appointment.update({ where: { id }, data: { note, version: { increment: 1 } } });
    await audit(tx, { userId: actor.id, action: "appointment.note", entity: "Appointment", entityId: id, before: { note: current.note }, after: { note } });
    return updated;
  }, TX_OPTS);
}

export async function updateAppointment(raw: ApptUpdateInput, actor: Actor, now = new Date()) {
  const input = apptUpdateSchema.parse(raw);
  return withOverlapGuard(() =>
    db.$transaction(async (tx) => {
      const current = await lockAppt(tx, input.id);
      if (input.customerId !== current.customerId) {
        const c = await tx.customer.findUnique({ where: { id: input.customerId }, select: { id: true } });
        if (!c) throw new UserError("Үйлчлүүлэгч олдсонгүй.");
      }
      return applyChange(tx, current, input, input.version, actor, now, "appointment.update");
    }, TX_OPTS),
  );
}

/** Календарь дээр чирж зөөх (цаг, ажилтан, өрөө) */
export async function moveAppointment(raw: ApptMoveInput, actor: Actor, now = new Date()) {
  const input = apptMoveSchema.parse(raw);
  return withOverlapGuard(() =>
    db.$transaction(async (tx) => {
      const current = await lockAppt(tx, input.id);
      return applyChange(
        tx,
        current,
        { customerId: current.customerId, serviceId: current.serviceId, staffId: input.staffId, roomId: input.roomId ?? current.roomId, startsAt: input.startsAt },
        input.version,
        actor,
        now,
        "appointment.move",
      );
    }, TX_OPTS),
  );
}

// ─────────────────────────── Төлөв ───────────────────────────

export async function changeStatus(raw: ApptStatusInput, actor: Actor, now = new Date()) {
  const input = apptStatusSchema.parse(raw);
  if (input.action === "complete") {
    if (!can(actor.role, "appointment:done-manual")) throw new ForbiddenError("Цагийг гараар дуусгах эрх зөвхөн админ, менежерт.");
    if (!input.reason?.trim()) throw new UserError("Гараар дуусгах шалтгааныг бичнэ үү.", { reason: ["Шалтгаан заавал."] });
  }
  return db.$transaction(async (tx) => {
    const current = await lockAppt(tx, input.id);
    if (input.action === "arrive") assertSameDay(current.startsAt, now);
    let status;
    try {
      status = nextApptStatus(current.status, input.action, { now, startsAt: current.startsAt, reason: input.reason });
    } catch (e) {
      if (e instanceof ApptStateError) throw new UserError(e.message);
      throw e;
    }
    const updated = await tx.appointment.update({
      where: { id: current.id },
      data: { status, ...(input.action === "cancel" ? { cancelReason: input.reason!.trim() } : {}), version: { increment: 1 } },
    });
    await audit(tx, {
      userId: actor.id,
      action: `appointment.${input.action}`,
      entity: "Appointment",
      entityId: current.id,
      before: { status: current.status },
      after: { status, reason: input.reason ?? null },
    });
    if (input.action === "cancel") await notify(tx, current.id, "cancelled", now);
    return updated;
  }, TX_OPTS);
}

// ─────────────────────────── POS ───────────────────────────

const ACTIVE_SALE = ["DRAFT", "PENDING_PAYMENT", "PARTIALLY_PAID"] as const; // DB-ийн partial unique index-тэй ижил

/**
 * "Ирсэн — POS нээх": цаг → ARRIVED, идэвхтэй Sale байвал түүнийг, үгүй бол
 * үйлчлүүлэгч + үйлчилгээ + ажилтантай шинэ DRAFT ноорог. Буцаах: saleId.
 */
export const SAME_DAY_ONLY = "Зөвхөн цагийн өдөр 'Ирсэн' болгож POS нээнэ.";

/** "Ирсэн" / POS — зөвхөн цагийн өдөр (УБ цагаар) */
export function assertSameDay(startsAt: Date, now: Date) {
  if (ubDateKey(startsAt) !== ubDateKey(now)) throw new UserError(SAME_DAY_ONLY, undefined, "NOT_APPT_DAY");
}

export async function openInPos(appointmentId: string, actor: Actor, now = new Date()) {
  return db.$transaction(async (tx) => {
    const appt = await lockAppt(tx, appointmentId);
    if (!["BOOKED", "CONFIRMED", "ARRIVED", "IN_PROGRESS"].includes(appt.status)) {
      throw new UserError("Дууссан эсвэл цуцлагдсан цагийг POS-оор нээх боломжгүй.");
    }
    assertSameDay(appt.startsAt, now);
    if (appt.status === "BOOKED" || appt.status === "CONFIRMED") {
      await tx.appointment.update({ where: { id: appt.id }, data: { status: nextApptStatus(appt.status, "arrive"), version: { increment: 1 } } });
      await audit(tx, { userId: actor.id, action: "appointment.arrive", entity: "Appointment", entityId: appt.id, before: { status: appt.status }, after: { status: "ARRIVED" } });
    }

    const existing = await tx.sale.findFirst({ where: { appointmentId: appt.id, status: { in: [...ACTIVE_SALE] } }, select: { id: true } });
    if (existing) return { saleId: existing.id, created: false };

    const [customer, service, staff] = await Promise.all([
      tx.customer.findUniqueOrThrow({ where: { id: appt.customerId }, select: { id: true, name: true, phone: true, email: true } }),
      tx.service.findUniqueOrThrow({ where: { id: appt.serviceId }, select: { id: true, name: true, price: true, durationMin: true } }),
      tx.user.findUniqueOrThrow({ where: { id: appt.staffId }, select: { id: true } }),
    ]);
    const draft = draftDataSchema.parse({
      lines: [
        {
          key: `appt-${appt.id}`,
          kind: "SERVICE",
          refId: service.id,
          name: service.name,
          detail: `${service.durationMin}′`,
          unitPrice: service.price,
          qty: 1,
          staffId: staff.id,
          discount: null,
          discountReason: "",
        },
      ],
      customer,
      appointmentId: appt.id,
    });
    const sale = await tx.sale.create({
      data: {
        branchId: appt.branchId,
        channel: "POS",
        createdById: actor.id,
        customerId: customer.id,
        appointmentId: appt.id,
        subtotal: service.price,
        draftData: draft as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
    await audit(tx, { userId: actor.id, action: "appointment.open_pos", entity: "Appointment", entityId: appt.id, after: { saleId: sale.id } });
    return { saleId: sale.id, created: true };
  }, TX_OPTS);
}

// ─────────────────────────── Имэйл (outbox) ───────────────────────────


/** Үйлчлүүлэгч имэйлтэй бол мэдэгдэл + (идэвхтэй цагт) сануулгыг дараалалд оруулна */
async function notify(tx: Tx, appointmentId: string, kind: Exclude<ApptEmailKind, "reminder">, now: Date) {
  const a = await tx.appointment.findUniqueOrThrow({
    where: { id: appointmentId },
    select: { id: true, startsAt: true, version: true, customer: { select: { email: true } } },
  });
  if (!a.customer.email) return;
  const startsAt = a.startsAt.toISOString();
  await enqueue(tx, {
    type: "APPT_EMAIL",
    payload: { appointmentId: a.id, kind, startsAt },
    dedupeKey: `appt-email:${a.id}:${kind}:${a.version}`,
  });
  if (kind === "cancelled") return;
  const { reminderHours } = await getBookingSettings(tx);
  const runAfter = new Date(a.startsAt.getTime() - reminderHours * 3600_000);
  // Цаг ойрхон бол (сануулгын хугацаа өнгөрсөн) сануулга илгээхгүй — баталгаажуулах имэйл хангалттай
  if (runAfter <= now) return;
  // Цаг зөөгдвөл startsAt өөр тул шинэ ажил үүснэ; хуучныг worker илгээхээс өмнө хүчингүй гэж үзнэ
  await enqueue(tx, { type: "APPT_REMINDER", payload: { appointmentId: a.id, kind: "reminder", startsAt }, dedupeKey: `appt-reminder:${a.id}:${startsAt}`, runAfter });
}
