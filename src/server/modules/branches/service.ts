/**
 * Салбар. Одоогоор нэг салбар ("CL").
 * TODO(multi-branch): хэрэглэгчийг салбарт оноож, сонгосон салбарыг session-оос авна.
 */
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { UserError } from "@/server/errors";

type Client = Prisma.TransactionClient | typeof db;

export const DEFAULT_BRANCH_CODE = "CL";

export async function getCurrentBranch(client: Client = db) {
  const branch =
    (await client.branch.findFirst({ where: { code: DEFAULT_BRANCH_CODE, isActive: true } })) ??
    (await client.branch.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" } }));
  if (!branch) throw new UserError("Идэвхтэй салбар олдсонгүй. Админд хандана уу.");
  return branch;
}
