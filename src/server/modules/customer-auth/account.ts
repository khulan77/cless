/**
 * "Миний бүртгэл" (сайт): зөвхөн өөрийн мэдээлэл. Гоо сайханчийн дотоод тэмдэглэл (CustomerNote),
 * айлчлалын зураг, өртөг, ажилтны дотоод талбаруудыг СОНГОХГҮЙ.
 */
import { db } from "@/server/db";
import { concernNames } from "@/server/modules/visits/service";

export async function myPurchases(customerId: string) {
  const rows = await db.$queryRaw<{ at: Date; name: string; qty: number; amount: number }[]>`
    WITH r AS (
      SELECT (e->>'saleItemId') AS "itemId", SUM((e->>'qty')::int) AS qty, SUM((e->>'amount')::int) AS amount
      FROM "Refund" rf CROSS JOIN LATERAL jsonb_array_elements(rf."items") e
      WHERE rf."status"::text = 'COMPLETED' GROUP BY 1
    )
    SELECT s."paidAt" AS at, i."nameSnapshot" AS name, (i."qty" - COALESCE(r.qty, 0))::int AS qty, (i."lineTotal" - COALESCE(r.amount, 0))::int AS amount
    FROM "SaleItem" i JOIN "Sale" s ON s."id" = i."saleId" LEFT JOIN r ON r."itemId" = i."id"
    WHERE s."customerId" = ${customerId} AND s."status"::text IN ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED') AND i."kind"::text = 'PRODUCT'
    ORDER BY s."paidAt" DESC LIMIT 100`;
  return rows.filter((r) => r.qty > 0);
}

/** Сүүлийн оношлогоо: арьсны төрөл, асуудлууд, санал болгосон бүтээгдэхүүн + заавар */
export async function mySkin(customerId: string) {
  const [customer, visit] = await Promise.all([
    db.customer.findUniqueOrThrow({ where: { id: customerId }, select: { skinType: true } }),
    db.visit.findFirst({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      select: {
        createdAt: true,
        skinType: true,
        concerns: true,
        diagnosisNotes: true,
        conductedBy: { select: { name: true } },
        recommendations: { orderBy: { sortOrder: "asc" }, select: { instructions: true, variant: { select: { size: true, product: { select: { name: true, slug: true } } } } } },
      },
    }),
  ]);
  return {
    skinType: visit?.skinType ?? customer.skinType,
    visit: visit
      ? {
          date: visit.createdAt,
          by: visit.conductedBy.name,
          concerns: await concernNames(visit.concerns),
          // Үйлчлүүлэгчид имэйлээр очдог дүгнэлт (дотоод тэмдэглэл биш)
          summary: visit.diagnosisNotes,
          recommendations: visit.recommendations.map((r) => ({ name: r.variant.product.name, size: r.variant.size, slug: r.variant.product.slug, instructions: r.instructions })),
        }
      : null,
  };
}

/** Админы хонх: сүүлийн 24 цагт сайтаас бүртгүүлсэн үйлчлүүлэгчид */
export async function newOnlineCustomers(now = new Date()) {
  return db.customer.count({ where: { registeredVia: "ONLINE", onlineRegisteredAt: { gt: new Date(now.getTime() - 86_400_000) } } });
}
