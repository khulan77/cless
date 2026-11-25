/**
 * Бүтээгдэхүүний мөрийг хэн зарсан бэ — тайлан, "Миний борлуулалт", үйлчлүүлэгчийн түүх нэг дүрмээр.
 *
 * POS бүтээгдэхүүний мөрөнд ажилтан бүртгэдэггүй (зөвхөн үйлчилгээнд), тиймээс:
 *   1) мөрийн ажилтан (SaleItem.staffId — гараар/импортоор бөглөгдсөн бол),
 *   2) борлуулалттай холбоотой цагийн гоо сайханч (Sale.appointmentId → Appointment.staffId),
 *   3) тухайн борлуулалтын үйлчилгээ хийсэн ажилтан (эхний үйлчилгээний мөр),
 *   эсвэл NULL (тодорхойгүй).
 * SQL-д SaleItem нь `i`, Sale нь `s` alias-тай байх ёстой.
 */
import { Prisma } from "@/generated/prisma/client";

export const LINE_SELLER = Prisma.sql`COALESCE(
  i."staffId",
  (SELECT ap."staffId" FROM "Appointment" ap WHERE ap."id" = s."appointmentId"),
  (SELECT si."staffId" FROM "SaleItem" si WHERE si."saleId" = s."id" AND si."kind"::text = 'SERVICE' AND si."staffId" IS NOT NULL ORDER BY si."sortOrder" LIMIT 1)
)`;
