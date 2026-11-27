/** Sale PAID → холбогдсон цаг DONE (sales/finalize-аас; тусдаа модуль — импортын цикл үүсгэхгүй) */
import { onAppointmentStatus } from "@/server/modules/packages/service";
import type { Prisma } from "@/generated/prisma/client";
import { audit } from "@/server/audit";

type Tx = Prisma.TransactionClient;

/**
 * POS-ийн finalize transaction дотроос: холбогдсон Sale PAID → цаг DONE.
 * Idempotent: аль хэдийн DONE / цуцлагдсан бол юу ч хийхгүй.
 */
export async function completeForSale(tx: Tx, appointmentId: string, actorId: string | null) {
  const rows = await tx.$queryRaw<{ status: string }[]>`
    SELECT "status"::text AS "status" FROM "Appointment" WHERE "id" = ${appointmentId} FOR UPDATE`;
  const status = rows[0]?.status;
  if (!status || !["BOOKED", "CONFIRMED", "ARRIVED", "IN_PROGRESS"].includes(status)) return false;
  await tx.appointment.update({ where: { id: appointmentId }, data: { status: "DONE", version: { increment: 1 } } });
  await audit(tx, { userId: actorId, action: "appointment.complete", entity: "Appointment", entityId: appointmentId, before: { status }, after: { status: "DONE", by: "sale.paid" } });
  // PROMPT 27: холбосон багцаас 1 удаа хасна (давхардалгүй)
  await onAppointmentStatus(tx, appointmentId, "DONE", actorId);
  return true;
}
