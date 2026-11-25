/**
 * Бүтээгдэхүүний мөрийг хэн зарсан бэ — тайлан, урамшуулал, цалин, "Миний борлуулалт", үйлчлүүлэгчийн түүх нэг дүрмээр.
 *
 * PROMPT 14 §5: POS мөр бүрт "Зарсан" ажилтан (SaleItem.sellerId) хадгална — үндсэн эх сурвалж.
 * Хуучин (sellerId-гүй, backfill хийгдээгүй) мөрөнд өмнөх дүрэм:
 *   1) мөрийн ажилтан (SaleItem.staffId), 2) борлуулалттай холбоотой цагийн гоо сайханч,
 *   3) тухайн борлуулалтын эхний үйлчилгээний ажилтан, эсвэл NULL (тодорхойгүй).
 * SQL-д SaleItem нь `i`, Sale нь `s` alias-тай байх ёстой.
 */
import { Prisma } from "@/generated/prisma/client";

/** sellerId-гүй мөрөнд нөхөх дүрэм — backfill script ч үүнийг ашиглана */
export const LEGACY_SELLER = Prisma.sql`COALESCE(
  i."staffId",
  (SELECT ap."staffId" FROM "Appointment" ap WHERE ap."id" = s."appointmentId"),
  (SELECT si."staffId" FROM "SaleItem" si WHERE si."saleId" = s."id" AND si."kind"::text = 'SERVICE' AND si."staffId" IS NOT NULL ORDER BY si."sortOrder" LIMIT 1)
)`;

export const LINE_SELLER = Prisma.sql`COALESCE(i."sellerId", ${LEGACY_SELLER})`;
