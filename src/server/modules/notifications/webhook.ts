/**
 * WeSend webhook (PROMPT 15 §1). Гарын үсэг: "WeSend-Signature: t=<unix>,v1=<hex>",
 * v1 = HMAC-SHA256(WESEND_WEBHOOK_SECRET, `${t}.${rawBody}`), t нь ±5 минут. Үйл явдлыг id-аар давхардуулахгүй.
 * WeSend одоогоор зөвхөн үлдэгдэл / домэйны үйл явдал илгээдэг (мессеж бүрийн хүргэлт биш) — хүргэлтийн төлөвийг
 * Тохиргоо → Мэдэгдэл-д харуулахаар хадгална.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";

export const TOLERANCE_SEC = 300;

export function verifySignature(rawBody: string, header: string | null, secret: string, nowSec = Math.floor(Date.now() / 1000)): boolean {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.trim().split("=", 2) as [string, string]));
  const t = Number(parts.t);
  const v1 = parts.v1;
  if (!Number.isFinite(t) || !v1 || !/^[0-9a-f]+$/i.test(v1)) return false;
  if (Math.abs(nowSec - t) > TOLERANCE_SEC) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest();
  const got = Buffer.from(v1, "hex");
  return got.length === expected.length && timingSafeEqual(got, expected);
}

const KEY = "wesend-events";
type Stored = { ids: string[]; last: { id: string; type: string; createdAt: string; data: unknown }[] };

/** Сүүлийн 20 үйл явдлыг хадгална; давтагдсан id-г үл тооно. Буцаана: шинэ эсэх */
export async function recordEvent(evt: { id: string; type: string; createdAt?: string; data?: unknown }) {
  return db.$transaction(async (tx) => {
    const row = await tx.siteSetting.findUnique({ where: { key: KEY } });
    const cur = (row?.value as Stored | undefined) ?? { ids: [], last: [] };
    if (cur.ids.includes(evt.id)) return false;
    const next: Stored = {
      ids: [evt.id, ...cur.ids].slice(0, 200),
      last: [{ id: evt.id, type: evt.type, createdAt: evt.createdAt ?? new Date().toISOString(), data: evt.data ?? null }, ...cur.last].slice(0, 20),
    };
    const value = next as unknown as Prisma.InputJsonValue;
    await tx.siteSetting.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } });
    return true;
  });
}

export async function recentEvents() {
  const row = await db.siteSetting.findUnique({ where: { key: KEY } });
  return ((row?.value as Stored | undefined) ?? { ids: [], last: [] }).last;
}
