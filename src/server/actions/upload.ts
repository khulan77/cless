"use server";

import { z } from "zod";
import { requireAnyPermission } from "@/server/auth/session";
import { UserError } from "@/server/errors";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, storage } from "@/server/storage";
import { runAction } from "./result";

const folderSchema = z.enum(["products", "services", "collections", "content"]);

export async function uploadImages(formData: FormData) {
  return runAction(async () => {
    await requireAnyPermission("product:write", "service:write", "settings:write");
    const folder = folderSchema.parse(formData.get("folder"));
    const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length === 0) throw new UserError("Файл сонгоогүй байна.");
    if (files.length > 1) throw new UserError("Зургийг нэг нэгээр нь оруулна.");
    for (const f of files) {
      if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(f.type)) {
        throw new UserError(`"${f.name}" — зөвхөн JPG, PNG, WEBP, AVIF зураг оруулна.`);
      }
      if (f.size > MAX_IMAGE_BYTES) throw new UserError(`"${f.name}" — 5MB-аас ихгүй байх ёстой.`);
    }
    const uploaded = await Promise.all(files.map((f) => storage.put(f, folder)));
    return uploaded.map((u) => u.url);
  });
}
