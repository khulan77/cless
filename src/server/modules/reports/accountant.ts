/**
 * "Нягтланд илгээх" (A11) — өдрийн тайланг нягтлангийн имэйл(үүд) рүү Excel хавсралттай.
 *
 *  - Хаягууд: SiteSetting "accountant" { emails } — ADMIN / MANAGER (report:send) тохируулна.
 *  - Илгээлт бүр ReportDispatch мөр + OutboxJob (ACCOUNTANT_REPORT). Worker илгээнэ → SENT / FAILED.
 *  - Тухайн өдөр аль хэдийн илгээсэн (эсвэл илгээж буй) бол `resend` баталгаагүйгээр дахин үүсгэхгүй.
 *  - Дүн — тайлантай ижил дүрэм (loadReport): буцаалт хассан, УБ өдөр, төлбөрийн хэлбэр нь буцаалт хассан.
 *
 * Хувийн мэдээлэл (үйлчлүүлэгчийн нэр, утас) тайланд ороогүй — зөвхөн нийлбэр дүн.
 */
import ExcelJS from "exceljs";
import { z } from "zod";
import type { PayMethod, Prisma } from "@/generated/prisma/client";
import { t } from "@/i18n";
import { addDays, ubDateKey } from "@/lib/time";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { UserError } from "@/server/errors";
import { getCurrentBranch } from "@/server/modules/branches/service";
import { emailSupportsAttachments, sendEmail } from "@/server/modules/notifications/mailer";
import { SITE_URL } from "@/lib/site-url";
import { renderAccountantEmail } from "@/server/modules/notifications/accountant-email";
import { enqueue } from "@/server/modules/outbox/service";
import { exportToken } from "@/server/modules/finance/export";
import { rangeBounds } from "./definitions";
import { loadReport, type BreakdownRow } from "./queries";

const A = t.admin.accountant;
const SETTING_KEY = "accountant";
export const MAX_RECIPIENTS = 5;

// ───────────────────────── Тохиргоо ─────────────────────────

const storedSchema = z.object({ emails: z.array(z.string()).catch([]) });

export async function getAccountantEmails(): Promise<string[]> {
  const row = await db.siteSetting.findUnique({ where: { key: SETTING_KEY }, select: { value: true } });
  return storedSchema.parse(row?.value ?? {}).emails;
}

export const accountantEmailsSchema = z.object({
  emails: z
    .array(z.string().trim().toLowerCase())
    .transform((list) => [...new Set(list.filter(Boolean))])
    .pipe(z.array(z.email(A.badEmail)).max(MAX_RECIPIENTS, A.tooMany(MAX_RECIPIENTS))),
});

export async function saveAccountantEmails(raw: z.input<typeof accountantEmailsSchema>, actorId: string) {
  const { emails } = accountantEmailsSchema.parse(raw);
  await db.$transaction(async (tx) => {
    const before = await tx.siteSetting.findUnique({ where: { key: SETTING_KEY } });
    await tx.siteSetting.upsert({ where: { key: SETTING_KEY }, create: { key: SETTING_KEY, value: { emails } }, update: { value: { emails } } });
    await audit(tx, { userId: actorId, action: "settings.accountant", entity: "SiteSetting", entityId: SETTING_KEY, before: before?.value, after: { emails } });
  });
  return emails;
}

// ───────────────────────── Өдрийн хураангуй ─────────────────────────

export type DailySummary = {
  day: string;
  total: number;
  /** A12: нэг удаагийн үйлчилгээ ба курс/багц (курс — B хэсэг хүртэл 0) */
  serviceOneTime: number;
  serviceCourse: number;
  service: number;
  product: number;
  net: number;
  sales: number;
  discounts: number;
  refunds: number;
  refundCount: number;
  payments: { method: PayMethod; amount: number }[];
  /** Тухайн өдөр хаагдсан ээлжүүдийн зөрүүний нийлбэр (null = хаагдсан ээлж алга) */
  cashDifference: number | null;
  closedShifts: number;
  openShifts: number;
};

export async function dailySummary(day: string): Promise<DailySummary & { byService: BreakdownRow[]; byProduct: BreakdownRow[] }> {
  const range = { from: day, to: day };
  const { start, end } = rangeBounds(range);
  const branch = await getCurrentBranch();
  const [report, discounts, closed, open] = await Promise.all([
    loadReport(range, { canCost: false }),
    db.sale.aggregate({
      where: { branchId: branch.id, status: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] }, paidAt: { gte: start, lt: end } },
      _sum: { lineDiscountTotal: true, saleDiscount: true },
    }),
    db.cashShift.aggregate({ where: { branchId: branch.id, status: "CLOSED", closedAt: { gte: start, lt: end } }, _count: true, _sum: { difference: true } }),
    db.cashShift.count({ where: { branchId: branch.id, status: "OPEN" } }),
  ]);
  const k = report.kpi;
  return {
    day,
    total: k.total,
    serviceOneTime: k.serviceOneTime,
    serviceCourse: k.serviceCourse,
    service: k.service,
    product: k.product,
    net: k.net,
    sales: k.sales,
    discounts: (discounts._sum.lineDiscountTotal ?? 0) + (discounts._sum.saleDiscount ?? 0),
    refunds: k.refunds,
    refundCount: k.refundCount,
    payments: report.payments,
    cashDifference: closed._count ? (closed._sum.difference ?? 0) : null,
    closedShifts: closed._count,
    openShifts: open,
    byService: report.byService,
    byProduct: report.byProduct,
  };
}

/** Задаргаагүй хураангуй (DB-д хадгалах, имэйлд) */
export function headline(full: Awaited<ReturnType<typeof dailySummary>>): DailySummary {
  const { byService, byProduct, ...summary } = full;
  void byService;
  void byProduct;
  return summary;
}

/** Excel: «Хураангуй», «Үйлчилгээ», «Бүтээгдэхүүн» */
export async function buildDailyExcel(s: Awaited<ReturnType<typeof dailySummary>>): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "CLÉSS";
  wb.created = new Date();
  const money = '#,##0"₮"';
  const head = (ws: ExcelJS.Worksheet) => {
    const h = ws.getRow(1);
    h.font = { bold: true, color: { argb: "FFFFFFFF" } };
    h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0E2243" } };
  };

  const sum = wb.addWorksheet(A.sheetSummary);
  sum.columns = [
    { header: A.sheetSummary, width: 36 },
    { header: s.day, width: 18, style: { numFmt: money } },
  ];
  head(sum);
  for (const [label, value] of summaryLines(s)) sum.addRow([label, value]);

  for (const [name, rows] of [
    [A.sheetServices, s.byService],
    [A.sheetProducts, s.byProduct],
  ] as const) {
    const ws = wb.addWorksheet(name);
    ws.columns = [
      { header: A.colName, width: 44 },
      { header: A.colQty, width: 10 },
      { header: A.colAmount, width: 16, style: { numFmt: money } },
    ];
    head(ws);
    for (const r of rows) ws.addRow([r.name, r.qty, r.amount]);
  }
  return new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer);
}

const PAY = t.admin.payMethod;

/** Имэйл, Excel, баталгаажуулах цонхонд ижил мөрүүд */
export function summaryLines(s: DailySummary): [string, number | string][] {
  return [
    [A.lineServiceOneTime, s.serviceOneTime],
    [A.lineServiceCourse, s.serviceCourse],
    [A.lineService, s.service],
    [A.lineProduct, s.product],
    [A.lineTotal, s.total],
    [A.lineNet, s.net],
    [A.lineSales, `${s.sales}`],
    [A.lineDiscounts, s.discounts],
    [A.lineRefunds(s.refundCount), s.refunds],
    ...s.payments.map((p) => [A.linePayment(PAY[p.method] ?? p.method), p.amount] as [string, number]),
    [A.lineCashDiff, s.cashDifference === null ? A.noClosedShift : s.cashDifference],
  ];
}

// ───────────────────────── Илгээх ─────────────────────────

export const sendSchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  resend: z.boolean().default(false),
});

export type SendResult =
  | { status: "queued"; dispatchId: string }
  | { status: "confirm-resend"; previous: { status: string; at: Date; by: string | null } };

export async function requestAccountantSend(raw: z.input<typeof sendSchema>, actorId: string): Promise<SendResult> {
  const { day, resend } = sendSchema.parse(raw);
  if (day > ubDateKey()) throw new UserError(A.futureDay);
  if (day < addDays(ubDateKey(), -366)) throw new UserError(A.tooOld);
  const recipients = await getAccountantEmails();
  if (recipients.length === 0) throw new UserError(A.noRecipients);

  const previous = await db.reportDispatch.findFirst({
    where: { day, status: { in: ["PENDING", "SENT"] } },
    orderBy: { createdAt: "desc" },
    select: { status: true, createdAt: true, sentAt: true, sentBy: { select: { name: true } } },
  });
  if (previous && !resend) {
    return { status: "confirm-resend", previous: { status: previous.status, at: previous.sentAt ?? previous.createdAt, by: previous.sentBy?.name ?? null } };
  }

  const summary = headline(await dailySummary(day));
  const dispatch = await db.$transaction(async (tx) => {
    const d = await tx.reportDispatch.create({
      data: { day, recipients, sentById: actorId, summary: summary as unknown as Prisma.InputJsonValue },
      select: { id: true },
    });
    await enqueue(tx, { type: "ACCOUNTANT_REPORT", payload: { dispatchId: d.id }, dedupeKey: `accountant:${d.id}` });
    // Хаягийг тоогоор л — хувийн мэдээлэл audit-д давхардуулахгүй
    await audit(tx, { userId: actorId, action: "report.send", entity: "ReportDispatch", entityId: d.id, after: { day, recipients: recipients.length, resend } });
    return d;
  });
  return { status: "queued", dispatchId: dispatch.id };
}

/** Worker: ACCOUNTANT_REPORT. Илгээх үеийн дүнгээр (хаалтаас хойш өөрчлөгдсөн бол шинэчилнэ). */
export async function deliverAccountantReport(jobId: string, dispatchId: string): Promise<"sent" | "skipped"> {
  const d = await db.reportDispatch.findUnique({ where: { id: dispatchId } });
  if (!d || d.status === "SENT") return "skipped";
  try {
    const full = await dailySummary(d.day);
    const summary = headline(full);
    const [salon, excel] = await Promise.all([getCurrentBranch().then((b) => b.name), buildDailyExcel(full)]);
    // WeSend хавсралт дамжуулдаггүй → Excel-ийг системээс татах холбоос (report:send эрхтэй, нэвтэрсэн)
    const downloadUrl = emailSupportsAttachments() ? null : `${SITE_URL}/api/admin/reports/accountant/${d.id}`;
    // PROMPT 18 §2.5: "Бүх системийн тайлан" (сарын эхнээс тухайн өдөр хүртэл) — хувийн, 7 хоногийн хугацаатай холбоос
    const fullReportUrl = `${SITE_URL}/api/finance/export/${exportToken({ from: `${d.day.slice(0, 8)}01`, to: d.day })}`;
    const mail = await renderAccountantEmail({ salonName: salon, summary, lines: summaryLines(summary), downloadUrl, fullReportUrl });
    await sendEmail({
      id: jobId,
      to: d.recipients,
      ...mail,
      attachments: [{ filename: `tailan_${d.day}.xlsx`, content: excel, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }],
    });
    await db.reportDispatch.update({
      where: { id: d.id },
      data: { status: "SENT", sentAt: new Date(), error: null, summary: summary as unknown as Prisma.InputJsonValue },
    });
    return "sent";
  } catch (e) {
    // Дахин оролдоно (backoff) — сүүлийн алдааг түүхэнд харуулна
    await db.reportDispatch.update({ where: { id: d.id }, data: { error: e instanceof Error ? e.message.slice(0, 500) : String(e) } });
    throw e;
  }
}

export async function markAccountantFailed(dispatchId: string, error: string) {
  await db.reportDispatch.updateMany({ where: { id: dispatchId, status: "PENDING" }, data: { status: "FAILED", error: error.slice(0, 500) } });
}

export async function listDispatches(opts: { day?: string; take?: number } = {}) {
  return db.reportDispatch.findMany({
    where: opts.day ? { day: opts.day } : {},
    orderBy: { createdAt: "desc" },
    take: opts.take ?? 30,
    select: { id: true, day: true, recipients: true, status: true, error: true, sentAt: true, createdAt: true, summary: true, sentBy: { select: { name: true } } },
  });
}
