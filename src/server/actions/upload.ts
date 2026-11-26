"use server";

import { z } from "zod";
import { requireAnyPermission } from "@/server/auth/session";
import { UserError } from "@/server/errors";
import { imageFileError } from "@/lib/upload-limits";
import { storage } from "@/server/storage";
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
      const err = imageFileError(f);
      if (err) throw new UserError(err);
    }
    const uploaded = await Promise.all(
      files.map((f) =>
        storage.put(f, folder).catch((e: unknown) => {
          // Storage-ийн алдааг хэрэглэгчид ойлгомжтой (дэлгэрэнгүй нь серверийн log-д)
          throw new UserError(e instanceof Error && e.message.startsWith("Зураг") ? e.message : "Зураг хадгалахад алдаа гарлаа. Дахин оролдоно уу.");
        }),
      ),
    );
    return uploaded.map((u) => u.url);
  });
}
