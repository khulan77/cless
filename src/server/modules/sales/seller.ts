/**
 * Бүтээгдэхүүний мөрийн "Зарсан" ажилтан (PROMPT 14 §5).
 *  - setItemSeller: борлуулалтын дараа ADMIN / MANAGER засна (sale:seller), AuditLog-д. Тухайн өдрийн цалин
 *    батлагдсан бол хориглоно (урамшуулал олгогдсон); ноорог үеийн тооцоог хуучруулна.
 *  - backfillSellers: хуучин мөрөнд (sellerId = NULL) цагийн / үйлчилгээний ажилтнаас нөхнө (LEGACY_SELLER).
 *    Production-д зөвхөн зөвшөөрлөөр (scripts/backfill-sellers.ts).
 */
import type { Prisma } from "@/generated/prisma/client";
import { ubDateKey } from "@/lib/time";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { UserError } from "@/server/errors";
import { invalidateDay, lockedPeriodFor } from "@/server/modules/payroll/locks";
import { LEGACY_SELLER } from "@/server/modules/reports/attribution";

export async function setItemSeller(itemId: string, sellerId: string | null, actorId: string) {
  const item = await db.saleItem.findUnique({ where: { id: itemId }, select: { id: true, kind: true, sellerId: true, saleId: true, sale: { select: { paidAt: true } } } });
  if (!item || item.kind !== "PRODUCT") throw new UserError("Бүтээгдэхүүний мөр олдсонгүй.");
  if (sellerId) {
    const u = await db.user.findUnique({ where: { id: sellerId }, select: { isActive: true, role: true } });
    if (!u || !u.isActive || u.role === "ACCOUNTANT") throw new UserError("Ажилтан буруу байна.");
  }
  const day = item.sale.paidAt ? ubDateKey(item.sale.paidAt) : null;
  if (day && (await lockedPeriodFor(day))) throw new UserError("Энэ өдрийн цалин батлагдсан тул зарсан ажилтныг өөрчлөх боломжгүй.");
  await db.$transaction(async (tx) => {
    await tx.saleItem.update({ where: { id: itemId }, data: { sellerId } });
    if (day) await invalidateDay(day, tx);
    await audit(tx, { userId: actorId, action: "sale.seller", entity: "SaleItem", entityId: itemId, before: { sellerId: item.sellerId }, after: { sellerId } });
  });
}

/** Хуучин бүтээгдэхүүний мөрөнд зарсан ажилтныг нөхнө. dryRun — зөвхөн тоолно. Буцаана: { candidates, filled } */
export async function backfillSellers(opts: { dryRun: boolean }, client: Prisma.TransactionClient | typeof db = db) {
  const [{ n }] = await client.$queryRaw<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM "SaleItem" i JOIN "Sale" s ON s."id" = i."saleId"
    WHERE i."kind"::text = 'PRODUCT' AND i."sellerId" IS NULL AND ${LEGACY_SELLER} IS NOT NULL`;
  if (opts.dryRun) return { candidates: n, filled: 0 };
  const filled = await client.$executeRaw`
    UPDATE "SaleItem" AS t SET "sellerId" = x.seller
    FROM (
      SELECT i."id", ${LEGACY_SELLER} AS seller FROM "SaleItem" i JOIN "Sale" s ON s."id" = i."saleId"
      WHERE i."kind"::text = 'PRODUCT' AND i."sellerId" IS NULL
    ) x
    WHERE t."id" = x."id" AND x.seller IS NOT NULL`;
  return { candidates: n, filled };
}
