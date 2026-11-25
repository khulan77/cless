/** Илгээлтийн түүх (Тохиргоо → Мэдэгдэл): хүлээн авагч маскаар, агуулгагүй */
import type { MessageChannel, MessageStatus } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { maskTarget } from "./mask";

export async function logMessage(e: { channel: MessageChannel; kind: string; to: string; status: MessageStatus; providerId?: string | null; error?: string | null; sandbox?: boolean }) {
  await db.messageLog
    .create({
      data: { channel: e.channel, kind: e.kind, toMask: maskTarget(e.to), status: e.status, providerId: e.providerId ?? null, error: e.error?.slice(0, 300) ?? null, sandbox: e.sandbox ?? false },
    })
    .catch(() => undefined); // түүх бичигдээгүй ч илгээлтийг бүү эвд
}

export async function recentMessages(take = 30) {
  return db.messageLog.findMany({ orderBy: { createdAt: "desc" }, take });
}
