/**
 * Тайлангийн хуудсыг шалгах ТУРШИЛТЫН борлуулалт — өнгөрсөн 30 хоног (зөвхөн локал dev DB).
 *
 *   bun --preload ./src/worker/preload.ts scripts/seed-demo-sales.ts          # нэмнэ (өмнөх demo-г солино)
 *   bun --preload ./src/worker/preload.ts scripts/seed-demo-sales.ts --clean  # зөвхөн устгана
 *
 * Ажиллахгүй: NODE_ENV=production, "Нээлт хийгдсэн" DB, localhost биш DB.
 * Бүх мөр `number` = "DEMO-…" — ингэж л танигдаж устгагдана. Үлдэгдэл (StockMovement) өөрчлөхгүй.
 */
import { db } from "@/server/db";
import { getCurrentBranch } from "@/server/modules/branches/service";
import { addDays, ubAt, ubDateKey } from "@/lib/time";
import type { PayMethod } from "@/generated/prisma/client";

const clean = process.argv.includes("--clean");

if (process.env.NODE_ENV === "production") throw new Error("NODE_ENV=production үед ажиллахгүй.");
const host = new URL(process.env.DATABASE_URL ?? "postgresql://x@unknown/x").hostname;
if (!["localhost", "127.0.0.1"].includes(host)) throw new Error(`Зөвхөн локал DB (одоо: ${host}).`);
const system = await db.siteSetting.findUnique({ where: { key: "system" } });
if ((system?.value as { launchedAt?: string } | null)?.launchedAt) throw new Error("Нээлт хийгдсэн DB — ажиллахгүй.");

const demo = await db.sale.findMany({ where: { number: { startsWith: "DEMO-" } }, select: { id: true } });
const ids = demo.map((s) => s.id);
await db.$transaction([
  db.refund.deleteMany({ where: { saleId: { in: ids } } }),
  db.payment.deleteMany({ where: { saleId: { in: ids } } }),
  db.saleItem.deleteMany({ where: { saleId: { in: ids } } }),
  db.sale.deleteMany({ where: { id: { in: ids } } }),
]);
console.log(`Өмнөх demo борлуулалт устлаа: ${ids.length}`);
if (clean) process.exit(0);

// Deterministic pseudo-random (same data every run)
let seed = 42;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)]!;

const branch = await getCurrentBranch();
const [admin, staff, services, variants, customers] = await Promise.all([
  db.user.findFirstOrThrow({ where: { role: "ADMIN", isActive: true } }),
  db.user.findMany({ where: { isActive: true, isBookable: true } }),
  db.service.findMany({ where: { isActive: true }, select: { id: true, name: true, price: true } }),
  db.variant.findMany({ where: { isActive: true }, select: { id: true, sku: true, size: true, price: true, costPrice: true, product: { select: { name: true } } } }),
  db.customer.findMany({ select: { id: true }, take: 20 }),
]);
if (!staff.length || !services.length || !variants.length) throw new Error("Seed өгөгдөл (ажилтан/үйлчилгээ/бараа) алга — эхлээд bun run db:seed.");

const today = ubDateKey();
let n = 0;
for (let d = 30; d >= 0; d--) {
  const day = addDays(today, -d);
  const count = 2 + Math.floor(rnd() * 6);
  for (let k = 0; k < count; k++) {
    const at = ubAt(day, `${String(10 + Math.floor(rnd() * 9)).padStart(2, "0")}:${pick(["00", "15", "30", "45"])}`);
    if (at > new Date()) continue;
    const lines: { kind: "SERVICE" | "PRODUCT"; serviceId?: string; variantId?: string; staffId: string | null; name: string; sku?: string; price: number; cost: number; qty: number }[] = [];
    if (rnd() < 0.75) {
      const s = pick(services);
      lines.push({ kind: "SERVICE", serviceId: s.id, staffId: pick(staff).id, name: s.name, price: s.price, cost: Math.round(s.price * 0.12), qty: 1 });
    }
    const products = rnd() < 0.6 ? 1 + Math.floor(rnd() * 2) : lines.length ? 0 : 1;
    for (let i = 0; i < products; i++) {
      const v = pick(variants);
      lines.push({ kind: "PRODUCT", variantId: v.id, staffId: rnd() < 0.5 ? (lines[0]?.staffId ?? null) : null, name: `${v.product.name} · ${v.size}`, sku: v.sku, price: v.price, cost: v.costPrice, qty: 1 + (rnd() < 0.15 ? 1 : 0) });
    }
    const discount = rnd() < 0.2 ? 0.1 : 0;
    const items = lines.map((l, i) => {
      const gross = l.price * l.qty;
      const lineDiscount = Math.round(gross * discount);
      const lineTotal = gross - lineDiscount;
      return {
        kind: l.kind,
        serviceId: l.serviceId ?? null,
        variantId: l.variantId ?? null,
        staffId: l.staffId,
        nameSnapshot: l.name,
        skuSnapshot: l.sku ?? null,
        unitPrice: l.price,
        unitCostSnapshot: l.cost,
        qty: l.qty,
        lineDiscount,
        lineDiscountReason: lineDiscount ? "Demo хөнгөлөлт" : null,
        lineTotal,
        vatAmount: Math.round(lineTotal / 11),
        sortOrder: i,
      };
    });
    const total = items.reduce((s, x) => s + x.lineTotal, 0);
    const partial = d < 3 && rnd() < 0.15;
    const method: PayMethod = pick(["CARD", "CARD", "CASH", "QPAY"]);
    const paid = partial ? Math.round(total / 2) : total;
    const sale = await db.sale.create({
      data: {
        branchId: branch.id,
        number: `DEMO-${day.replaceAll("-", "")}-${String(++n).padStart(4, "0")}`,
        customerId: customers.length ? pick(customers).id : null,
        createdById: admin.id,
        status: partial ? "PARTIALLY_PAID" : "PAID",
        subtotal: total,
        lineDiscountTotal: items.reduce((s, x) => s + x.lineDiscount, 0),
        total,
        vatTotal: items.reduce((s, x) => s + x.vatAmount, 0),
        paidAmount: paid,
        lockedAt: at,
        paidAt: partial ? null : at,
        createdAt: at,
        items: { create: items },
        payments: {
          create: [{ method, amount: paid, status: "SUCCEEDED", idempotencyKey: `demo-${n}`, createdById: admin.id, paidAt: at, ...(method === "CASH" ? { tendered: paid, change: 0 } : {}) }],
        },
      },
      include: { items: true },
    });
    // A few refunds (one product line)
    const prod = sale.items.find((i) => i.kind === "PRODUCT");
    if (!partial && prod && rnd() < 0.06) {
      const amount = Math.round(prod.lineTotal / prod.qty);
      await db.refund.create({
        data: { saleId: sale.id, amount, reason: "Demo буцаалт", status: "COMPLETED", method, requestedById: admin.id, completedAt: at, items: [{ saleItemId: prod.id, qty: 1, amount }] },
      });
      await db.sale.update({ where: { id: sale.id }, data: { status: "PARTIALLY_REFUNDED", refundedAmount: amount } });
    }
  }
}
console.log(`Demo борлуулалт нэмэгдлээ: ${n} (DB: ${host})`);
await db.$disconnect();
