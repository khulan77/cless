/**
 * Борлуулалт: checkout (DRAFT хадгалах + lock), unlock, cancel.
 * Next.js-ээс хамааралгүй — server action нь эрх шалгаад энд дуудна.
 */
import bcrypt from "bcryptjs";
import type { Prisma, Role } from "@/generated/prisma/client";
import { audit } from "@/server/audit";
import { can } from "@/server/auth/permissions";
import { isLoginBlocked, recordLoginAttempt } from "@/server/auth/rate-limit";
import { db } from "@/server/db";
import { UserError } from "@/server/errors";
import { getCurrentBranch } from "@/server/modules/branches/service";
import { enqueue } from "@/server/modules/outbox/service";
import { getPosSettings, getTaxSettings } from "@/server/modules/settings/pos-settings";
import { ubDateKey } from "@/lib/ub-time";
import { applyPayment } from "./finalize";
import { exceedsDiscountLimit, priceSale, type PricingResult } from "./pricing";
import { approvalSchema, cartSchema, toDiscountInput, type ApprovalInput, type Cart, type CartInput } from "./schema";
import { nextStatus } from "./state";

type Tx = Prisma.TransactionClient;
export type Actor = { id: string; role: Role };

const TX_OPTS = { maxWait: 10_000, timeout: 30_000 } as const;

export const APPROVAL_REQUIRED = "DISCOUNT_APPROVAL_REQUIRED";

// ─────────────────────────── Үнийг DB-ээс ───────────────────────────

type ResolvedLine = {
  kind: "SERVICE" | "PRODUCT";
  variantId: string | null;
  serviceId: string | null;
  staffId: string | null;
  nameSnapshot: string;
  skuSnapshot: string | null;
  unitPrice: number;
  unitCostSnapshot: number;
  qty: number;
  lineDiscountReason: string | null;
};

/** Мөр бүрийн үнэ, нэр, өртгийг DB-ээс уншина (client-ийн үнийг үл тооно) */
async function resolveLines(client: Tx | typeof db, cart: Cart): Promise<ResolvedLine[]> {
  const variantIds = cart.items.flatMap((i) => (i.kind === "PRODUCT" && i.variantId ? [i.variantId] : []));
  const serviceIds = cart.items.flatMap((i) => (i.kind === "SERVICE" && i.serviceId ? [i.serviceId] : []));
  const staffIds = cart.items.flatMap((i) => (i.kind === "SERVICE" && i.staffId ? [i.staffId] : []));

  const [variants, services, staff] = await Promise.all([
    client.variant.findMany({
      where: { id: { in: variantIds } },
      select: { id: true, sku: true, size: true, price: true, costPrice: true, isActive: true, product: { select: { name: true, kind: true } } },
    }),
    client.service.findMany({
      where: { id: { in: serviceIds } },
      select: {
        id: true,
        name: true,
        price: true,
        isActive: true,
        consumables: { select: { qtyPerService: true, variant: { select: { costPrice: true } } } },
      },
    }),
    client.user.findMany({ where: { id: { in: staffIds } }, select: { id: true, role: true, isActive: true } }),
  ]);
  const vMap = new Map(variants.map((v) => [v.id, v]));
  const sMap = new Map(services.map((s) => [s.id, s]));
  const staffMap = new Map(staff.map((u) => [u.id, u]));

  return cart.items.map((item, i) => {
    if (item.kind === "PRODUCT") {
      const v = vMap.get(item.variantId!);
      if (!v || !v.isActive) throw new UserError("Бүтээгдэхүүн олдсонгүй эсвэл идэвхгүй байна.", { [`items.${i}.variantId`]: ["Идэвхгүй."] });
      if (v.product.kind === "BUNDLE") throw new UserError(`${v.product.name}: багцыг POS-оор зарахгүй.`);
      return {
        kind: "PRODUCT",
        variantId: v.id,
        serviceId: null,
        staffId: null,
        nameSnapshot: `${v.product.name} · ${v.size}`,
        skuSnapshot: v.sku,
        unitPrice: v.price,
        unitCostSnapshot: v.costPrice,
        qty: item.qty,
        lineDiscountReason: item.lineDiscountReason ?? null,
      };
    }
    const s = sMap.get(item.serviceId!);
    if (!s || !s.isActive) throw new UserError("Үйлчилгээ олдсонгүй эсвэл идэвхгүй байна.", { [`items.${i}.serviceId`]: ["Идэвхгүй."] });
    const staffUser = item.staffId ? staffMap.get(item.staffId) : undefined;
    if (!staffUser || !staffUser.isActive || staffUser.role !== "STAFF") {
      throw new UserError(`${s.name}: үйлчилгээ хийсэн ажилтныг сонгоно уу.`, { [`items.${i}.staffId`]: ["Ажилтан сонгоно уу."] });
    }
    // Орцын өртөг: Σ савны хэсэг × хувилбарын өртөг (үйлчилгээний ашгийн тайланд)
    const consumableCost = Math.round(s.consumables.reduce((sum, c) => sum + c.qtyPerService * c.variant.costPrice, 0));
    return {
      kind: "SERVICE",
      variantId: null,
      serviceId: s.id,
      staffId: staffUser.id,
      nameSnapshot: s.name,
      skuSnapshot: null,
      unitPrice: s.price,
      unitCostSnapshot: consumableCost,
      qty: item.qty,
      lineDiscountReason: item.lineDiscountReason ?? null,
    };
  });
}

async function price(client: Tx | typeof db, cart: Cart, lines: ResolvedLine[]): Promise<PricingResult> {
  const tax = await getTaxSettings(client);
  return priceSale({
    vatIncluded: tax.vatIncluded,
    vatRateBp: tax.vatRateBp,
    lines: lines.map((l, i) => ({ key: String(i), unitPrice: l.unitPrice, qty: l.qty, lineDiscount: toDiscountInput(cart.items[i]!.lineDiscount) })),
    saleDiscount: toDiscountInput(cart.saleDiscount),
  });
}

// ─────────────────────────── Хөнгөлөлтийн баталгаажуулалт ───────────────────────────

/**
 * ADMIN-ий имэйл + нууц үгийг шалгана (transaction-ээс ГАДУУР — амжилтгүй
 * оролдлогыг rate limit-д бичихийн тулд). Буруу бол алдаа, зөв бол ADMIN-ий id.
 */
export async function verifyAdminApproval(raw: ApprovalInput): Promise<string> {
  const { email, password } = approvalSchema.parse(raw);
  const key = "pos-discount-approval";
  if (await isLoginBlocked(key, email)) throw new UserError("Хэт олон удаа буруу оролдлоо. 15 минутын дараа дахин оролдоно уу.");
  const admin = await db.user.findUnique({ where: { email }, select: { id: true, role: true, isActive: true, passwordHash: true } });
  const ok = Boolean(admin && admin.isActive && admin.role === "ADMIN" && (await bcrypt.compare(password, admin.passwordHash)));
  await recordLoginAttempt(key, email, ok);
  if (!ok || !admin) throw new UserError("Админы имэйл эсвэл нууц үг буруу байна.", { approval: ["Баталгаажуулалт амжилтгүй."] });
  return admin.id;
}

// ─────────────────────────── Дугаарлалт ───────────────────────────

/** "CL-20261201-0001" — transaction дотор; rollback бол тоолуур ч буцна (цоорхойгүй) */
export async function nextSaleNumber(tx: Tx, branch: { id: string; code: string }, at = new Date()): Promise<string> {
  const day = ubDateKey(at);
  const rows = await tx.$queryRaw<{ lastNumber: number }[]>`
    INSERT INTO "SaleCounter" ("branchId", "date", "lastNumber") VALUES (${branch.id}, ${day}::date, 1)
    ON CONFLICT ("branchId", "date") DO UPDATE SET "lastNumber" = "SaleCounter"."lastNumber" + 1
    RETURNING "lastNumber"`;
  return `${branch.code}-${day.replaceAll("-", "")}-${String(rows[0]!.lastNumber).padStart(4, "0")}`;
}

// ─────────────────────────── Нөөц ───────────────────────────

function qtyByVariant(items: { variantId: string | null; qty: number }[]) {
  const map = new Map<string, number>();
  for (const i of items) if (i.variantId) map.set(i.variantId, (map.get(i.variantId) ?? 0) + i.qty);
  return map;
}

async function reserve(tx: Tx, items: { variantId: string | null; qty: number; nameSnapshot: string }[], allowNegative: boolean) {
  for (const [variantId, qty] of qtyByVariant(items)) {
    const count = allowNegative
      ? await tx.$executeRaw`UPDATE "Variant" SET "reserved" = "reserved" + ${qty}, "updatedAt" = (now() AT TIME ZONE 'UTC') WHERE "id" = ${variantId}`
      : await tx.$executeRaw`
          UPDATE "Variant" SET "reserved" = "reserved" + ${qty}, "updatedAt" = (now() AT TIME ZONE 'UTC')
          WHERE "id" = ${variantId} AND "stock" - "reserved" >= ${qty}`;
    if (count === 0) {
      const name = items.find((i) => i.variantId === variantId)?.nameSnapshot ?? variantId;
      throw new UserError(`Үлдэгдэл хүрэлцэхгүй: ${name}`);
    }
  }
}

async function release(tx: Tx, saleId: string) {
  const items = await tx.saleItem.findMany({ where: { saleId, kind: "PRODUCT" }, select: { variantId: true, qty: true } });
  for (const [variantId, qty] of qtyByVariant(items)) {
    await tx.$executeRaw`UPDATE "Variant" SET "reserved" = GREATEST("reserved" - ${qty}, 0), "updatedAt" = (now() AT TIME ZONE 'UTC') WHERE "id" = ${variantId}`;
  }
}

async function lockSaleRow(tx: Tx, saleId: string) {
  const rows = await tx.$queryRaw<{ id: string; status: string; branchId: string; number: string | null; total: number }[]>`
    SELECT "id", "status"::text AS "status", "branchId", "number", "total" FROM "Sale" WHERE "id" = ${saleId} FOR UPDATE`;
  if (!rows[0]) throw new UserError("Борлуулалт олдсонгүй.");
  return rows[0] as { id: string; status: Parameters<typeof nextStatus>[0]; branchId: string; number: string | null; total: number };
}

async function succeededAmount(tx: Tx, saleId: string) {
  const agg = await tx.payment.aggregate({ where: { saleId, status: "SUCCEEDED" }, _sum: { amount: true } });
  return agg._sum.amount ?? 0;
}

/** Хүлээгдэж буй QPay invoice-уудыг цуцлах (гадны дуудлагыг worker хийнэ) */
async function cancelOpenPayments(tx: Tx, saleId: string) {
  const open = await tx.payment.findMany({
    where: { saleId, status: { in: ["PENDING", "PROCESSING"] } },
    select: { id: true, transactions: { select: { providerInvoiceId: true } } },
  });
  for (const p of open) {
    await tx.payment.update({ where: { id: p.id }, data: { status: "CANCELLED" } });
    for (const t of p.transactions) {
      await enqueue(tx, { type: "QPAY_CANCEL_INVOICE", payload: { invoiceId: t.providerInvoiceId }, dedupeKey: `qpay-cancel:${t.providerInvoiceId}` });
    }
  }
}

// ─────────────────────────── Checkout = DRAFT хадгалах + lock ───────────────────────────

export type CheckoutResult = { saleId: string; number: string; total: number; status: string };

export async function checkout(raw: CartInput, actor: Actor, approval?: ApprovalInput | null): Promise<CheckoutResult> {
  const cart = cartSchema.parse(raw);
  const pos = await getPosSettings();

  // Хязгаар хэтэрсэн эсэхийг transaction-ээс өмнө (зөвхөн уншина) — баталгаажуулалт шаардлагатай эсэх
  let approverId: string | null = null;
  const preview = await price(db, cart, await resolveLines(db, cart));
  if (exceedsDiscountLimit(preview, pos.maxManagerDiscountPercent)) {
    if (can(actor.role, "discount:over-limit")) approverId = actor.id;
    else if (approval) approverId = await verifyAdminApproval(approval);
    else {
      throw new UserError(
        `Хөнгөлөлт ${pos.maxManagerDiscountPercent}%-иас хэтэрсэн тул админы баталгаажуулалт шаардлагатай.`,
        undefined,
        APPROVAL_REQUIRED,
      );
    }
  }

  return db.$transaction(async (tx) => {
    const branch = await getCurrentBranch(tx);

    // DRAFT борлуулалт: байгааг түгжих эсвэл шинээр
    let saleId: string;
    let number: string | null = null;
    if (cart.saleId) {
      const row = await lockSaleRow(tx, cart.saleId);
      if (row.status !== "DRAFT") throw new UserError("Энэ борлуулалтыг засах боломжгүй (ноорог биш).");
      saleId = row.id;
      number = row.number; // unlock хийгдсэн бол дугаараа хадгална
      await tx.saleItem.deleteMany({ where: { saleId } });
    } else {
      saleId = (await tx.sale.create({ data: { branchId: branch.id, channel: "POS", createdById: actor.id }, select: { id: true } })).id;
    }

    // Дахин DB-ээс уншиж тооцно (preview-ээс хойш үнэ өөрчлөгдсөн байж болно)
    const lines = await resolveLines(tx, cart);
    const priced = await price(tx, cart, lines);
    if (exceedsDiscountLimit(priced, pos.maxManagerDiscountPercent) && !approverId) {
      throw new UserError("Хөнгөлөлт хязгаараас хэтэрсэн тул админы баталгаажуулалт шаардлагатай.", undefined, APPROVAL_REQUIRED);
    }

    if (cart.customerId) {
      const c = await tx.customer.findUnique({ where: { id: cart.customerId }, select: { id: true } });
      if (!c) throw new UserError("Үйлчлүүлэгч олдсонгүй.");
    }

    await tx.saleItem.createMany({
      data: lines.map((l, i) => {
        const p = priced.lines[i]!;
        return {
          saleId,
          kind: l.kind,
          variantId: l.variantId,
          serviceId: l.serviceId,
          staffId: l.staffId,
          nameSnapshot: l.nameSnapshot,
          skuSnapshot: l.skuSnapshot,
          unitPrice: l.unitPrice,
          unitCostSnapshot: l.unitCostSnapshot,
          qty: l.qty,
          lineDiscount: p.lineDiscount,
          lineDiscountReason: p.lineDiscount > 0 ? l.lineDiscountReason : null,
          allocatedSaleDiscount: p.allocatedSaleDiscount,
          lineTotal: p.lineTotal,
          vatAmount: p.vatAmount,
          sortOrder: i,
        };
      }),
    });

    await reserve(tx, lines, pos.allowNegativeStock);

    number ??= await nextSaleNumber(tx, branch);
    const status = nextStatus("DRAFT", "lock");
    await tx.sale.update({
      where: { id: saleId },
      data: {
        number,
        status,
        customerId: cart.customerId ?? null,
        appointmentId: cart.appointmentId ?? null,
        subtotal: priced.subtotal,
        lineDiscountTotal: priced.lineDiscountTotal,
        saleDiscount: priced.saleDiscount,
        saleDiscountReason: priced.saleDiscount > 0 ? (cart.saleDiscountReason ?? null) : null,
        discountApprovedById: approverId,
        total: priced.total,
        vatTotal: priced.vatTotal,
        note: cart.note ?? null,
        lockedAt: new Date(),
        version: { increment: 1 },
      },
    });

    if (cart.visitId) {
      const visit = await tx.visit.findUnique({ where: { id: cart.visitId }, select: { id: true, saleId: true, customerId: true } });
      if (!visit) throw new UserError("Айлчлал олдсонгүй.");
      if (visit.saleId && visit.saleId !== saleId) throw new UserError("Энэ айлчлал өөр борлуулалттай холбогдсон байна.");
      await tx.visit.update({ where: { id: visit.id }, data: { saleId } });
    }

    await audit(tx, {
      userId: actor.id,
      action: "sale.lock",
      entity: "Sale",
      entityId: saleId,
      after: { number, total: priced.total, subtotal: priced.subtotal, discountBp: priced.discountBp, approvedBy: approverId },
    });
    if (approverId && approverId !== actor.id) {
      await audit(tx, { userId: approverId, action: "sale.discount_approved", entity: "Sale", entityId: saleId, after: { discountBp: priced.discountBp, by: actor.id } });
    }

    // 100% хөнгөлөлттэй борлуулалт — төлбөргүйгээр дуусна
    let finalStatus: string = status;
    if (priced.total === 0) finalStatus = (await applyPayment(tx, saleId, actor.id)).status;

    return { saleId, number, total: priced.total, status: finalStatus };
  }, TX_OPTS);
}

/** PENDING_PAYMENT → DRAFT (төлбөр 0 үед). Нөөц суллагдана, дугаар хадгалагдана. */
export async function unlock(saleId: string, actorId: string | null, reason = "manual") {
  return db.$transaction(async (tx) => {
    const row = await lockSaleRow(tx, saleId);
    const status = nextStatus(row.status, "unlock", { total: row.total, paidAmount: await succeededAmount(tx, saleId) });
    await release(tx, saleId);
    await cancelOpenPayments(tx, saleId);
    await tx.sale.update({ where: { id: saleId }, data: { status, lockedAt: null, version: { increment: 1 } } });
    await audit(tx, { userId: actorId, action: "sale.unlock", entity: "Sale", entityId: saleId, after: { reason } });
    return { status };
  }, TX_OPTS);
}

/** DRAFT / PENDING_PAYMENT → CANCELLED (төлбөр 0 үед) */
export async function cancel(saleId: string, actorId: string) {
  return db.$transaction(async (tx) => {
    const row = await lockSaleRow(tx, saleId);
    const status = nextStatus(row.status, "cancel", { total: row.total, paidAmount: await succeededAmount(tx, saleId) });
    if (row.status === "PENDING_PAYMENT") await release(tx, saleId);
    await cancelOpenPayments(tx, saleId);
    await tx.visit.updateMany({ where: { saleId }, data: { saleId: null } });
    await tx.sale.update({ where: { id: saleId }, data: { status, cancelledAt: new Date(), version: { increment: 1 } } });
    await audit(tx, { userId: actorId, action: "sale.cancel", entity: "Sale", entityId: saleId, before: { status: row.status } });
    return { status };
  }, TX_OPTS);
}

/** Worker: төлбөргүй гацсан PENDING_PAYMENT-ийг буцаана */
export async function unlockStaleSales(olderThanMinutes: number, now = new Date()): Promise<string[]> {
  const cutoff = new Date(now.getTime() - olderThanMinutes * 60_000);
  const stale = await db.sale.findMany({
    where: {
      status: "PENDING_PAYMENT",
      lockedAt: { lt: cutoff },
      payments: { none: { status: { in: ["SUCCEEDED", "PROCESSING", "PENDING"] } } },
    },
    select: { id: true },
  });
  const done: string[] = [];
  for (const s of stale) {
    try {
      await unlock(s.id, null, `auto: ${olderThanMinutes} минут төлбөргүй`);
      done.push(s.id);
    } catch {
      // Зэрэг төлбөр орж ирсэн бол алгасна
    }
  }
  return done;
}
