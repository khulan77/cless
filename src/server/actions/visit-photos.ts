"use server";

/** Айлчлалын өмнө/дараах зураг (A9) — modules/visits/photos.ts-ийн дүрмээр */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/server/auth/session";
import { UserError } from "@/server/errors";
import { deleteVisitPhoto, uploadVisitPhoto } from "@/server/modules/visits/photos";
import { runAction } from "./result";

const fields = z.object({
  customerId: z.string().min(1).max(64),
  kind: z.enum(["BEFORE", "AFTER"]),
  appointmentId: z.string().min(1).max(64).nullish(),
  visitId: z.string().min(1).max(64).nullish(),
  note: z.string().max(500).nullish(),
  consent: z.enum(["1", "0"]).nullish(),
});

export async function visitPhotoUpload(formData: FormData) {
  return runAction(async () => {
    const user = await requirePermission("visit-photo:write");
    const get = (k: string) => {
      const v = formData.get(k);
      return typeof v === "string" && v !== "" ? v : null;
    };
    const f = fields.parse({ customerId: get("customerId"), kind: get("kind"), appointmentId: get("appointmentId"), visitId: get("visitId"), note: get("note"), consent: get("consent") });
    const file = formData.get("file");
    if (!(file instanceof File)) throw new UserError("Зураг сонгоогүй байна.");
    const photo = await uploadVisitPhoto({ ...f, consent: f.consent === "1", file }, user);
    revalidatePath(`/admin/customers/${f.customerId}`);
    revalidatePath(`/admin/me/customers/${f.customerId}`);
    return { id: photo.id };
  }, "Зураг хадгалагдлаа.");
}

export async function visitPhotoDelete(id: string) {
  return runAction(async () => {
    const user = await requirePermission("visit-photo:write");
    await deleteVisitPhoto(String(id), user);
    revalidatePath("/admin/customers", "layout");
    revalidatePath("/admin/me", "layout");
  }, "Зураг устгагдлаа.");
}
