/**
 * Worker: INQUIRY_EMAIL — ресепшний имэйл (Тохиргоо → Салоны мэдээлэл, эсвэл Имэйл → reply-to) руу.
 * Хаяг тохируулаагүй бол алгасна (хүсэлт админ → Хүсэлтүүд хэсэгт харагдсаар).
 */
import type { FooterSetting } from "@/lib/site-settings";
import { db } from "@/server/db";
import type { InquiryItem } from "@/server/modules/inquiries/service";
import { getEmailSettings } from "@/server/modules/settings/pos-settings";
import type { DeliveryResult } from "./appointment-delivery";
import { renderInquiryEmail } from "./inquiry-email";
import { sendEmail } from "./mailer";

export async function deliverInquiryEmail(jobId: string, inquiryId: string): Promise<DeliveryResult> {
  const [inquiry, branch, footerRow, emailSettings] = await Promise.all([
    db.productInquiry.findUnique({ where: { id: inquiryId } }),
    db.branch.findFirst({ where: { code: "CL" }, select: { name: true } }),
    db.siteSetting.findUnique({ where: { key: "footer" } }),
    getEmailSettings(),
  ]);
  if (!inquiry || inquiry.status === "CANCELLED") return "skipped";
  const to = (footerRow?.value as FooterSetting | undefined)?.contact?.email || emailSettings.replyTo;
  if (!to) return "skipped";
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const mail = await renderInquiryEmail({
    salonName: branch?.name ?? "",
    name: inquiry.name,
    phone: inquiry.phone,
    items: inquiry.items as unknown as InquiryItem[],
    note: inquiry.note,
    adminUrl: `${site}/admin/inquiries`,
  });
  await sendEmail({ id: jobId, to, ...mail });
  return "sent";
}
