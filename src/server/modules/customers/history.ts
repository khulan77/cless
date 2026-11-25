/**
 * Үйлчлүүлэгчийн түүх ба эрэмбэ (A7) — зөвхөн уншина.
 *
 * Дүн = төлөгдсөн борлуулалтын (PAID, PARTIALLY_REFUNDED, REFUNDED) мөрийн дүн (`SaleItem.lineTotal`)
 * − дууссан (COMPLETED) буцаалтын мөрийн дүн — reports/definitions.ts-тэй ижил. Тоо ширхэг ч буцаалтыг хасна.
 * Айлчлал = төлөгдсөн борлуулалт эсвэл дууссан (DONE) цагтай УБ-ын өдрүүдийн тоо; сүүлд ирсэн = тэдний хамгийн сүүлийнх.
 */
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { LINE_SELLER } from "@/server/modules/reports/attribution";

/** Нэг мөрийн буцаалтгүй үлдэгдэл (тоо, дүн) — SaleItem `i`, Sale `s` гэсэн alias-тай query-д */
const NET_ITEMS = Prisma.sql`
  WITH r AS (
    SELECT (e->>'saleItemId') AS "itemId", SUM((e->>'qty')::int) AS qty, SUM((e->>'amount')::int) AS amount
    FROM "Refund" rf CROSS JOIN LATERAL jsonb_array_elements(rf."items") e
    WHERE rf."status"::text = 'COMPLETED'
    GROUP BY 1
  )`;
const PAID = Prisma.sql`s."status"::text IN ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED')`;

export const CUSTOMER_SORTS = ["total", "product", "service", "visits", "lastVisit", "name"] as const;
export type CustomerSort = (typeof CUSTOMER_SORTS)[number];

export type RankedCustomer = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  total: number;
  product: number;
  service: number;
  visits: number;
  lastVisit: Date | null;
  /** PROMPT 15: сайтаас бүртгүүлсэн (ONLINE) эсэх */
  registeredVia: "ADMIN" | "ONLINE";
};

const ORDER: Record<CustomerSort, Prisma.Sql> = {
  total: Prisma.sql`total`,
  product: Prisma.sql`product`,
  service: Prisma.sql`service`,
  visits: Prisma.sql`visits`,
  lastVisit: Prisma.sql`"lastVisit"`,
  name: Prisma.sql`c."name"`,
};

/** Жагсаалт: нийт / бүтээгдэхүүн / үйлчилгээний дүн, айлчлал, сүүлд ирсэн — сонгосон баганаар эрэмбэлнэ (default: нийт ↓) */
export async function listCustomersRanked(opts: { q?: string; sort?: string; dir?: string; page?: number; pageSize?: number; all?: boolean; online?: boolean } = {}) {
  const sort: CustomerSort = (CUSTOMER_SORTS as readonly string[]).includes(opts.sort ?? "") ? (opts.sort as CustomerSort) : "total";
  const dir = opts.dir === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  const pageSize = opts.pageSize ?? 30;
  const page = Math.max(1, opts.page ?? 1);
  const term = opts.q?.trim() ?? "";
  const digits = term.replace(/\D/g, "");
  const conds: Prisma.Sql[] = [];
  if (term) conds.push(Prisma.sql`(c."name" ILIKE ${`%${term}%`} OR c."email" ILIKE ${`%${term}%`}${digits.length >= 3 ? Prisma.sql` OR c."phone" LIKE ${`%${digits}%`}` : Prisma.empty})`);
  // "Сайтаас бүртгүүлсэн" шүүлтүүр (нэг жагсаалт — тусдаа биш)
  if (opts.online) conds.push(Prisma.sql`c."registeredVia"::text = 'ONLINE'`);
  const where = conds.length ? Prisma.sql`WHERE ${Prisma.join(conds, " AND ")}` : Prisma.empty;
  const limit = opts.all ? Prisma.empty : Prisma.sql`LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;

  const [rows, count] = await Promise.all([
    db.$queryRaw<RankedCustomer[]>`
      ${NET_ITEMS},
      money AS (
        SELECT s."customerId" AS id,
          SUM(CASE WHEN i."kind"::text = 'PRODUCT' THEN i."lineTotal" - COALESCE(r.amount, 0) ELSE 0 END)::int AS product,
          SUM(CASE WHEN i."kind"::text = 'SERVICE' THEN i."lineTotal" - COALESCE(r.amount, 0) ELSE 0 END)::int AS service
        FROM "SaleItem" i JOIN "Sale" s ON s."id" = i."saleId" LEFT JOIN r ON r."itemId" = i."id"
        WHERE ${PAID} AND s."customerId" IS NOT NULL
        GROUP BY 1
      ),
      days AS (
        SELECT "customerId" AS id, ("paidAt" AT TIME ZONE 'Asia/Ulaanbaatar')::date AS d, "paidAt" AS at
        FROM "Sale" s WHERE ${PAID} AND s."customerId" IS NOT NULL AND s."paidAt" IS NOT NULL
        UNION ALL
        SELECT "customerId", ("startsAt" AT TIME ZONE 'Asia/Ulaanbaatar')::date, "startsAt" FROM "Appointment" WHERE "status"::text = 'DONE'
      ),
      visits AS (SELECT id, COUNT(DISTINCT d)::int AS visits, MAX(at) AS "lastVisit" FROM days GROUP BY 1)
      SELECT c."id", c."name", c."phone", c."email", c."registeredVia"::text AS "registeredVia",
        (COALESCE(m.product, 0) + COALESCE(m.service, 0))::int AS total,
        COALESCE(m.product, 0)::int AS product,
        COALESCE(m.service, 0)::int AS service,
        COALESCE(v.visits, 0)::int AS visits,
        v."lastVisit"
      FROM "Customer" c
      LEFT JOIN money m ON m.id = c."id"
      LEFT JOIN visits v ON v.id = c."id"
      ${where}
      ORDER BY ${ORDER[sort]} ${dir} NULLS LAST, c."name" ASC
      ${limit}`,
    db.$queryRaw<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM "Customer" c ${where}`,
  ]);
  return { rows, count: count[0]?.n ?? 0, page, pageSize, sort, dir: opts.dir === "asc" ? ("asc" as const) : ("desc" as const) };
}

export type ServiceHistoryRow = {
  appointmentId: string | null;
  saleId: string | null;
  at: Date;
  service: string;
  staff: string | null;
  /** Борлуулалтын бодит дүн (буцаалт хассан); POS-оор төлөгдөөгүй цагт null */
  amount: number | null;
  status: string;
};
export type ProductHistoryRow = {
  saleId: string;
  at: Date;
  sku: string | null;
  barcode: string | null;
  name: string;
  size: string | null;
  qty: number;
  amount: number;
  staff: string | null;
};

/** Дэлгэрэнгүй: үйлчилгээ (цаг + POS-ийн үйлчилгээний мөр), бүтээгдэхүүн, нийт дүн. Огноо — УБ цагаар харуулна. */
export async function customerHistory(customerId: string) {
  const [serviceLines, products, appointments] = await Promise.all([
    db.$queryRaw<{ saleId: string; appointmentId: string | null; at: Date; service: string; staff: string | null; amount: number }[]>`
      ${NET_ITEMS}
      SELECT s."id" AS "saleId", s."appointmentId", s."paidAt" AS at, i."nameSnapshot" AS service, u."name" AS staff,
        (i."lineTotal" - COALESCE(r.amount, 0))::int AS amount
      FROM "SaleItem" i JOIN "Sale" s ON s."id" = i."saleId"
      LEFT JOIN r ON r."itemId" = i."id"
      LEFT JOIN "User" u ON u."id" = i."staffId"
      WHERE ${PAID} AND s."customerId" = ${customerId} AND i."kind"::text = 'SERVICE'
      ORDER BY s."paidAt" DESC`,
    db.$queryRaw<ProductHistoryRow[]>`
      ${NET_ITEMS}
      SELECT s."id" AS "saleId", s."paidAt" AS at, COALESCE(v."sku", i."skuSnapshot") AS sku, v."barcode", i."nameSnapshot" AS name, v."size",
        (i."qty" - COALESCE(r.qty, 0))::int AS qty,
        (i."lineTotal" - COALESCE(r.amount, 0))::int AS amount,
        COALESCE(u."name", cb."name") AS staff
      FROM "SaleItem" i JOIN "Sale" s ON s."id" = i."saleId"
      LEFT JOIN r ON r."itemId" = i."id"
      LEFT JOIN "Variant" v ON v."id" = i."variantId"
      LEFT JOIN "User" u ON u."id" = ${LINE_SELLER}
      LEFT JOIN "User" cb ON cb."id" = s."createdById"
      WHERE ${PAID} AND s."customerId" = ${customerId} AND i."kind"::text = 'PRODUCT'
      ORDER BY s."paidAt" DESC, i."sortOrder"`,
    db.appointment.findMany({
      where: { customerId },
      orderBy: { startsAt: "desc" },
      take: 200,
      select: { id: true, startsAt: true, status: true, service: { select: { name: true } }, staff: { select: { name: true } } },
    }),
  ]);

  // Цаг бүр нэг мөр (POS-оор төлөгдсөн бол бодит дүнгээр); цаггүй үйлчилгээний борлуулалт тусдаа мөр
  const soldByAppt = new Map<string, number>();
  for (const l of serviceLines) if (l.appointmentId) soldByAppt.set(l.appointmentId, (soldByAppt.get(l.appointmentId) ?? 0) + l.amount);
  const services: ServiceHistoryRow[] = [
    ...appointments.map((a) => ({
      appointmentId: a.id,
      saleId: null,
      at: a.startsAt,
      service: a.service.name,
      staff: a.staff.name,
      amount: soldByAppt.get(a.id) ?? null,
      status: a.status,
    })),
    ...serviceLines.filter((l) => !l.appointmentId).map((l) => ({ appointmentId: null, saleId: l.saleId, at: l.at, service: l.service, staff: l.staff, amount: l.amount, status: "SOLD" })),
  ].sort((x, y) => y.at.getTime() - x.at.getTime());

  const productTotal = products.reduce((s, p) => s + p.amount, 0);
  const serviceTotal = serviceLines.reduce((s, l) => s + l.amount, 0);
  return { services, products, totals: { product: productTotal, service: serviceTotal, total: productTotal + serviceTotal } };
}
