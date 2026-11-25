/**
 * Цалингийн урамшуулал (PROMPT 14 §4.2): үеийн (УБ өдрөөр, төлөгдсөн огноогоор) мөр бүр —
 * үйлчилгээ: мөрийн ажилтан (цагийн гоо сайханч), бүтээгдэхүүн: зарсан ажилтан (sellerId → хуучин дүрэм).
 * Дүн, тоо — буцаалт хассан. Дүрэм: CommissionRule (staff/commission.ts). Үйлчлүүлэгчийн мэдээлэл сонгохгүй.
 */
import { db } from "@/server/db";
import { rangeBounds } from "@/server/modules/reports/definitions";
import { LINE_SELLER } from "@/server/modules/reports/attribution";
import { commissionFor, pickRule, type CommissionRuleLite } from "@/server/modules/staff/commission";

export type CommissionDetail = {
  day: string;
  kind: "SERVICE" | "PRODUCT";
  name: string;
  receipt: string | null;
  qty: number;
  amount: number;
  commission: number;
  /** Дүрмийн товч: "10%" эсвэл "5,000₮/ш" */
  rule: string | null;
};

type Row = {
  staffId: string;
  day: string;
  kind: "SERVICE" | "PRODUCT";
  name: string;
  receipt: string | null;
  serviceId: string | null;
  productId: string | null;
  collectionIds: string[] | null;
  qty: number;
  amount: number;
};

const ruleLabel = (r: CommissionRuleLite) => (r.type === "PERCENT" ? `${r.value / 100}%` : `${r.value.toLocaleString("en-US")}₮/ш`);

export async function commissionsByStaff(from: string, to: string, staffIds: string[]) {
  const { start, end } = rangeBounds({ from, to });
  const [rows, rules] = await Promise.all([
    staffIds.length === 0
      ? Promise.resolve([] as Row[])
      : db.$queryRaw<Row[]>`
      WITH r AS (
        SELECT (e->>'saleItemId') AS "itemId", SUM((e->>'qty')::int) AS qty, SUM((e->>'amount')::int) AS amount
        FROM "Refund" rf CROSS JOIN LATERAL jsonb_array_elements(rf."items") e
        WHERE rf."status"::text = 'COMPLETED' GROUP BY 1
      ), lines AS (
        SELECT (CASE WHEN i."kind"::text = 'SERVICE' THEN i."staffId" ELSE ${LINE_SELLER} END) AS "staffId",
          to_char((s."paidAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ulaanbaatar', 'YYYY-MM-DD') AS day,
          i."kind"::text AS kind, i."nameSnapshot" AS name, s."number" AS receipt, i."serviceId", v."productId",
          (SELECT array_agg(pc."collectionId") FROM "ProductCollection" pc WHERE pc."productId" = v."productId") AS "collectionIds",
          (i."qty" - COALESCE(r.qty, 0))::int AS qty,
          (i."lineTotal" - COALESCE(r.amount, 0))::int AS amount,
          s."paidAt", i."sortOrder"
        FROM "SaleItem" i JOIN "Sale" s ON s."id" = i."saleId"
        LEFT JOIN r ON r."itemId" = i."id"
        LEFT JOIN "Variant" v ON v."id" = i."variantId"
        WHERE s."status"::text IN ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED')
          AND s."paidAt" >= ${start} AND s."paidAt" < ${end}
      )
      SELECT "staffId", day, kind, name, receipt, "serviceId", "productId", "collectionIds", qty, amount
      FROM lines WHERE "staffId" = ANY(${staffIds}) ORDER BY "paidAt", "sortOrder"`,
    db.commissionRule.findMany({ where: { isActive: true } }),
  ]);
  const ruleList = rules as unknown as CommissionRuleLite[];
  const out = new Map<string, { service: number; product: number; details: CommissionDetail[] }>();
  for (const id of staffIds) out.set(id, { service: 0, product: 0, details: [] });
  for (const r of rows) {
    if (r.qty === 0 && r.amount === 0) continue; // бүрэн буцаагдсан
    const line = { kind: r.kind, staffId: r.staffId, serviceId: r.serviceId, productId: r.productId, collectionIds: r.collectionIds ?? [], amount: r.amount, qty: r.qty };
    const rule = pickRule(line, ruleList);
    const commission = commissionFor(line, ruleList);
    const g = out.get(r.staffId)!;
    if (r.kind === "SERVICE") g.service += commission;
    else g.product += commission;
    g.details.push({ day: r.day, kind: r.kind, name: r.name, receipt: r.receipt, qty: r.qty, amount: r.amount, commission, rule: rule ? ruleLabel(rule) : null });
  }
  return out;
}
