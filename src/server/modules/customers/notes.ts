/**
 * Үйлчлүүлэгчийн тэмдэглэл (A8). Бичих: ADMIN, MANAGER, тухайн үйлчлүүлэгчид үйлчилсэн STAFF.
 * Засах/устгах: зохиогч өөрөө 24 цагийн дотор; ADMIN, MANAGER (customer:write) бүгдийг, хэзээ ч.
 * Бүх өөрчлөлт AuditLog-д. Тэмдэглэлийн текстийг log-д бичихгүй (хувийн мэдээлэл) — зөвхөн урт.
 */
import { z } from "zod";
import type { Role } from "@/generated/prisma/enums";
import { audit } from "@/server/audit";
import { can } from "@/server/auth/permissions";
import { db } from "@/server/db";
import { ForbiddenError, UserError } from "@/server/errors";
import { assertCanSeeCustomer } from "./access";

type Actor = { id: string; role: Role };

export const NOTE_EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;
const body = z.string().trim().min(1, "Тэмдэглэлээ бичнэ үү.").max(2000, "2000 тэмдэгтээс ихгүй.");
export const noteInputSchema = z.object({ customerId: z.string().min(1).max(64), body, visitId: z.string().min(1).max(64).nullish() });
export type NoteInput = z.input<typeof noteInputSchema>;

/** Цагийн дарааллаар (шинэ нь дээр), зохиогчийн нэртэй */
export async function listNotes(customerId: string, take = 200) {
  return db.customerNote.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, body: true, createdAt: true, updatedAt: true, authorId: true, visitId: true, author: { select: { name: true } } },
  });
}

/** Энэ хэрэглэгч энэ тэмдэглэлийг засаж/устгаж болох уу */
export function canEditNote(actor: Actor, note: { authorId: string; createdAt: Date }, now = new Date()) {
  if (can(actor.role, "customer:write")) return true;
  return note.authorId === actor.id && now.getTime() - note.createdAt.getTime() <= NOTE_EDIT_WINDOW_MS;
}

export async function createNote(raw: NoteInput, actor: Actor) {
  if (!can(actor.role, "customer-note:write")) throw new ForbiddenError();
  const input = noteInputSchema.parse(raw);
  await assertCanSeeCustomer(actor, input.customerId);
  if (input.visitId) {
    const v = await db.visit.findUnique({ where: { id: input.visitId }, select: { customerId: true } });
    if (!v || v.customerId !== input.customerId) throw new UserError("Айлчлал олдсонгүй.");
  }
  return db.$transaction(async (tx) => {
    const note = await tx.customerNote.create({ data: { customerId: input.customerId, authorId: actor.id, body: input.body, visitId: input.visitId ?? null } });
    await audit(tx, { userId: actor.id, action: "customer_note.create", entity: "CustomerNote", entityId: note.id, after: { customerId: input.customerId, length: input.body.length } });
    return note;
  });
}

async function loadEditable(id: string, actor: Actor, now: Date) {
  const note = await db.customerNote.findUnique({ where: { id } });
  if (!note) throw new UserError("Тэмдэглэл олдсонгүй.");
  if (!canEditNote(actor, note, now)) throw new ForbiddenError("Өөрийн тэмдэглэлийг зөвхөн 24 цагийн дотор засна.");
  return note;
}

export async function updateNote(raw: { id: string; body: string }, actor: Actor, now = new Date()) {
  if (!can(actor.role, "customer-note:write")) throw new ForbiddenError();
  const text = body.parse(raw.body);
  const note = await loadEditable(String(raw.id), actor, now);
  return db.$transaction(async (tx) => {
    const updated = await tx.customerNote.update({ where: { id: note.id }, data: { body: text } });
    await audit(tx, { userId: actor.id, action: "customer_note.update", entity: "CustomerNote", entityId: note.id, before: { length: note.body.length }, after: { length: text.length } });
    return updated;
  });
}

export async function deleteNote(id: string, actor: Actor, now = new Date()) {
  if (!can(actor.role, "customer-note:write")) throw new ForbiddenError();
  const note = await loadEditable(String(id), actor, now);
  await db.$transaction(async (tx) => {
    await tx.customerNote.delete({ where: { id: note.id } });
    await audit(tx, { userId: actor.id, action: "customer_note.delete", entity: "CustomerNote", entityId: note.id, before: { customerId: note.customerId, authorId: note.authorId } });
  });
}

/** UI-д: тэмдэглэл бүрийг засаж болох эсэхтэй нь (сериалчилсан огноо) */
export async function noteViews(customerId: string, actor: Actor, take = 200, now = new Date()) {
  const notes = await listNotes(customerId, take);
  return notes.map((n) => ({ id: n.id, body: n.body, createdAt: n.createdAt.toISOString(), author: n.author.name, canEdit: can(actor.role, "customer-note:write") && canEditNote(actor, n, now) }));
}
