/**
 * Кассын ээлж. Салбарт нэг л OPEN ээлж (DB-ийн partial unique index).
 * expectedCash = openingCash + Σ CashMovement (бэлэн борлуулалт, буцаалт, мөнгө нэмэх/гаргах).
 */
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { UserError } from "@/server/errors";
import { getCurrentBranch } from "@/server/modules/branches/service";

type Tx = Prisma.TransactionClient;

const money = z.number({ error: "Тоо оруулна уу." }).int("Бүхэл тоо оруулна уу.").min(0, "Сөрөг байж болохгүй.").max(1_000_000_000);

export const openShiftSchema = z.object({ openingCash: money });
export const closeShiftSchema = z.object({
  shiftId: z.string().min(1),
  countedCash: money,
  note: z.string().trim().max(500).nullish(),
});
export const cashMoveSchema = z.object({
  shiftId: z.string().min(1),
  type: z.enum(["PAY_IN", "PAY_OUT"]),
  amount: money.refine((v) => v > 0, "0-ээс их дүн оруулна уу."),
  note: z.string().trim().min(3, "Шалтгааныг бичнэ үү.").max(300),
});

export async function getOpenShift(client: Tx | typeof db, branchId: string) {
  return client.cashShift.findFirst({ where: { branchId, status: "OPEN" } });
}

/** Бэлэн төлбөр / буцаалтад: нээлттэй ээлжийг түгжиж буцаана (хаагдахаас сэргийлнэ) */
export async function requireOpenShiftForUpdate(tx: Tx, branchId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "CashShift" WHERE "branchId" = ${branchId} AND "status" = 'OPEN' FOR UPDATE`;
  if (!rows[0]) throw new UserError("Эхлээд кассаа нээнэ үү.", undefined, "SHIFT_CLOSED");
  return rows[0].id;
}

async function cashBalance(client: Tx | typeof db, shiftId: string, openingCash: number) {
  const agg = await client.cashMovement.aggregate({ where: { shiftId }, _sum: { amount: true } });
  return openingCash + (agg._sum.amount ?? 0);
}

export async function openShift(raw: z.input<typeof openShiftSchema>, actorId: string) {
  const { openingCash } = openShiftSchema.parse(raw);
  const branch = await getCurrentBranch();
  try {
    return await db.$transaction(async (tx) => {
      const shift = await tx.cashShift.create({ data: { branchId: branch.id, openedById: actorId, openingCash } });
      await audit(tx, { userId: actorId, action: "shift.open", entity: "CashShift", entityId: shift.id, after: { openingCash } });
      return shift;
    });
  } catch (e) {
    // CashShift_one_open_per_branch
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new UserError("Энэ салбарт касс аль хэдийн нээлттэй байна.");
    }
    throw e;
  }
}

export async function addCashMovement(raw: z.input<typeof cashMoveSchema>, actor: { id: string; canAll: boolean }) {
  const data = cashMoveSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const shift = await tx.cashShift.findUnique({ where: { id: data.shiftId } });
    if (!shift || shift.status !== "OPEN") throw new UserError("Ээлж нээлттэй биш байна.");
    if (!actor.canAll && shift.openedById !== actor.id) throw new UserError("Зөвхөн өөрийн ээлжид мөнгө нэмэх/гаргах боломжтой.");
    const amount = data.type === "PAY_IN" ? data.amount : -data.amount;
    if (amount < 0 && (await cashBalance(tx, shift.id, shift.openingCash)) + amount < 0) {
      throw new UserError("Кассанд хүрэлцэх бэлэн мөнгө байхгүй.");
    }
    const move = await tx.cashMovement.create({ data: { shiftId: shift.id, type: data.type, amount, note: data.note, createdById: actor.id } });
    await audit(tx, { userId: actor.id, action: `shift.${data.type.toLowerCase()}`, entity: "CashShift", entityId: shift.id, after: { amount, note: data.note } });
    return move;
  });
}

export async function closeShift(raw: z.input<typeof closeShiftSchema>, actor: { id: string; canAll: boolean }) {
  const data = closeShiftSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "CashShift" WHERE "id" = ${data.shiftId} FOR UPDATE`;
    if (!rows[0]) throw new UserError("Ээлж олдсонгүй.");
    const shift = await tx.cashShift.findUniqueOrThrow({ where: { id: data.shiftId } });
    if (shift.status !== "OPEN") throw new UserError("Ээлж аль хэдийн хаагдсан.");
    if (!actor.canAll && shift.openedById !== actor.id) throw new UserError("Зөвхөн өөрийн ээлжийг хаах боломжтой.");
    const expectedCash = await cashBalance(tx, shift.id, shift.openingCash);
    const difference = data.countedCash - expectedCash;
    if (difference !== 0 && !data.note) {
      throw new UserError("Зөрүү гарсан тул тайлбар бичнэ үү.", { note: ["Зөрүүний тайлбар заавал."] });
    }
    const closed = await tx.cashShift.update({
      where: { id: shift.id },
      data: { status: "CLOSED", closedById: actor.id, closedAt: new Date(), expectedCash, countedCash: data.countedCash, difference, note: data.note ?? null },
    });
    await audit(tx, { userId: actor.id, action: "shift.close", entity: "CashShift", entityId: shift.id, after: { expectedCash, countedCash: data.countedCash, difference } });
    return closed;
  });
}

/** Ээлжийн тайлан: аргаар задаргаа, борлуулалтын тоо, буцаалт, хөнгөлөлт */
export async function shiftReport(shiftId: string) {
  const shift = await db.cashShift.findUnique({
    where: { id: shiftId },
    include: { openedBy: { select: { name: true } }, closedBy: { select: { name: true } }, movements: { orderBy: { createdAt: "asc" } } },
  });
  if (!shift) throw new UserError("Ээлж олдсонгүй.");
  const from = shift.openedAt;
  const to = shift.closedAt ?? new Date();

  const [byMethod, sales, refunds] = await Promise.all([
    db.payment.groupBy({
      by: ["method"],
      where: { status: "SUCCEEDED", paidAt: { gte: from, lt: to }, sale: { branchId: shift.branchId } },
      _sum: { amount: true },
      _count: true,
    }),
    db.sale.aggregate({
      where: { branchId: shift.branchId, paidAt: { gte: from, lt: to } },
      _count: true,
      _sum: { total: true, lineDiscountTotal: true, saleDiscount: true },
    }),
    db.refund.aggregate({ where: { status: "COMPLETED", completedAt: { gte: from, lt: to }, sale: { branchId: shift.branchId } }, _count: true, _sum: { amount: true } }),
  ]);

  const expectedCash = shift.expectedCash ?? (await cashBalance(db, shift.id, shift.openingCash));
  return {
    shift,
    expectedCash,
    byMethod: byMethod.map((m) => ({ method: m.method, amount: m._sum.amount ?? 0, count: m._count })),
    salesCount: sales._count,
    salesTotal: sales._sum.total ?? 0,
    discountTotal: (sales._sum.lineDiscountTotal ?? 0) + (sales._sum.saleDiscount ?? 0),
    refundsCount: refunds._count,
    refundsTotal: refunds._sum.amount ?? 0,
  };
}
