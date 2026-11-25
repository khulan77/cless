/**
 * Айлчлалын имэйл: outbox ажил (VISIT_EMAIL) → render → илгээх → Visit.emailStatus.
 */
import type { Prisma } from "@/generated/prisma/client";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { UserError } from "@/server/errors";
import { enqueue } from "@/server/modules/outbox/service";
import { concernNames } from "@/server/modules/visits/service";
import { sendEmail, type SendResult } from "./mailer";
import { renderVisitEmail, type VisitEmailData } from "./visit-email";
import { formatTime, ubDateKey } from "@/lib/time";
import { getTemplates, renderTemplate } from "./templates";

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
      sale: { select: { number: true, total: true, items: { orderBy: { sortOrder: "asc" }, select: { kind: true, nameSnapshot: true, qty: true, lineTotal: true } } } },
    },
  });
  if (!v) return null;
  const [next, templates] = await Promise.all([
    db.appointment.findFirst({
      where: { customerId: v.customerId, startsAt: { gt: new Date() }, status: { in: ["PENDING", "BOOKED", "CONFIRMED"] } },
      orderBy: { startsAt: "asc" },
      select: { startsAt: true, service: { select: { name: true } } },
    }),
    getTemplates(),
  ]);
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
      sale: v.sale ? { number: v.sale.number, total: v.sale.total, services: v.sale.items.filter((i) => i.kind === "SERVICE").map((i) => i.nameSnapshot) } : null,
      products: (v.sale?.items ?? []).filter((i) => i.kind === "PRODUCT").map((i) => ({ name: i.nameSnapshot, qty: i.qty, amount: i.lineTotal })),
      nextAppointment: next ? { date: ubDateKey(next.startsAt), time: formatTime(next.startsAt), service: next.service.name } : null,
      intro: renderTemplate(templates.visitReportIntro, { salon: v.branch.name, name: v.customer.name }),
    },
  };
}

/** Worker-ийн VISIT_EMAIL handler. Алдаа гарвал throw — worker дахин оролдоно. */
export async function deliverVisitEmail(jobId: string, visitId: string, customerEmailId?: string): Promise<SendResult | null> {
  const loaded = await loadVisitEmail(visitId);
  if (!loaded) return null; // айлчлал устсан — хийх юм алга
  if (!loaded.to) {
    await db.visit.update({ where: { id: visitId }, data: { emailStatus: "NOT_SENT", emailError: "Үйлчлүүлэгчид имэйл хаяг алга." } });
    return null;
  }
  const mail = await renderVisitEmail(loaded.data);
  try {
    const res = await sendEmail({ id: jobId, to: loaded.to, kind: "VISIT_REPORT", ...mail });
    await db.visit.update({ where: { id: visitId }, data: { emailStatus: "SENT", emailSentAt: new Date(), emailError: null } });
    if (customerEmailId) await db.customerEmail.updateMany({ where: { id: customerEmailId }, data: { status: "SENT", sentAt: new Date(), error: null } });
    return res;
  } catch (e) {
    const error = String(e instanceof Error ? e.message : e).slice(0, 500);
    await db.visit.update({ where: { id: visitId }, data: { emailError: error } });
    if (customerEmailId) await db.customerEmail.updateMany({ where: { id: customerEmailId }, data: { error } });
    throw e;
  }
}

/** Бүх оролдлого дууссан үед */
export async function markVisitEmailFailed(visitId: string, error: string, customerEmailId?: string) {
  await db.visit.update({ where: { id: visitId }, data: { emailStatus: "FAILED", emailError: error.slice(0, 500) } });
  if (customerEmailId) await db.customerEmail.updateMany({ where: { id: customerEmailId }, data: { status: "FAILED", error: error.slice(0, 500) } });
}

export const VISIT_REPORT_MSG = {
  noEmail: "Үйлчлүүлэгчид имэйл хаяг алга.",
  noConsent: "Үйлчлүүлэгч имэйлээр тайлан хүлээн авахыг зөвшөөрөөгүй байна. Зөвшөөрлийг бүртгэсний дараа илгээнэ.",
} as const;

/**
 * Айлчлалын тайланг имэйлээр (PROMPT 15 §5): зөвшөөрөл (emailConsentAt) + имэйл заавал. Илгээхээс өмнө гоо сайханч
 * арьсны төрөл, дүгнэлтийг засаж болно (Visit-д хадгална). Түүх — CustomerEmail.
 */
export async function queueVisitReport(p: { visitId: string; actorId: string | null; edits?: { skinType?: VisitEmailData["skinType"]; summary?: string | null } }, tx?: Prisma.TransactionClient) {
  const run = async (t: Prisma.TransactionClient) => {
    const v = await t.visit.findUnique({ where: { id: p.visitId }, select: { id: true, customerId: true, customer: { select: { email: true, emailConsentAt: true } } } });
    if (!v) throw new UserError("Айлчлал олдсонгүй.");
    if (!v.customer.email) throw new UserError(VISIT_REPORT_MSG.noEmail);
    if (!v.customer.emailConsentAt) throw new UserError(VISIT_REPORT_MSG.noConsent);
    if (p.edits) {
      await t.visit.update({
        where: { id: v.id },
        data: { ...(p.edits.skinType !== undefined ? { skinType: p.edits.skinType } : {}), ...(p.edits.summary !== undefined ? { diagnosisNotes: p.edits.summary } : {}) },
      });
    }
    const log = await t.customerEmail.create({ data: { customerId: v.customerId, visitId: v.id, kind: "VISIT_REPORT", sentById: p.actorId } });
    await enqueue(t, { type: "VISIT_EMAIL", payload: { visitId: v.id, customerEmailId: log.id }, dedupeKey: `visit-email:${v.id}:${log.id}` });
    await t.visit.update({ where: { id: v.id }, data: { emailStatus: "QUEUED", emailError: null } });
    await audit(t, { userId: p.actorId, action: "visit.email_send", entity: "Visit", entityId: v.id, after: { edited: Boolean(p.edits) } });
    return log.id;
  };
  return tx ? run(tx) : db.$transaction(run);
}

/** "Дахин илгээх" — ижил дүрэм (зөвшөөрөл) */
export async function resendVisitEmail(visitId: string, actorId: string) {
  return queueVisitReport({ visitId, actorId });
}

export async function customerEmailHistory(customerId: string) {
  return db.customerEmail.findMany({ where: { customerId }, orderBy: { createdAt: "desc" }, take: 30, select: { id: true, kind: true, status: true, createdAt: true, sentAt: true, error: true, sentById: true } });
}
