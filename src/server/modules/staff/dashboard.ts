/**
 * Гоо сайханчийн "Миний самбар" (A8) — зөвхөн уншина, зөвхөн өөрийн өгөгдөл.
 * Үйлчлүүлэгчийн утас, имэйл хэзээ ч сонгохгүй. Дүн нь буцаалт хассан (тайлантай ижил дүрэм).
 */
import { db } from "@/server/db";
import { rangeBounds, type ReportRange } from "@/server/modules/reports/definitions";
import { servedCustomerIds } from "@/server/modules/customers/access";
import { commissionFor, type CommissionRuleLite } from "./commission";

/** Миний үйлчлүүлэгчид: нэр, сүүлийн үйлчилгээ, нийт хэдэн удаа, сүүлийн оношлогооны арьсны төрөл */
export async function myCustomers(staffId: string) {
  const ids = await servedCustomerIds(staffId);
  if (ids.length === 0) return [];
  const [customers, appts, visits] = await Promise.all([
    db.customer.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, skinType: true } }),
    db.appointment.findMany({
      where: { staffId, customerId: { in: ids }, status: { notIn: ["CANCELLED", "NO_SHOW"] } },
      orderBy: { startsAt: "desc" },
      select: { customerId: true, startsAt: true, service: { select: { name: true } } },
    }),
    db.visit.findMany({ where: { customerId: { in: ids } }, orderBy: { createdAt: "desc" }, select: { customerId: true, createdAt: true, skinType: true } }),
  ]);
  return customers
    .map((c) => {
      const mine = appts.filter((a) => a.customerId === c.id);
      const visit = visits.find((v) => v.customerId === c.id);
      return {
        id: c.id,
        name: c.name,
        skinType: visit?.skinType ?? c.skinType,
        services: mine.length,
        last: mine[0] ? { at: mine[0].startsAt, service: mine[0].service.name } : null,
      };
    })
    .sort((a, b) => (b.last?.at.getTime() ?? 0) - (a.last?.at.getTime() ?? 0));
}

type Line = {
  day: string;
  kind: "SERVICE" | "PRODUCT";
  name: string;
  serviceId: string | null;
  productId: string | null;
  collectionIds: string[] | null;
  qty: number;
  amount: number;
};

/** Миний борлуулалт: хийсэн үйлчилгээ, зарсан бүтээгдэхүүн, урамшуулал — сонгосон хугацаанд (УБ өдрөөр) */
export async function mySales(staffId: string, range: ReportRange) {
  const { start, end } = rangeBounds(range);
  const [lines, rules] = await Promise.all([
    db.$queryRaw<Line[]>`
      WITH r AS (
        SELECT (e->>'saleItemId') AS "itemId", SUM((e->>'qty')::int) AS qty, SUM((e->>'amount')::int) AS amount
        FROM "Refund" rf CROSS JOIN LATERAL jsonb_array_elements(rf."items") e
        WHERE rf."status"::text = 'COMPLETED' GROUP BY 1
      )
      SELECT to_char((s."paidAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ulaanbaatar', 'YYYY-MM-DD') AS day,
        i."kind"::text AS kind, i."nameSnapshot" AS name, i."serviceId", v."productId",
        (SELECT array_agg(pc."collectionId") FROM "ProductCollection" pc WHERE pc."productId" = v."productId") AS "collectionIds",
        (i."qty" - COALESCE(r.qty, 0))::int AS qty,
        (i."lineTotal" - COALESCE(r.amount, 0))::int AS amount
      FROM "SaleItem" i JOIN "Sale" s ON s."id" = i."saleId"
      LEFT JOIN r ON r."itemId" = i."id"
      LEFT JOIN "Variant" v ON v."id" = i."variantId"
      WHERE i."staffId" = ${staffId}
        AND s."status"::text IN ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED')
        AND s."paidAt" >= ${start} AND s."paidAt" < ${end}
      ORDER BY s."paidAt" DESC`,
    db.commissionRule.findMany({ where: { isActive: true } }),
  ]);

  const ruleList = rules as unknown as CommissionRuleLite[];
  const rows = lines.map((l) => ({
    ...l,
    commission: commissionFor({ kind: l.kind, staffId, serviceId: l.serviceId, productId: l.productId, collectionIds: l.collectionIds ?? [], amount: l.amount, qty: l.qty }, ruleList),
  }));
  const sum = (kind: Line["kind"], k: "amount" | "qty" | "commission") => rows.filter((r) => r.kind === kind).reduce((s, r) => s + r[k], 0);

  // Нэр тус бүрээр задаргаа
  const group = (kind: Line["kind"]) => {
    const m = new Map<string, { name: string; qty: number; amount: number; commission: number }>();
    for (const r of rows.filter((x) => x.kind === kind)) {
      const g = m.get(r.name) ?? { name: r.name, qty: 0, amount: 0, commission: 0 };
      g.qty += r.qty;
      g.amount += r.amount;
      g.commission += r.commission;
      m.set(r.name, g);
    }
    return [...m.values()].filter((g) => g.qty !== 0 || g.amount !== 0).sort((a, b) => b.amount - a.amount);
  };

  return {
    range,
    services: { qty: sum("SERVICE", "qty"), amount: sum("SERVICE", "amount"), commission: sum("SERVICE", "commission"), items: group("SERVICE") },
    products: { qty: sum("PRODUCT", "qty"), amount: sum("PRODUCT", "amount"), commission: sum("PRODUCT", "commission"), items: group("PRODUCT") },
    commission: rows.reduce((s, r) => s + r.commission, 0),
  };
}
