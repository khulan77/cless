/**
 * Worker: APPT_EMAIL / APPT_REMINDER ажлыг гүйцэтгэнэ. Илгээхээс өмнө цаг одоо ч хүчинтэй эсэхийг шалгана:
 * сануулга — цаг идэвхтэй (BOOKED/CONFIRMED) бөгөөд startsAt хэвээр; мэдэгдэл — төлөв/цаг тохирч байгаа.
 * Хүчингүй бол алгасна (ажил DONE болно).
 */
import { db } from "@/server/db";
import { sendEmail } from "./mailer";
import { renderAppointmentEmail, type ApptEmailKind } from "./appointment-email";

export type ApptJobPayload = { appointmentId: string; kind: ApptEmailKind; startsAt: string };

export type DeliveryResult = "sent" | "skipped";

export async function deliverAppointmentEmail(jobId: string, p: ApptJobPayload): Promise<DeliveryResult> {
  const a = await db.appointment.findUnique({
    where: { id: p.appointmentId },
    select: {
      status: true,
      startsAt: true,
      endsAt: true,
      branch: { select: { name: true, address: true, phone: true } },
      customer: { select: { name: true, email: true } },
      service: { select: { name: true } },
      staff: { select: { name: true } },
    },
  });
  if (!a || !a.customer.email) return "skipped";
  const sameTime = a.startsAt.toISOString() === p.startsAt;
  const active = a.status === "BOOKED" || a.status === "CONFIRMED";
  const valid =
    p.kind === "cancelled" ? a.status === "CANCELLED" : p.kind === "reminder" ? active && sameTime : sameTime && a.status !== "CANCELLED";
  if (!valid) return "skipped";

  const mail = await renderAppointmentEmail({
    kind: p.kind,
    salon: a.branch,
    customerName: a.customer.name,
    startsAt: a.startsAt,
    endsAt: a.endsAt,
    service: a.service.name,
    staff: a.staff.name,
  });
  await sendEmail({ id: jobId, to: a.customer.email, ...mail });
  return "sent";
}
