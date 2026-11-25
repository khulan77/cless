/**
 * Цагийн SMS (PROMPT 15 §4): онлайн захиалга хүлээн авсан / баталгаажсан / татгалзсан / цуцлагдсан, 24 цагийн өмнөх сануулга.
 * Worker илгээхээс өмнө цаг одоо ч тухайн төлөвтэй эсэхийг шалгана (хуучирсан бол алгасна) — давхар илгээхгүй
 * (outbox dedupeKey + WeSend Idempotency-Key = job id).
 */
import { SITE_URL } from "@/lib/site-url";
import { db } from "@/server/db";
import { formatTime, ubDateKey } from "@/lib/time";
import { sendSms } from "./sms";
import { brand } from "./providers/wesend";
import { getTemplates, renderTemplate, type TemplateKey } from "./templates";

export type ApptSmsKind = "received" | "confirmed" | "rejected" | "cancelled" | "reminder";
export type ApptSmsPayload = { appointmentId: string; kind: ApptSmsKind; startsAt: string };

const TEMPLATE: Record<ApptSmsKind, TemplateKey> = {
  received: "apptReceived",
  confirmed: "apptConfirmed",
  rejected: "apptRejected",
  cancelled: "apptCancelled",
  reminder: "apptReminder",
};

export async function deliverAppointmentSms(jobId: string, p: ApptSmsPayload): Promise<"sent" | "skipped"> {
  const a = await db.appointment.findUnique({
    where: { id: p.appointmentId },
    select: { status: true, startsAt: true, cancelReason: true, customer: { select: { name: true, phone: true } }, service: { select: { name: true } }, staff: { select: { name: true } } },
  });
  if (!a || !a.customer.phone) return "skipped";
  const sameTime = a.startsAt.toISOString() === p.startsAt;
  const valid = {
    received: a.status === "PENDING" && sameTime,
    confirmed: (a.status === "CONFIRMED" || a.status === "BOOKED") && sameTime,
    rejected: a.status === "CANCELLED",
    cancelled: a.status === "CANCELLED",
    reminder: (a.status === "CONFIRMED" || a.status === "BOOKED") && sameTime,
  }[p.kind];
  if (!valid) return "skipped";
  const tpl = (await getTemplates())[TEMPLATE[p.kind]];
  const text = renderTemplate(tpl, {
    salon: brand(),
    name: a.customer.name.split(" ")[0],
    service: a.service.name,
    staff: a.staff.name,
    date: ubDateKey(a.startsAt).slice(5).replace("-", "/"),
    time: formatTime(a.startsAt),
    reason: a.cancelReason ? `${a.cancelReason}.` : "",
    link: `${SITE_URL}/account`,
  });
  await sendSms({ id: jobId, to: a.customer.phone, text, kind: `appt.${p.kind}` });
  return "sent";
}
