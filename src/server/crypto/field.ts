/**
 * Эмзэг талбарын шифрлэлт (банкны данс г.м.) — AES-256-GCM. Түлхүүр: FIELD_ENCRYPTION_KEY (32 байт, base64).
 * Production-д түлхүүргүй бол алдаа (шифрлэгдээгүй хадгалахгүй). Dev/test-д тогтмол dev түлхүүр.
 * Формат: "v1:<iv b64>:<tag b64>:<ciphertext b64>". Утгыг log-д хэзээ ч бүү гарга.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function key(): Buffer {
  const raw = process.env.FIELD_ENCRYPTION_KEY;
  if (raw) {
    const k = Buffer.from(raw, "base64");
    if (k.length !== 32) throw new Error("FIELD_ENCRYPTION_KEY нь 32 байт (base64) байх ёстой.");
    return k;
  }
  if (process.env.NODE_ENV === "production") throw new Error("FIELD_ENCRYPTION_KEY тохируулаагүй байна.");
  return createHash("sha256").update("cless-dev-field-key").digest();
}

export function encryptField(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}

export function decryptField(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const [v, iv, tag, data] = stored.split(":");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Шифрлэгдсэн утгын формат буруу.");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
}

/** Дэлгэцэнд: сүүлийн 4 орон л */
export function maskAccount(plain: string | null): string {
  if (!plain) return "—";
  const digits = plain.replace(/\s/g, "");
  return digits.length <= 4 ? "••••" : `•••• ${digits.slice(-4)}`;
}
