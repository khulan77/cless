/**
 * Тайлан — ЗӨВХӨН уншина. Тодорхойлолт: ./definitions.ts.
 * Мөрийн задаргаа нэг SQL groupBy (өдөр × төрөл × үйлчилгээ/хувилбар × ажилтан); бусад нь зэрэг
 * ажиллах aggregate. N+1 үгүй.
 */
import { Prisma, type PayMethod } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { getCurrentBranch } from "@/server/modules/branches/service";
import { REPORT_SALE_STATUSES, daysOf, rangeBounds, type ReportRange } from "./definitions";

type LineRow = {
  day: string;
  kind: "SERVICE" | "PRODUCT";
  serviceId: string | null;
  variantId: string | null;
  staffId: string | null;
  name: string;
  qty: number;
  amount: number;
  vat: number;
  cost: number;
};

export type ReportKpi = {
  total: number;
  /** НӨАТ-гүй */
  net: number;
  service: number;
  product: number;
  serviceQty: number;
  productQty: number;
  sales: number;
  average: number;
  refunds: number;
  refundCount: number;
  pending: number;
  pendingCount: number;
  done: number;
  noShow: number;
  cancelled: number;
};

export type BreakdownRow = { key: string; name: string; qty: number; amount: number; margin?: number | null };
export type StaffRow = { key: string; name: string | null; amount: number; service: number; product: number; services: BreakdownRow[] };

export type Report = {
  range: ReportRange;
  kpi: ReportKpi;
  days: { day: string; service: number; product: number }[];
  byService: BreakdownRow[];
  byStaff: StaffRow[];
  byProduct: BreakdownRow[];
  payments: { method: PayMethod; amount: number }[];
};

export async function loadReport(range: ReportRange, opts: { canCost: boolean }): Promise<Report> {
  const branch = await getCurrentBranch();
  const { start, end } = rangeBounds(range);
  const saleWhere = { branchId: branch.id, status: { in: [...REPORT_SALE_STATUSES] }, paidAt: { gte: start, lt: end } } satisfies Prisma.SaleWhereInput;

  const [rows, sales, refunds, payments, refundsByMethod, pending, appts] = await Promise.all([
    db.$queryRaw<LineRow[]>(Prisma.sql`
      WITH s AS (
        SELECT "id", "paidAt" FROM "Sale"
        WHERE "branchId" = ${branch.id}
          AND "status"::text IN ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED')
          AND "paidAt" >= ${start} AND "paidAt" < ${end}
      ),
      r AS (
        SELECT (e->>'saleItemId') AS "itemId", SUM((e->>'qty')::int) AS qty, SUM((e->>'amount')::int) AS amount
        FROM "Refund" rf
        JOIN s ON s."id" = rf."saleId"
        CROSS JOIN LATERAL jsonb_array_elements(rf."items") e
        WHERE rf."status"::text = 'COMPLETED'
        GROUP BY 1
      )
      SELECT
        to_char((s."paidAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ulaanbaatar', 'YYYY-MM-DD') AS day,
        i."kind"::text AS kind,
        i."serviceId", i."variantId", i."staffId",
        MAX(i."nameSnapshot") AS name,
        SUM(i."qty" - COALESCE(r.qty, 0))::int AS qty,
        SUM(i."lineTotal" - COALESCE(r.amount, 0))::int AS amount,
        SUM(CASE WHEN i."lineTotal" > 0 THEN i."vatAmount"::float8 * (i."lineTotal" - COALESCE(r.amount, 0)) / i."lineTotal" ELSE 0 END)::float8 AS vat,
        SUM(i."unitCostSnapshot"::float8 * (i."qty" - COALESCE(r.qty, 0)))::float8 AS cost
      FROM "SaleItem" i
      JOIN s ON s."id" = i."saleId"
      LEFT JOIN r ON r."itemId" = i."id"
      GROUP BY 1, 2, 3, 4, 5
    `),
    db.sale.count({ where: saleWhere }),
    db.refund.aggregate({ where: { status: "COMPLETED", sale: saleWhere }, _count: true, _sum: { amount: true } }),
    db.payment.groupBy({ by: ["method"], where: { status: "SUCCEEDED", sale: saleWhere }, _sum: { amount: true } }),
    db.refund.groupBy({ by: ["method"], where: { status: "COMPLETED", sale: saleWhere }, _sum: { amount: true } }),
    db.sale.aggregate({
      where: { branchId: branch.id, status: "PARTIALLY_PAID", createdAt: { gte: start, lt: end } },
      _count: true,
      _sum: { total: true, paidAmount: true },
    }),
    db.appointment.groupBy({
      by: ["status"],
      where: { startsAt: { gte: start, lt: end }, status: { in: ["DONE", "NO_SHOW", "CANCELLED"] } },
      _count: true,
    }),
  ]);

  // ── KPI ──
  let service = 0, product = 0, serviceQty = 0, productQty = 0, vat = 0;
  for (const r of rows) {
    if (r.kind === "SERVICE") {
      service += r.amount;
      serviceQty += r.qty;
    } else {
      product += r.amount;
      productQty += r.qty;
    }
    vat += r.vat;
  }
  const total = service + product;
  const count = (s: string) => appts.find((a) => a.status === s)?._count ?? 0;
  const kpi: ReportKpi = {
    total,
    net: Math.round(total - vat),
    service,
    product,
    serviceQty,
    productQty,
    sales,
    average: sales ? Math.round(total / sales) : 0,
    refunds: refunds._sum.amount ?? 0,
    refundCount: refunds._count,
    pending: (pending._sum.total ?? 0) - (pending._sum.paidAmount ?? 0),
    pendingCount: pending._count,
    done: count("DONE"),
    noShow: count("NO_SHOW"),
    cancelled: count("CANCELLED"),
  };

  // ── Days ──
  const byDay = new Map(daysOf(range).map((d) => [d, { day: d, service: 0, product: 0 }]));
  for (const r of rows) {
    const d = byDay.get(r.day);
    if (d) d[r.kind === "SERVICE" ? "service" : "product"] += r.amount;
  }

  // ── Breakdowns ──
  const add = (map: Map<string, BreakdownRow & { cost: number }>, key: string, name: string, r: LineRow) => {
    const x = map.get(key) ?? { key, name, qty: 0, amount: 0, cost: 0 };
    x.qty += r.qty;
    x.amount += r.amount;
    x.cost += r.cost;
    map.set(key, x);
  };
  const svc = new Map<string, BreakdownRow & { cost: number }>();
  const prod = new Map<string, BreakdownRow & { cost: number }>();
  const staff = new Map<string, StaffRow & { svc: Map<string, BreakdownRow & { cost: number }> }>();
  for (const r of rows) {
    if (r.kind === "SERVICE") add(svc, r.serviceId ?? r.name, r.name, r);
    else add(prod, r.variantId ?? r.name, r.name, r);
    const key = r.staffId ?? "none";
    const s = staff.get(key) ?? { key, name: null, amount: 0, service: 0, product: 0, services: [], svc: new Map() };
    s.amount += r.amount;
    if (r.kind === "SERVICE") {
      s.service += r.amount;
      add(s.svc, r.serviceId ?? r.name, r.name, r);
    } else s.product += r.amount;
    staff.set(key, s);
  }
  const staffIds = [...staff.keys()].filter((k) => k !== "none");
  const users = staffIds.length ? await db.user.findMany({ where: { id: { in: staffIds } }, select: { id: true, name: true } }) : [];
  const sorted = <T extends { amount: number }>(xs: Iterable<T>) => [...xs].filter((x) => x.amount !== 0 || ("qty" in x && (x as { qty: number }).qty !== 0)).sort((a, b) => b.amount - a.amount);
  const strip = ({ cost, ...x }: BreakdownRow & { cost: number }, withMargin: boolean): BreakdownRow =>
    withMargin ? { ...x, margin: x.amount > 0 ? Math.round(((x.amount - cost) / x.amount) * 1000) / 10 : null } : x;

  // ── Payment methods (net of refunds by method) ──
  const methods = new Map<PayMethod, number>();
  for (const p of payments) methods.set(p.method, (methods.get(p.method) ?? 0) + (p._sum.amount ?? 0));
  for (const r of refundsByMethod) methods.set(r.method, (methods.get(r.method) ?? 0) - (r._sum.amount ?? 0));

  return {
    range,
    kpi,
    days: [...byDay.values()],
    byService: sorted(svc.values()).map((x) => strip(x, false)),
    byProduct: sorted(prod.values()).map((x) => strip(x, opts.canCost)),
    byStaff: sorted(staff.values()).map(({ svc: m, ...s }) => ({
      ...s,
      name: s.key === "none" ? null : (users.find((u) => u.id === s.key)?.name ?? null),
      services: sorted(m.values()).map((x) => strip(x, false)),
    })),
    payments: [...methods.entries()].map(([method, amount]) => ({ method, amount })).filter((p) => p.amount !== 0).sort((a, b) => b.amount - a.amount),
  };
}
