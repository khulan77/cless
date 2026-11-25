"use server";

/** Үйлчлүүлэгчийн тэмдэглэл (A8) — эрх: customer-note:write + modules/customers/notes.ts-ийн дүрэм */
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/server/auth/session";
import { createNote, deleteNote, updateNote, type NoteInput } from "@/server/modules/customers/notes";
import { runAction } from "./result";

const refresh = (customerId?: string) => {
  if (customerId) revalidatePath(`/admin/customers/${customerId}`);
  revalidatePath("/admin/me", "layout");
  revalidatePath("/admin/calendar");
};

export async function noteCreate(input: NoteInput) {
  return runAction(async () => {
    const user = await requirePermission("customer-note:write");
    const note = await createNote(input, user);
    refresh(note.customerId);
    return { id: note.id };
  }, "Тэмдэглэл хадгалагдлаа.");
}

export async function noteUpdate(input: { id: string; body: string }) {
  return runAction(async () => {
    const user = await requirePermission("customer-note:write");
    const note = await updateNote(input, user);
    refresh(note.customerId);
  }, "Тэмдэглэл засагдлаа.");
}

export async function noteDelete(id: string) {
  return runAction(async () => {
    const user = await requirePermission("customer-note:write");
    await deleteNote(id, user);
    refresh();
  }, "Тэмдэглэл устгагдлаа.");
}
