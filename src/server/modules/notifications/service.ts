/**
 * Айлчлалын имэйл: outbox ажил (VISIT_EMAIL) → render → илгээх → Visit.emailStatus.
 */
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { UserError } from "@/server/errors";
import { enqueue } from "@/server/modules/outbox/service";
import { concernNames } from "@/server/modules/visits/service";
import { sendEmail, type SendResult } from "./mailer";
import { renderVisitEmail, type VisitEmailData } from "./visit-email";

export async function loadVisitEmail(visitId: string): Promise<{ to: string | null; data: VisitEmailData } | null> {
  const v = await db.visit.findUnique({
    where: { id: visitId },
    include: {
      branch: true,
      customer: true,
      conductedBy: { select: { name: true } },
      recommendations: {
        orderBy: { sortOrder: "asc" },
        include: { variant: { select: { size: true, product: { select: { name: true, slug: true } } } } },
      },
      sale: { select: { number: true, total: true, items: { where: { kind: "SERVICE" }, select: { nameSnapshot: true } } } },
    },
  });
  if (!v) return null;
  return {
    to: v.customer.email,
    data: {
      salon: { name: v.branch.name, address: v.branch.address, phone: v.branch.phone },
      customerName: v.customer.name,
      date: v.createdAt,
      conductedBy: v.conductedBy.name,
      skinType: v.skinType,
      concerns: await concernNames(v.concerns),
      notes: v.diagnosisNotes,
      recommendations: v.recommendations.map((r) => ({
        name: r.variant.product.name,
        size: r.variant.size,
        slug: r.variant.product.slug,
        instructions: r.instructions,
        purchased: r.purchased,
      })),
      sale: v.sale ? { number: v.sale.number, total: v.sale.total, services: v.sale.items.map((i) => i.nameSnapshot) } : null,
    },
  };
}

/** Worker-ийн VISIT_EMAIL handler. Алдаа гарвал throw — worker дахин оролдоно. */
export async function deliverVisitEmail(jobId: string, visitId: string): Promise<SendResult | null> {
  const loaded = await loadVisitEmail(visitId);
  if (!loaded) return null; // айлчлал устсан — хийх юм алга
  if (!loaded.to) {
    await db.visit.update({ where: { id: visitId }, data: { emailStatus: "NOT_SENT", emailError: "Үйлчлүүлэгчид имэйл хаяг алга." } });
    return null;
  }
  const mail = await renderVisitEmail(loaded.data);
  try {
    const res = await sendEmail({ id: jobId, to: loaded.to, ...mail });
    await db.visit.update({ where: { id: visitId }, data: { emailStatus: "SENT", emailSentAt: new Date(), emailError: null } });
    return res;
  } catch (e) {
    await db.visit.update({ where: { id: visitId }, data: { emailError: String(e instanceof Error ? e.message : e).slice(0, 500) } });
    throw e;
  }
}

/** Бүх оролдлого дууссан үед */
export async function markVisitEmailFailed(visitId: string, error: string) {
  await db.visit.update({ where: { id: visitId }, data: { emailStatus: "FAILED", emailError: error.slice(0, 500) } });
}

/** "Дахин илгээх" — шинэ ажил (dedupeKey-д цаг) */
export async function resendVisitEmail(visitId: string, actorId: string) {
  return db.$transaction(async (tx) => {
    const v = await tx.visit.findUnique({ where: { id: visitId }, select: { id: true, customer: { select: { email: true } } } });
    if (!v) throw new UserError("Айлчлал олдсонгүй.");
    if (!v.customer.email) throw new UserError("Үйлчлүүлэгчид имэйл хаяг алга.");
    await enqueue(tx, { type: "VISIT_EMAIL", payload: { visitId }, dedupeKey: `visit-email:${visitId}:${Date.now()}` });
    await tx.visit.update({ where: { id: visitId }, data: { emailStatus: "QUEUED", emailError: null } });
    await audit(tx, { userId: actorId, action: "visit.email_resend", entity: "Visit", entityId: visitId });
  });
}
