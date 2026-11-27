/**
 * Цалингийн урамшуулал (PROMPT 14 §4.2): үеийн (УБ өдрөөр, төлөгдсөн огноогоор) мөр бүр —
 * үйлчилгээ: мөрийн ажилтан (цагийн гоо сайханч), бүтээгдэхүүн: зарсан ажилтан (sellerId → хуучин дүрэм).
 * Дүн, тоо — буцаалт хассан. Дүрэм: CommissionRule (staff/commission.ts). Үйлчлүүлэгчийн мэдээлэл сонгохгүй.
 */
import { db } from "@/server/db";
import { getTaxSettings } from "@/server/modules/settings/pos-settings";
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
  /** Урамшууллын суурь (NET бол НӨАТ-гүй) */
  base?: number;
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
  vat: number;
};

const ruleLabel = (r: CommissionRuleLite) => (r.type === "PERCENT" ? `${r.value / 100}%` : `${r.value.toLocaleString("en-US")}₮/ш`);

/** Урамшууллын суурь: GROSS (анхдагч) — НӨАТ-тэй дүн, NET — НӨАТ-гүй цэвэр дүн */
export async function commissionsByStaff(from: string, to: string, staffIds: string[], opts: { base?: "NET" | "GROSS" } = {}) {
  const onNet = opts.base === "NET";
  const tax = await getTaxSettings();
  const vatBp = tax.vatIncluded ? tax.vatRateBp : 0;
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
          ROUND(CASE WHEN i."lineTotal" > 0 THEN i."vatAmount"::numeric * (i."lineTotal" - COALESCE(r.amount, 0)) / i."lineTotal" ELSE 0 END)::int AS vat,
          s."paidAt", i."sortOrder"
        FROM "SaleItem" i JOIN "Sale" s ON s."id" = i."saleId"
        LEFT JOIN r ON r."itemId" = i."id"
        LEFT JOIN "Variant" v ON v."id" = i."variantId"
        WHERE s."status"::text IN ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED')
          AND s."paidAt" >= ${start} AND s."paidAt" < ${end}
          -- PROMPT 27: багц худалдсан мөрөөс урамшуулал бодохгүй — ашиглах үед (redemption) бодно
          AND i."packageTemplateId" IS NULL
        UNION ALL
        -- Багцаас хийсэн үйлчилгээ: 1 удаагийн өртгөөр (unitValue), цагийн гоо сайханчид
        SELECT pr."staffId",
          to_char((pr."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ulaanbaatar', 'YYYY-MM-DD') AS day,
          'SERVICE' AS kind, (sv."name" || ' (багц)') AS name, NULL AS receipt, pr."serviceId", NULL AS "productId",
          NULL::text[] AS "collectionIds",
          1 AS qty, pr."unitValue" AS amount,
          ROUND(pr."unitValue"::numeric * ${vatBp} / (10000 + ${vatBp}))::int AS vat,
          pr."createdAt" AS "paidAt", 0 AS "sortOrder"
        FROM "PackageRedemption" pr JOIN "Service" sv ON sv."id" = pr."serviceId"
        WHERE pr."reversedAt" IS NULL AND pr."createdAt" >= ${start} AND pr."createdAt" < ${end}
      )
      SELECT "staffId", day, kind, name, receipt, "serviceId", "productId", "collectionIds", qty, amount, vat
      FROM lines WHERE "staffId" = ANY(${staffIds}) ORDER BY "paidAt", "sortOrder"`,
    db.commissionRule.findMany({ where: { isActive: true } }),
  ]);
  const ruleList = rules as unknown as CommissionRuleLite[];
  const out = new Map<string, { service: number; product: number; serviceBase: number; productBase: number; details: CommissionDetail[] }>();
  for (const id of staffIds) out.set(id, { service: 0, product: 0, serviceBase: 0, productBase: 0, details: [] });
  for (const r of rows) {
    if (r.qty === 0 && r.amount === 0) continue; // бүрэн буцаагдсан
    const base = onNet ? r.amount - r.vat : r.amount;
    const line = { kind: r.kind, staffId: r.staffId, serviceId: r.serviceId, productId: r.productId, collectionIds: r.collectionIds ?? [], amount: base, qty: r.qty };
    const rule = pickRule(line, ruleList);
    const commission = commissionFor(line, ruleList);
    const g = out.get(r.staffId)!;
    if (r.kind === "SERVICE") {
      g.service += commission;
      g.serviceBase += base;
    } else {
      g.product += commission;
      g.productBase += base;
    }
    g.details.push({ day: r.day, kind: r.kind, name: r.name, receipt: r.receipt, qty: r.qty, amount: r.amount, base, commission, rule: rule ? ruleLabel(rule) : null });
  }
  return out;
}
