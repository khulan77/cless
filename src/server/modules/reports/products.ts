/**
 * Тайлан → Бүтээгдэхүүн (A10) — зөвхөн уншина.
 *
 * Хувилбар (SKU) бүрээр, сонгосон хугацаанд (УБ өдөр):
 *   Зарсан тоо, орлого — төлөгдсөн борлуулалтын мөр (`paidAt`) − дууссан буцаалт (тайлантай ижил дүрэм).
 *   Үйлчилгээнд зарцуулсан — Σ ServiceConsumable.qtyPerService × тухайн хугацааны дууссан (DONE) цаг
 *     (`startsAt`). Борлуулалтын үед SERVICE_USE хөдөлгөөн бичигддэггүй тул норм × үйлчилгээний тоо.
 *   Ажилтнаар — зарсан: attribution.ts-ийн дүрэм (байхгүй бол "Тодорхойгүй"); зарцуулсан: цагийн гоо сайханч.
 */
import { db } from "@/server/db";
import { addDays } from "@/lib/time";
import { LINE_SELLER } from "./attribution";
import { rangeBounds, type ReportRange } from "./definitions";

const UNKNOWN = "none";

type SoldRow = { variantId: string; staffId: string | null; month: string; qty: number; amount: number };
type UsedRow = { variantId: string; staffId: string; month: string; qty: number };

async function load(range: ReportRange, variantId?: string) {
  const { start, end } = rangeBounds(range);
  const only = variantId ?? null;
  const [sold, used] = await Promise.all([
    db.$queryRaw<SoldRow[]>`
      WITH r AS (
        SELECT (e->>'saleItemId') AS "itemId", SUM((e->>'qty')::int) AS qty, SUM((e->>'amount')::int) AS amount
        FROM "Refund" rf CROSS JOIN LATERAL jsonb_array_elements(rf."items") e
        WHERE rf."status"::text = 'COMPLETED' GROUP BY 1
      )
      SELECT i."variantId", ${LINE_SELLER} AS "staffId",
        to_char((s."paidAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ulaanbaatar', 'YYYY-MM') AS month,
        SUM(i."qty" - COALESCE(r.qty, 0))::int AS qty,
        SUM(i."lineTotal" - COALESCE(r.amount, 0))::int AS amount
      FROM "SaleItem" i JOIN "Sale" s ON s."id" = i."saleId" LEFT JOIN r ON r."itemId" = i."id"
      WHERE i."kind"::text = 'PRODUCT' AND i."variantId" IS NOT NULL
        AND s."status"::text IN ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED')
        AND s."paidAt" >= ${start} AND s."paidAt" < ${end}
        AND (${only}::text IS NULL OR i."variantId" = ${only})
      GROUP BY 1, 2, 3`,
    db.$queryRaw<UsedRow[]>`
      SELECT c."variantId", a."staffId",
        to_char((a."startsAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ulaanbaatar', 'YYYY-MM') AS month,
        SUM(c."qtyPerService")::float8 AS qty
      FROM "Appointment" a JOIN "ServiceConsumable" c ON c."serviceId" = a."serviceId"
      WHERE a."status"::text = 'DONE' AND a."startsAt" >= ${start} AND a."startsAt" < ${end}
        AND (${only}::text IS NULL OR c."variantId" = ${only})
      GROUP BY 1, 2, 3`,
  ]);
  return { sold, used };
}

async function names(variantIds: string[], staffIds: string[]) {
  const [variants, staff] = await Promise.all([
    variantIds.length
      ? db.variant.findMany({ where: { id: { in: variantIds } }, select: { id: true, sku: true, barcode: true, size: true, product: { select: { name: true } } } })
      : [],
    staffIds.length ? db.user.findMany({ where: { id: { in: staffIds } }, select: { id: true, name: true } }) : [],
  ]);
  return { variants: new Map(variants.map((v) => [v.id, v])), staff: new Map(staff.map((s) => [s.id, s.name])) };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export type ProductRow = {
  variantId: string;
  name: string;
  sku: string;
  barcode: string | null;
  soldQty: number;
  revenue: number;
  usedQty: number;
  byStaff: { staffId: string; name: string | null; soldQty: number; revenue: number; usedQty: number }[];
};

/** Бараа бүрээр (орлогоор буурах) */
export async function productAnalytics(range: ReportRange): Promise<ProductRow[]> {
  const { sold, used } = await load(range);
  const ids = [...new Set([...sold.map((r) => r.variantId), ...used.map((r) => r.variantId)])];
  const staffIds = [...new Set([...sold.map((r) => r.staffId), ...used.map((r) => r.staffId)].filter((x): x is string => Boolean(x)))];
  const n = await names(ids, staffIds);
  const rows = ids.map((id) => {
    const v = n.variants.get(id);
    const staff = new Map<string, { staffId: string; name: string | null; soldQty: number; revenue: number; usedQty: number }>();
    const at = (sid: string | null) => {
      const key = sid ?? UNKNOWN;
      const x = staff.get(key) ?? { staffId: key, name: sid ? (n.staff.get(sid) ?? null) : null, soldQty: 0, revenue: 0, usedQty: 0 };
      staff.set(key, x);
      return x;
    };
    for (const r of sold.filter((x) => x.variantId === id)) {
      const s = at(r.staffId);
      s.soldQty += r.qty;
      s.revenue += r.amount;
    }
    for (const r of used.filter((x) => x.variantId === id)) at(r.staffId).usedQty += r.qty;
    const byStaff = [...staff.values()].map((s) => ({ ...s, usedQty: round2(s.usedQty) })).sort((a, b) => b.revenue - a.revenue || b.usedQty - a.usedQty);
    return {
      variantId: id,
      name: v ? `${v.product.name} · ${v.size}` : id,
      sku: v?.sku ?? "",
      barcode: v?.barcode ?? null,
      soldQty: byStaff.reduce((s, x) => s + x.soldQty, 0),
      revenue: byStaff.reduce((s, x) => s + x.revenue, 0),
      usedQty: round2(byStaff.reduce((s, x) => s + x.usedQty, 0)),
      byStaff,
    };
  });
  return rows.filter((r) => r.soldQty !== 0 || r.revenue !== 0 || r.usedQty !== 0).sort((a, b) => b.revenue - a.revenue || b.usedQty - a.usedQty);
}

/** Нэг бараа: сараар (сүүлийн 12 сар, range.to-оор дуусна) ба ажилтнаар */
export async function productDetail(variantId: string, range: ReportRange) {
  const to = range.to;
  const from = `${addDays(`${to.slice(0, 7)}-01`, -334).slice(0, 7)}-01`; // 12 calendar months
  const { sold, used } = await load({ from, to }, variantId);
  const months: { month: string; soldQty: number; revenue: number; usedQty: number }[] = [];
  for (let d = from; d <= to && months.length < 12; d = `${addDays(`${d.slice(0, 7)}-28`, 5).slice(0, 7)}-01`) {
    const m = d.slice(0, 7);
    months.push({
      month: m,
      soldQty: sold.filter((r) => r.month === m).reduce((s, r) => s + r.qty, 0),
      revenue: sold.filter((r) => r.month === m).reduce((s, r) => s + r.amount, 0),
      usedQty: round2(used.filter((r) => r.month === m).reduce((s, r) => s + r.qty, 0)),
    });
  }
  const [row] = await productAnalytics(range).then((all) => all.filter((r) => r.variantId === variantId));
  const v = (await names([variantId], [])).variants.get(variantId);
  return { variantId, name: v ? `${v.product.name} · ${v.size}` : variantId, sku: v?.sku ?? "", months, byStaff: row?.byStaff ?? [] };
}
