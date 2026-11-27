"use server";

import { revalidatePath, updateTag } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import type { z } from "zod";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { requirePermission } from "@/server/auth/session";
import { UserError } from "@/server/errors";
import {
  adjustStockSchema,
  receiveStockSchema,
  type AdjustStockInput,
  type ReceiveStockInput,
} from "@/lib/validation/stock";
import { getCurrentBranch } from "@/server/modules/branches/service";
import { issueForService, issueSchema, suggestionsForAppointment } from "@/server/modules/inventory/service-use";
import { parseInput, runAction } from "./result";

/**
 * Variant.stock бол StockMovement-уудын нийлбэрийн кэш. Энд л (ба ирээдүйд
 * борлуулалтын transaction-д) өөрчлөгдөнө: мөрийг FOR UPDATE-ээр түгжиж,
 * movement-тэй нэг transaction дотор.
 */
async function lockVariant(tx: Prisma.TransactionClient, variantId: string) {
  const rows = await tx.$queryRaw<{ id: string; stock: number; reserved: number }[]>`
    SELECT "id", "stock", "reserved" FROM "Variant" WHERE "id" = ${variantId} FOR UPDATE`;
  const row = rows[0];
  if (!row) throw new UserError("Хувилбар олдсонгүй.");
  return row;
}

function refresh(variantId: string) {
  updateTag("catalog");
  revalidatePath("/");
  revalidatePath(`/admin/inventory/${variantId}`);
}

export async function receiveStock(input: ReceiveStockInput) {
  return runAction(async () => {
    const user = await requirePermission("stock:write");
    const data = parseInput(receiveStockSchema, input);

    const stock = await db.$transaction(async (tx) => {
      const before = await lockVariant(tx, data.variantId);
      const updated = await tx.variant.update({
        where: { id: data.variantId },
        data: { stock: { increment: data.qty } },
        select: { stock: true },
      });
      const movement = await tx.stockMovement.create({
        data: {
          branchId: (await getCurrentBranch(tx)).id,
          variantId: data.variantId,
          type: "PURCHASE",
          qty: data.qty,
          unitCost: data.unitCost,
          note: data.note,
          createdById: user.id,
        },
      });
      await audit(tx, {
        userId: user.id,
        action: "stock.purchase",
        entity: "Variant",
        entityId: data.variantId,
        before: { stock: before.stock },
        after: { stock: updated.stock, movementId: movement.id, qty: data.qty, unitCost: data.unitCost },
      });
      return updated.stock;
    });

    refresh(data.variantId);
    return { stock };
  }, "Орлого бүртгэгдлээ.");
}

export async function adjustStock(input: AdjustStockInput) {
  return runAction(async () => {
    const user = await requirePermission("stock:write");
    const data = parseInput(adjustStockSchema, input);

    const stock = await db.$transaction(async (tx) => {
      const before = await lockVariant(tx, data.variantId);
      const diff = data.newQty - before.stock;
      if (diff === 0) throw new UserError("Тоо өөрчлөгдөөгүй байна.");
      if (data.newQty < before.reserved) {
        throw new UserError(`Захиалгад ${before.reserved} ширхэг нөөцлөгдсөн тул үүнээс бага болгох боломжгүй.`, {
          newQty: [`${before.reserved}-аас багагүй.`],
        });
      }
      await tx.variant.update({ where: { id: data.variantId }, data: { stock: data.newQty } });
      const movement = await tx.stockMovement.create({
        data: {
          branchId: (await getCurrentBranch(tx)).id,
          variantId: data.variantId,
          type: "ADJUSTMENT",
          qty: diff,
          note: data.reason,
          createdById: user.id,
        },
      });
      await audit(tx, {
        userId: user.id,
        action: "stock.adjust",
        entity: "Variant",
        entityId: data.variantId,
        before: { stock: before.stock },
        after: { stock: data.newQty, diff, reason: data.reason, movementId: movement.id },
      });
      return data.newQty;
    });

    refresh(data.variantId);
    return { stock };
  }, "Тооллогын засвар хадгалагдлаа.");
}

// ───────── PROMPT 27: үйлчилгээнд олгох (MANAGER, ADMIN) ─────────

export async function issueForServiceAction(input: z.input<typeof issueSchema>) {
  return runAction(async () => {
    const user = await requirePermission("stock:issue");
    const r = await issueForService(parseInput(issueSchema, input), user.id);
    refresh(input.variantId);
    revalidatePath("/admin/inventory");
    revalidatePath("/admin/calendar");
    return r;
  }, "Үйлчилгээнд олголоо — үлдэгдлээс хасагдлаа.");
}

/** «Орсон» цагт санал болгох материал (норм − олгосон) */
export async function serviceUseSuggestionsAction(appointmentId: string) {
  return runAction(async () => {
    await requirePermission("stock:issue");
    return suggestionsForAppointment(String(appointmentId));
  });
}
