/**
 * Үйлчлүүлэгчийн мэдээлэлд хэн хүрэх вэ (A8, A9).
 *
 * ADMIN, MANAGER (customer:read) — бүх үйлчлүүлэгч. STAFF — зөвхөн өөрөө үйлчилсэн үйлчлүүлэгч:
 * тухайн үйлчлүүлэгчтэй цуцлагдаагүй цагтай, оношлогоо (Visit) хийсэн, эсвэл төлөгдсөн борлуулалтын
 * мөрөнд ажилтнаар бүртгэгдсэн. STAFF утас/имэйл хэзээ ч харахгүй (customer:contact:read).
 */
import type { Role } from "@/generated/prisma/enums";
import { can } from "@/server/auth/permissions";
import { db } from "@/server/db";
import { ForbiddenError } from "@/server/errors";

type Actor = { id: string; role: Role };

const PAID = ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] as const;

/** Энэ ажилтан энэ үйлчлүүлэгчид үйлчилсэн үү */
export async function servedCustomer(staffId: string, customerId: string): Promise<boolean> {
  const [appt, visit, sold] = await Promise.all([
    db.appointment.count({ where: { staffId, customerId, status: { not: "CANCELLED" } }, take: 1 }),
    db.visit.count({ where: { conductedById: staffId, customerId }, take: 1 }),
    db.saleItem.count({ where: { staffId, sale: { customerId, status: { in: [...PAID] } } }, take: 1 }),
  ]);
  return appt + visit + sold > 0;
}

/** Ажилтны үйлчилсэн бүх үйлчлүүлэгчийн id */
export async function servedCustomerIds(staffId: string): Promise<string[]> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT DISTINCT "customerId" AS id FROM "Appointment" WHERE "staffId" = ${staffId} AND "status"::text <> 'CANCELLED'
    UNION SELECT DISTINCT "customerId" FROM "Visit" WHERE "conductedById" = ${staffId}
    UNION SELECT DISTINCT s."customerId" FROM "SaleItem" i JOIN "Sale" s ON s."id" = i."saleId"
      WHERE i."staffId" = ${staffId} AND s."customerId" IS NOT NULL AND s."status"::text IN ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED')`;
  return rows.map((r) => r.id);
}

/** Үйлчлүүлэгчийг үзэх: customer:read эсвэл (me:read + өөрөө үйлчилсэн) */
export async function canSeeCustomer(actor: Actor, customerId: string): Promise<boolean> {
  if (can(actor.role, "customer:read")) return true;
  return can(actor.role, "me:read") && (await servedCustomer(actor.id, customerId));
}

export async function assertCanSeeCustomer(actor: Actor, customerId: string): Promise<void> {
  if (!(await canSeeCustomer(actor, customerId))) throw new ForbiddenError("Энэ үйлчлүүлэгчид та үйлчилж байгаагүй.");
}
