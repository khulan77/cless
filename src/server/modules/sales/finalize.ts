/**
 * Төлбөр SUCCEEDED болох бүрт дуудагдана (transaction дотор).
 * Idempotent: хэдэн ч удаа (зэрэг ч) дуудсан үлдэгдэл, имэйл нэг л удаа.
 */
import { getNotifySettings } from "@/server/modules/notifications/settings";
import { queueVisitReport } from "@/server/modules/notifications/service";
import type { Prisma } from "@/generated/prisma/client";
import { audit } from "@/server/audit";
import { completeForSale } from "@/server/modules/appointments/complete";
import { enqueue } from "@/server/modules/outbox/service";
import { SETTLED_STATUSES, nextStatus } from "./state";

type Tx = Prisma.TransactionClient;

export type ApplyPaymentResult = {
  status: string;
  paidAmount: number;
  total: number;
  /** Энэ дуудлагаар PAID болсон эсэх (үлдэгдэл хасагдсан) */
  finalized: boolean;
};

export async function applyPayment(tx: Tx, saleId: string, actorId: string | null): Promise<ApplyPaymentResult> {
  // 1. Борлуулалтыг түгжинэ — зэрэг дуудлагууд энд дараалалд орно
  const locked = await tx.$queryRaw<{ id: string; status: string; total: number }[]>`
    SELECT "id", "status"::text AS "status", "total" FROM "Sale" WHERE "id" = ${saleId} FOR UPDATE`;
  const sale = locked[0];
  if (!sale) throw new Error(`Sale ${saleId} not found`);

  // 2. Төлсөн дүнг DB-ээс дахин тооцно (нэмэгдүүлэхгүй)
  const agg = await tx.payment.aggregate({ where: { saleId, status: "SUCCEEDED" }, _sum: { amount: true } });
  const paidAmount = agg._sum.amount ?? 0;

  // 5. Аль хэдийн төлөгдсөн → зөвхөн дүнг синк хийнэ
  if ((SETTLED_STATUSES as readonly string[]).includes(sale.status)) {
    await tx.sale.update({ where: { id: saleId }, data: { paidAmount } });
    return { status: sale.status, paidAmount, total: sale.total, finalized: false };
  }

  const status = nextStatus(sale.status as Parameters<typeof nextStatus>[0], "pay", { total: sale.total, paidAmount });

  // 3. Хэсэгчлэн төлөгдсөн
  if (status !== "PAID") {
    await tx.sale.update({ where: { id: saleId }, data: { paidAmount, status, version: { increment: 1 } } });
    return { status, paidAmount, total: sale.total, finalized: false };
  }

  // 4. Илүү төлөлт: дүнг үлдэгдлээр хязгаарладаг тул зөвхөн гадны (QPay) зөрүүнээс үүснэ
  if (paidAmount > sale.total) {
    await audit(tx, {
      userId: actorId,
      action: "sale.overpaid",
      entity: "Sale",
      entityId: saleId,
      after: { total: sale.total, paidAmount, overpaid: paidAmount - sale.total },
    });
  }

  // 6. PAID — үлдэгдэл хасах (нөөцөөс), бараа бүрт StockMovement
  const full = await tx.sale.findUniqueOrThrow({
    where: { id: saleId },
    select: {
      branchId: true,
      appointmentId: true,
      customer: { select: { id: true, email: true } },
      visit: { select: { id: true } },
      items: { where: { kind: "PRODUCT" }, select: { variantId: true, qty: true, unitCostSnapshot: true } },
    },
  });
  for (const item of full.items) {
    if (!item.variantId) continue;
    await tx.$executeRaw`
      UPDATE "Variant" SET "stock" = "stock" - ${item.qty}, "reserved" = GREATEST("reserved" - ${item.qty}, 0), "updatedAt" = (now() AT TIME ZONE 'UTC')
      WHERE "id" = ${item.variantId}`;
    await tx.stockMovement.create({
      data: {
        branchId: full.branchId,
        variantId: item.variantId,
        type: "SALE",
        qty: -item.qty,
        unitCost: item.unitCostSnapshot,
        saleId,
        createdById: actorId,
      },
    });
  }
  // SERVICE мөрийн орцыг энэ ээлжинд үлдэгдлээс хасахгүй — unitCostSnapshot-д өртөг нь орсон.
  // TODO: мэргэжлийн (салоны) савны зарцуулалтын бүртгэл.

  await tx.sale.update({
    where: { id: saleId },
    data: { status: "PAID", paidAmount, paidAt: new Date(), closedById: actorId, version: { increment: 1 } },
  });

  // Холбогдсон цаг → DONE (яг энэ transaction дотор; idempotent — аль хэдийн DONE/цуцлагдсан бол юу ч хийхгүй)
  if (full.appointmentId) await completeForSale(tx, full.appointmentId, actorId);

  // Айлчлалын имэйл — commit-ийн дараа worker илгээнэ; dedupeKey давхардлаас хамгаална
  if (full.visit) {
    const purchased = full.items.flatMap((i) => (i.variantId ? [i.variantId] : []));
    if (purchased.length) {
      await tx.visitRecommendation.updateMany({ where: { visitId: full.visit.id, variantId: { in: purchased } }, data: { purchased: true } });
    }
    // PROMPT 15 §5: автоматаар илгээх нь тохиргоогоор (анхдагч — унтраатай) бөгөөд үйлчлүүлэгчийн зөвшөөрөлтэй үед л
    const customer = full.customer ? await tx.customer.findUnique({ where: { id: full.customer.id }, select: { email: true, emailConsentAt: true } }) : null;
    if (customer?.email && customer.emailConsentAt && (await getNotifySettings(tx)).autoVisitEmail) {
      await queueVisitReport({ visitId: full.visit.id, actorId }, tx);
    }
  }

  await audit(tx, { userId: actorId, action: "sale.paid", entity: "Sale", entityId: saleId, after: { paidAmount, total: sale.total } });
  return { status: "PAID", paidAmount, total: sale.total, finalized: true };
}
