/**
 * Буцаалт (зөвхөн ADMIN — action дээр sale:refund шалгана).
 * Мөр бүрийн буцаах дүн: нэгжийн хувь floor, сүүлийн нэгж үлдэгдлийг авна —
 * тиймээс мөрийг бүхэлд нь буцаавал яг lineTotal-тай тэнцэнэ.
 * TODO(eBarimt): буцаалтын баримт (refund receipt) — дараагийн шатанд.
 */
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { UserError } from "@/server/errors";
import { requireOpenShiftForUpdate } from "@/server/modules/cash-shifts/service";
import { getPosSettings } from "@/server/modules/settings/pos-settings";
import { nextStatus } from "@/server/modules/sales/state";
import type { SaleStatus } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

export const refundSchema = z.object({
  saleId: z.string().min(1),
  items: z
    .array(z.object({ saleItemId: z.string().min(1), qty: z.number().int().positive() }))
    .min(1, "Буцаах мөрөө сонгоно уу."),
  reason: z.string().trim().min(3, "Шалтгааныг бичнэ үү.").max(500),
  method: z.enum(["CASH", "CARD", "QPAY", "TRANSFER"]),
  /** Савлагаа нээгдээгүй — үлдэгдэлд буцаана. false бол гэмтэлтэй гэж бүртгэнэ. */
  restock: z.boolean().default(false),
});
export type RefundInput = z.input<typeof refundSchema>;

/** n нэгжийн хуримтлагдсан дүн (сүүлийн нэгж үлдэгдлийг авна) */
function cumulative(lineTotal: number, qty: number, n: number) {
  return n >= qty ? lineTotal : Math.floor((lineTotal * n) / qty);
}

/** refundedQty-аас эхлэн q нэгж буцаахад ногдох дүн */
export function refundLineAmount(lineTotal: number, qty: number, alreadyRefunded: number, q: number) {
  return cumulative(lineTotal, qty, alreadyRefunded + q) - cumulative(lineTotal, qty, alreadyRefunded);
}

export async function createRefund(raw: RefundInput, actorId: string) {
  const input = refundSchema.parse(raw);
  const seen = new Set<string>();
  for (const i of input.items) {
    if (seen.has(i.saleItemId)) throw new UserError("Нэг мөрийг давхар сонгосон байна.");
    seen.add(i.saleItemId);
  }

  return db.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<{ status: SaleStatus; paidAmount: number; refundedAmount: number; branchId: string }[]>`
        SELECT "status", "paidAmount", "refundedAmount", "branchId" FROM "Sale" WHERE "id" = ${input.saleId} FOR UPDATE`;
      const sale = rows[0];
      if (!sale) throw new UserError("Борлуулалт олдсонгүй.");
      if (sale.status !== "PAID" && sale.status !== "PARTIALLY_REFUNDED") throw new UserError("Зөвхөн төлөгдсөн борлуулалтыг буцаана.");

      const lines = await tx.saleItem.findMany({ where: { saleId: input.saleId, id: { in: [...seen] } } });
      if (lines.length !== seen.size) throw new UserError("Буцаах мөр олдсонгүй.");

      const parts = input.items.map((i) => {
        const line = lines.find((l) => l.id === i.saleItemId)!;
        const left = line.qty - line.refundedQty;
        if (i.qty > left) throw new UserError(`"${line.nameSnapshot}" — ${left}-аас илүүг буцаах боломжгүй.`);
        return { line, qty: i.qty, amount: refundLineAmount(line.lineTotal, line.qty, line.refundedQty, i.qty) };
      });
      const amount = parts.reduce((s, p) => s + p.amount, 0);
      if (amount <= 0) throw new UserError("Буцаах дүн 0 байна.");
      if (sale.refundedAmount + amount > sale.paidAmount) throw new UserError("Буцаалт төлсөн дүнгээс хэтэрнэ.");

      const refund = await tx.refund.create({
        data: {
          saleId: input.saleId,
          amount,
          reason: input.reason,
          method: input.method,
          restock: input.restock,
          status: "COMPLETED",
          items: parts.map((p) => ({ saleItemId: p.line.id, qty: p.qty, amount: p.amount })),
          requestedById: actorId,
          approvedById: actorId,
          completedAt: new Date(),
        },
      });

      for (const p of parts) {
        await tx.saleItem.update({ where: { id: p.line.id }, data: { refundedQty: { increment: p.qty } } });
        if (p.line.kind !== "PRODUCT" || !p.line.variantId) continue;
        const common = { branchId: sale.branchId, variantId: p.line.variantId, saleId: input.saleId, createdById: actorId, unitCost: p.line.unitCostSnapshot };
        await tx.stockMovement.create({ data: { ...common, type: "RETURN", qty: p.qty, note: `Буцаалт ${refund.id}` } });
        if (input.restock) {
          await tx.variant.update({ where: { id: p.line.variantId }, data: { stock: { increment: p.qty } } });
        } else {
          // Гэмтэлтэй: орлого + зарлага (үлдэгдэл өөрчлөгдөхгүй, түүх үлдэнэ)
          await tx.stockMovement.create({ data: { ...common, type: "ADJUSTMENT", qty: -p.qty, note: "Буцаалт — гэмтэлтэй" } });
        }
      }

      // PROMPT 20: ээлж унтраалттай (анхдагч) бол бэлэн буцаалтад ээлж шаардахгүй
      if (input.method === "CASH" && (await getPosSettings(tx)).cashShiftsEnabled) {
        const shiftId = await requireOpenShiftForUpdate(tx, sale.branchId);
        const shift = await tx.cashShift.findUniqueOrThrow({ where: { id: shiftId }, select: { openingCash: true } });
        const agg = await tx.cashMovement.aggregate({ where: { shiftId }, _sum: { amount: true } });
        if (shift.openingCash + (agg._sum.amount ?? 0) < amount) throw new UserError("Кассанд хүрэлцэх бэлэн мөнгө байхгүй.");
        await tx.cashMovement.create({ data: { shiftId, type: "REFUND", amount: -amount, refundId: refund.id, createdById: actorId } });
      }

      const refundedAmount = sale.refundedAmount + amount;
      const status = nextStatus(sale.status, "refund", { total: 0, paidAmount: sale.paidAmount, refundedAmount });
      await tx.sale.update({ where: { id: input.saleId }, data: { refundedAmount, status, version: { increment: 1 } } });
      await audit(tx, {
        userId: actorId,
        action: "sale.refund",
        entity: "Sale",
        entityId: input.saleId,
        before: { status: sale.status, refundedAmount: sale.refundedAmount },
        after: { status, refundedAmount, refundId: refund.id, amount, method: input.method, restock: input.restock, reason: input.reason },
      });
      return { refund, status };
    },
    { maxWait: 10_000, timeout: 30_000 },
  );
}

export async function refundsForSale(tx: Tx | typeof db, saleId: string) {
  return tx.refund.findMany({ where: { saleId }, orderBy: { createdAt: "asc" }, include: { requestedBy: { select: { name: true } } } });
}
