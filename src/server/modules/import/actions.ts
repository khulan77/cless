"use server";

import { infra } from "@/i18n/mn.infra";
import { requirePermission } from "@/server/auth/session";
import { UserError } from "@/server/errors";
import { runAction } from "@/server/actions/result";
import { MAX_FILE_BYTES } from "./columns";
import { parseWorkbook } from "./parse";
import { executeImport, planImport, toPreview } from "./service";

const E = infra.import.err;

async function readUpload(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new UserError(E.noFile);
  if (!/\.xlsx$/i.test(file.name)) throw new UserError(E.notXlsx);
  if (file.size > MAX_FILE_BYTES) throw new UserError(E.tooLarge);
  return parseWorkbook(new Uint8Array(await file.arrayBuffer()));
}

/** Урьдчилан харах (dry-run) — DB-д юу ч бичихгүй */
export async function previewProductImport(formData: FormData) {
  return runAction(async () => {
    await requirePermission("product:write");
    return toPreview(await planImport(await readUpload(formData)));
  });
}

/** Импортлох: файлыг дахин уншиж, одоогийн DB-тэй дахин шалгана. Алдаатай мөр байвал юу ч бичихгүй. */
export async function runProductImport(formData: FormData) {
  return runAction(async () => {
    await requirePermission("product:write");
    const plan = await planImport(await readUpload(formData));
    if (!plan.canImport) throw new UserError(E.changedSinceReview);
    return executeImport(plan);
  });
}
