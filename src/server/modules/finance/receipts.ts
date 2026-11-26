/**
 * Зардлын баримт (зураг / PDF) — хувийн storage (public/-ээс гадуур), зөвхөн эрхтэй route-оор уншина.
 * Төрлийг файлын эхний байтаар (magic bytes) шалгана — Content-Type-д итгэхгүй.
 * Хадгалалт: storage/private.ts — prod-д Supabase PRIVATE bucket-ийн "receipts/" хавтас (айлчлалын зурагтай ижил
 * bucket, public URL үгүй), dev-д локал диск. Object path-д хувийн мэдээлэл орохгүй (огноо + uuid).
 */
import "server-only";
import { randomUUID } from "node:crypto";
import { UserError } from "@/server/errors";
import { privateStorage } from "@/server/storage/private";

export const RECEIPT_MAX_BYTES = 4 * 1024 * 1024;

const KINDS = [
  { ext: "pdf", mime: "application/pdf", test: (b: Buffer) => b.subarray(0, 5).toString("latin1") === "%PDF-" },
  { ext: "jpg", mime: "image/jpeg", test: (b: Buffer) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: "png", mime: "image/png", test: (b: Buffer) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: "webp", mime: "image/webp", test: (b: Buffer) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP" },
] as const;

export function receiptMime(key: string): string {
  return KINDS.find((k) => key.endsWith(`.${k.ext}`))?.mime ?? "application/octet-stream";
}

/** Файлыг шалгаж хадгална → түлхүүр. Файлгүй бол null. */
export async function storeReceipt(file: File | null): Promise<string | null> {
  if (!file || file.size === 0) return null;
  if (file.size > RECEIPT_MAX_BYTES) throw new UserError(`Баримт 4MB-аас ихгүй байх ёстой (${(file.size / 1024 / 1024).toFixed(1)}MB).`, { receipt: ["4MB хүртэл"] });
  const buf = Buffer.from(await file.arrayBuffer());
  const kind = KINDS.find((k) => k.test(buf));
  if (!kind) throw new UserError("Баримт: зөвхөн PDF, JPG, PNG, WEBP.", { receipt: ["PDF, JPG, PNG, WEBP"] });
  const now = new Date();
  const key = `receipts/${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.${kind.ext}`;
  try {
    await privateStorage.put(key, buf);
  } catch (e) {
    throw new UserError(e instanceof Error && e.message.startsWith("Хувийн") ? e.message : "Баримт хадгалж чадсангүй. Баримтгүйгээр хадгалаад дараа нь нэмнэ үү.");
  }
  return key;
}

export async function removeReceipt(key: string | null | undefined) {
  if (key) await privateStorage.remove(key).catch(() => undefined);
}
