import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";

type Tx = Prisma.TransactionClient | typeof db;

/** Бичих үйлдэл бүрийг бүртгэнэ: хэн, юу, өмнө/дараа. Transaction дотор дуудна. */
export async function audit(
  tx: Tx,
  entry: {
    userId: string;
    action: string;
    entity: string;
    entityId: string;
    before?: unknown;
    after?: unknown;
  },
) {
  await tx.auditLog.create({
    data: {
      userId: entry.userId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      before: toJson(entry.before),
      after: toJson(entry.after),
    },
  });
}

function toJson(v: unknown): Prisma.InputJsonValue | undefined {
  if (v === undefined || v === null) return undefined;
  return JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
}
