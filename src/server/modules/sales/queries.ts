/**
 * POS, борлуулалтын жагсаалт, хянах самбарын уншилтууд (бичихгүй).
 */
import { normBarcode } from "@/lib/validation/product";
import type { Prisma, SaleStatus } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { ubDayRange } from "@/lib/time";

/**
 * POS search. A barcode scanner (keyboard wedge) types the code and presses Enter — an exact SKU or
 * barcode match comes back as `exactSku` and the terminal adds it straight to the cart.
 */
export async function searchPosCatalog(q: string) {
  const term = q.trim();
  const code = normBarcode(term);
  const [variants, services, packages] = await Promise.all([
    db.variant.findMany({
      where: {
        isActive: true,
        ...(term
          ? {
              OR: [
                { sku: { equals: term, mode: "insensitive" } },
                ...(code ? [{ barcode: code }] : []),
                { sku: { contains: term, mode: "insensitive" } },
                { product: { name: { contains: term, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      orderBy: [{ product: { name: "asc" } }, { sortOrder: "asc" }],
      take: 20,
      select: { id: true, sku: true, barcode: true, size: true, price: true, stock: true, reserved: true, product: { select: { name: true, howToUse: true } } },
    }),
    db.service.findMany({
      where: { isActive: true, ...(term ? { name: { contains: term, mode: "insensitive" } } : {}) },
      orderBy: { sortOrder: "asc" },
      take: 20,
      select: { id: true, name: true, price: true, durationMin: true },
    }),
    // PROMPT 27: багц (идэвхтэй загвар)
    db.packageTemplate.findMany({
      where: { isActive: true, ...(term ? { name: { contains: term, mode: "insensitive" } } : {}) },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      take: 10,
      select: { id: true, name: true, price: true, paidSessions: true, bonusSessions: true, validDays: true, services: { select: { serviceId: true }, take: 1 } },
    }),
  ]);
  const isExact = (v: { sku: string; barcode: string | null }) => v.sku.toLowerCase() === term.toLowerCase() || (code !== "" && v.barcode === code);
  const exact = variants.filter(isExact);
  const rest = variants.filter((v) => !isExact(v));
  return {
    products: [...exact, ...rest].map((v) => ({
      id: v.id,
      sku: v.sku,
      name: v.product.name,
      size: v.size,
      price: v.price,
      available: v.stock - v.reserved,
      howToUse: v.product.howToUse,
    })),
    services,
    packages: packages.map((p) => ({ id: p.id, name: p.name, price: p.price, sessions: p.paidSessions + p.bonusSessions, label: `${p.paidSessions}${p.bonusSessions ? `+${p.bonusSessions}` : ""}`, validDays: p.validDays, serviceId: p.services[0]?.serviceId ?? "" })),
    exactSku: exact.length === 1 ? exact[0]!.id : null,
  };
}

export async function listServiceStaff() {
  return db.user.findMany({ where: { isActive: true, role: "STAFF" }, orderBy: { name: "asc" }, select: { id: true, name: true } });
}

/** POS-д нээлттэй (засварт буцаасан эсвэл төлбөр хүлээж буй) борлуулалт */
export async function getPosSale(saleId: string) {
  return db.sale.findUnique({
    where: { id: saleId },
    include: {
      customer: { select: { id: true, name: true, phone: true, email: true } },
      items: { orderBy: { sortOrder: "asc" }, include: { staff: { select: { id: true, name: true } } } },
      payments: { orderBy: { createdAt: "asc" } },
      visit: { select: { id: true } },
    },
  });
}

/** Төлбөр хүлээж буй (менежер буцаж ирж үргэлжлүүлэх) */
export async function openPosSales() {
  return db.sale.findMany({
    where: { status: { in: ["DRAFT", "PENDING_PAYMENT", "PARTIALLY_PAID"] }, channel: "POS" },
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: { id: true, number: true, status: true, total: true, paidAmount: true, updatedAt: true, customer: { select: { name: true } } },
  });
}

export type SalesFilter = { q?: string; status?: SaleStatus; date?: string; from?: string; page?: number };

export async function listSales(f: SalesFilter) {
  const pageSize = 30;
  const page = Math.max(1, f.page ?? 1);
  const where: Prisma.SaleWhereInput = { status: f.status ?? { not: "DRAFT" } };
  if (f.q?.trim()) {
    const q = f.q.trim();
    where.OR = [
      { number: { contains: q, mode: "insensitive" } },
      { customer: { name: { contains: q, mode: "insensitive" } } },
      { customer: { phone: { contains: q } } },
    ];
  }
  if (f.date && /^\d{4}-\d{2}-\d{2}$/.test(f.date)) {
    const { start, end } = ubDayRange(new Date(`${f.date}T12:00:00+08:00`));
    where.createdAt = { gte: start, lt: end };
  } else if (f.from && /^\d{4}-\d{2}-\d{2}$/.test(f.from)) {
    // "7 хоног" / "Энэ сар": тухайн өдрөөс хойш
    where.createdAt = { gte: ubDayRange(new Date(`${f.from}T12:00:00+08:00`)).start };
  }
  const [rows, count] = await Promise.all([
    db.sale.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        number: true,
        status: true,
        total: true,
        paidAmount: true,
        refundedAmount: true,
        createdAt: true,
        customer: { select: { name: true, phone: true } },
        createdBy: { select: { name: true } },
        payments: { where: { status: "SUCCEEDED" }, select: { method: true } },
      },
    }),
    db.sale.count({ where }),
  ]);
  return { rows, count, page, pageSize };
}

export async function getSaleDetail(id: string) {
  return db.sale.findUnique({
    where: { id },
    include: {
      branch: true,
      customer: true,
      createdBy: { select: { name: true } },
      closedBy: { select: { name: true } },
      discountApprovedBy: { select: { name: true } },
      items: { orderBy: { sortOrder: "asc" }, include: { staff: { select: { name: true } }, seller: { select: { id: true, name: true } } } },
      payments: { orderBy: { createdAt: "asc" }, include: { createdBy: { select: { name: true } }, transactions: { select: { providerInvoiceId: true, providerStatus: true } } } },
      refunds: { orderBy: { createdAt: "asc" }, include: { requestedBy: { select: { name: true } } } },
      visit: {
        include: {
          conductedBy: { select: { name: true } },
          recommendations: { orderBy: { sortOrder: "asc" }, include: { variant: { select: { size: true, product: { select: { name: true } } } } } },
        },
      },
    },
  });
}

/** Хянах самбар: өнөөдрийн борлуулалт (UB цагийн бүс) */
export async function todaySummary(now = new Date()) {
  const { start, end } = ubDayRange(now);
  const paidToday = { paidAt: { gte: start, lt: end }, status: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] as SaleStatus[] } };
  const [agg, byMethod, top, visits] = await Promise.all([
    db.sale.aggregate({ where: paidToday, _count: true, _sum: { total: true, refundedAmount: true } }),
    db.payment.groupBy({ by: ["method"], where: { status: "SUCCEEDED", paidAt: { gte: start, lt: end } }, _sum: { amount: true } }),
    db.saleItem.groupBy({
      by: ["nameSnapshot"],
      where: { sale: paidToday },
      _sum: { qty: true, lineTotal: true },
      orderBy: { _sum: { lineTotal: "desc" } },
      take: 5,
    }),
    db.visit.count({ where: { createdAt: { gte: start, lt: end } } }),
  ]);
  return {
    salesCount: agg._count,
    revenue: (agg._sum.total ?? 0) - (agg._sum.refundedAmount ?? 0),
    byMethod: byMethod.map((m) => ({ method: m.method, amount: m._sum.amount ?? 0 })),
    top: top.map((t) => ({ name: t.nameSnapshot, qty: t._sum.qty ?? 0, amount: t._sum.lineTotal ?? 0 })),
    visits,
  };
}
