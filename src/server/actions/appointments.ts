"use server";

/**
 * Цаг захиалгын нимгэн server action-ууд: эрх → module → кэш шинэчлэх.
 * STAFF (appointment:read эрхгүй) зөвхөн өөрийн цагийг, үйлчлүүлэгчийн утас/имэйлгүйгээр уншина.
 */
import { revalidatePath, updateTag } from "next/cache";
import { can } from "@/server/auth/permissions";
import { requireAnyPermission, requirePermission } from "@/server/auth/session";
import { ForbiddenError, UserError } from "@/server/errors";
import { appointmentDetail } from "@/server/modules/appointments/queries";
import {
  addTimeOff,
  deleteRoom,
  deleteTimeOff,
  saveBookingHours,
  saveRoom,
  saveSchedule,
  saveStaffServices,
} from "@/server/modules/appointments/schedules";
import type { ApptExtraInput, ApptInput, ApptMoveInput, ApptStatusInput, ApptUpdateInput, SlotQuery } from "@/server/modules/appointments/schema";
import {
  changeStatus,
  createAppointment,
  listSlots,
  moveAppointment,
  openInPos,
  searchFreeSlots,
  updateAppointment,
  updateApptNote,
  setExtraTime,
} from "@/server/modules/appointments/service";
import { runAction } from "./result";

function refreshCalendar() {
  revalidatePath("/admin/calendar");
  revalidatePath("/admin/schedule");
  revalidatePath("/admin");
}

const iso = <T extends { startsAt: Date }>(slots: T[]) => slots.map((s) => ({ ...s, startsAt: s.startsAt.toISOString() }));

export async function apptSlots(query: SlotQuery) {
  return runAction(async () => {
    await requirePermission("appointment:read");
    const r = await listSlots(query);
    return { staff: r.staff, rooms: r.rooms, requiresRoom: r.service.requiresRoom, slots: iso(r.slots) };
  });
}

export async function apptFreeSearch(input: { serviceId: string; staffId?: string | null; from: string; days?: number }) {
  return runAction(async () => {
    await requirePermission("appointment:read");
    const r = await searchFreeSlots(input);
    return { staff: r.staff, days: r.days.map((d) => ({ date: d.date, slots: iso(d.slots) })) };
  });
}

/** Дэлгэрэнгүй. STAFF: зөвхөн өөрийн цаг, холбоо барих мэдээлэлгүй. */
export async function apptDetail(id: string) {
  return runAction(async () => {
    const user = await requireAnyPermission("appointment:read", "schedule:own");
    const canContact = can(user.role, "customer:contact:read");
    const detail = await appointmentDetail(String(id), { canContact });
    if (!detail) throw new UserError("Цаг олдсонгүй.");
    if (!can(user.role, "appointment:read") && detail.staffId !== user.id) throw new ForbiddenError();
    return detail;
  });
}

export async function apptCreate(input: ApptInput) {
  return runAction(async () => {
    const user = await requirePermission("appointment:write");
    const a = await createAppointment(input, { id: user.id, role: user.role });
    refreshCalendar();
    return { id: a.id };
  }, "Цаг бүртгэгдлээ.");
}

export async function apptUpdate(input: ApptUpdateInput) {
  return runAction(async () => {
    const user = await requirePermission("appointment:write");
    await updateAppointment(input, { id: user.id, role: user.role });
    refreshCalendar();
  }, "Цаг шинэчлэгдлээ.");
}

/** Тэмдэглэл (ирсэн цагт ч) */
export async function apptNote(input: { id: string; note: string | null }) {
  return runAction(async () => {
    const user = await requirePermission("appointment:write");
    await updateApptNote(input, { id: user.id, role: user.role });
    refreshCalendar();
  }, "Тэмдэглэл хадгалагдлаа.");
}

export async function apptMove(input: ApptMoveInput) {
  return runAction(async () => {
    const user = await requirePermission("appointment:write");
    const a = await moveAppointment(input, { id: user.id, role: user.role });
    refreshCalendar();
    return { id: a.id, version: a.version };
  }, "Цаг зөөгдлөө.");
}

/** "+ Нэмэлт цаг" — календарийн дэлгэрэнгүйгээс */
export async function apptExtraTime(input: ApptExtraInput) {
  return runAction(async () => {
    const user = await requirePermission("appointment:write");
    await setExtraTime(input, user);
    revalidatePath("/admin/calendar");
  }, "Нэмэлт цаг хадгалагдлаа.");
}

export async function apptStatus(input: ApptStatusInput) {
  return runAction(async () => {
    const user = await requirePermission("appointment:status");
    const a = await changeStatus(input, { id: user.id, role: user.role });
    refreshCalendar();
    return { status: a.status };
  });
}

/** "Ирсэн — POS нээх" → /admin/pos?sale=… */
export async function apptOpenPos(id: string) {
  return runAction(async () => {
    const user = await requirePermission("appointment:status");
    if (!can(user.role, "sale:create")) throw new ForbiddenError();
    const r = await openInPos(String(id), { id: user.id, role: user.role });
    refreshCalendar();
    return r;
  });
}

// ─────────────── ADMIN: хуваарь, чөлөө, өрөө ───────────────

export async function saveScheduleAction(input: { staffId: string; intervals: { weekday: number; startTime: string; endTime: string }[] }) {
  return runAction(async () => {
    const user = await requirePermission("staff-schedule:write");
    await saveSchedule(input, user.id);
    revalidatePath("/admin/staff-schedules");
    refreshCalendar();
  }, "Хуваарь хадгалагдлаа.");
}

export async function addTimeOffAction(input: Parameters<typeof addTimeOff>[0]) {
  return runAction(async () => {
    const user = await requirePermission("staff-schedule:write");
    const r = await addTimeOff(input, user.id);
    revalidatePath("/admin/staff-schedules");
    refreshCalendar();
    return { conflicts: r.conflicts.map((c) => ({ ...c, startsAt: c.startsAt.toISOString(), endsAt: c.endsAt.toISOString() })) };
  }, "Чөлөө бүртгэгдлээ.");
}

export async function deleteTimeOffAction(id: string) {
  return runAction(async () => {
    const user = await requirePermission("staff-schedule:write");
    await deleteTimeOff(String(id), user.id);
    revalidatePath("/admin/staff-schedules");
    refreshCalendar();
  }, "Чөлөө устгагдлаа.");
}

export async function saveStaffServicesAction(input: { staffId: string; serviceIds: string[]; isBookable: boolean }) {
  return runAction(async () => {
    const user = await requirePermission("service-staff:write");
    await saveStaffServices(input, user.id);
    revalidatePath("/admin/staff-schedules");
    refreshCalendar();
  }, "Хадгалагдлаа.");
}

export async function saveBookingHoursAction(input: Parameters<typeof saveBookingHours>[0]) {
  return runAction(async () => {
    const user = await requirePermission("staff-schedule:write");
    await saveBookingHours(input, user.id);
    // Сайтын footer, салоны хуудасны ажлын цаг салбарын цагаас үүсдэг
    updateTag("settings");
    revalidatePath("/admin/staff-schedules");
    refreshCalendar();
  }, "Салбарын ажлын цаг хадгалагдлаа.");
}

export async function saveRoomAction(input: Parameters<typeof saveRoom>[0]) {
  return runAction(async () => {
    const user = await requirePermission("room:write");
    await saveRoom(input, user.id);
    revalidatePath("/admin/rooms");
  }, "Өрөө хадгалагдлаа.");
}

export async function deleteRoomAction(id: string) {
  return runAction(async () => {
    const user = await requirePermission("room:write");
    await deleteRoom(String(id), user.id);
    revalidatePath("/admin/rooms");
  }, "Өрөө устгагдлаа.");
}
