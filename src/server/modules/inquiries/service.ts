/**
 * "Салонд захиалах" — нөөцлүүлэх хүсэлт (CATALOG горим). Нөөц түгжихгүй: ресепшн утсаар холбогдоно.
 *  - spam: honeypot талбар, 10 минутад IP / утас тус бүр ≤3, 8 оронтой Монгол дугаар
 *  - үүсгэхэд outbox INQUIRY_EMAIL (ресепшний имэйл руу) нэг transaction-д
 *  - хариу мессеж салбарын ажлын цагаас ("1 цагийн дотор" / "Маргааш ажлын цагаар …")
 */
import { z } from "zod";
import type { InquiryStatus, Prisma } from "@/generated/prisma/client";
import { contactWindow, inquiryReply } from "@/lib/hours";
import { t } from "@/i18n";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { UserError } from "@/server/errors";
import { enqueue } from "@/server/modules/outbox/service";
import { bookingSettingsSchema } from "@/server/modules/settings/schema";

export const INQUIRY_WINDOW_MS = 10 * 60 * 1000;
export const INQUIRY_MAX_PER_WINDOW = 3;
export const INQUIRY_STATUSES = ["NEW", "CONTACTED", "DONE", "CANCELLED"] as const satisfies readonly InquiryStatus[];

/** "+976 9911-2233", "9911 2233" → "99112233"; буруу бол null */
export function normalizeMnPhone(raw: string): string | null {
  let d = raw.replace(/[\s\-().]/g, "");
  if (d.startsWith("+976")) d = d.slice(4);
  else if (d.startsWith("976") && d.length === 11) d = d.slice(3);
  return /^[5-9]\d{7}$/.test(d) ? d : null;
}

export const inquirySchema = z.object({
  name: z.string().trim().min(2, t.inquiry.nameRequired).max(80),
  phone: z.string().transform((v, ctx) => {
    const p = normalizeMnPhone(v);
    if (!p) ctx.addIssue({ code: "custom", message: t.inquiry.phoneInvalid });
    return p ?? "";
  }),
  items: z
    .array(z.object({ variantId: z.string().min(1).max(40), qty: z.number().int().min(1).max(20) }))
    .min(1)
    .max(10),
  note: z.string().trim().max(500).optional().default(""),
  /** Honeypot — хүн бөглөдөггүй (нуусан) талбар */
  website: z.string().optional().default(""),
});
export type InquiryInput = z.input<typeof inquirySchema>;

export type InquiryItem = { variantId: string; productName: string; size: string; qty: number; price: number };

export async function submitInquiry(raw: InquiryInput, ctx: { ip: string | null; now?: Date }): Promise<{ message: string }> {
  const now = ctx.now ?? new Date();
  const d = inquirySchema.parse(raw);
  const reply = async () => {
    const row = await db.siteSetting.findUnique({ where: { key: "booking" } });
    return { message: inquiryReply(contactWindow(bookingSettingsSchema.parse(row?.value ?? {}).hours, now)) };
  };
  // Bot: амжилттай мэт хариулна, юу ч хадгалахгүй
  if (d.website.trim()) return reply();

  const since = new Date(now.getTime() - INQUIRY_WINDOW_MS);
  const [byPhone, byIp] = await Promise.all([
    db.productInquiry.count({ where: { phone: d.phone, createdAt: { gt: since } } }),
    ctx.ip ? db.productInquiry.count({ where: { ip: ctx.ip, createdAt: { gt: since } } }) : 0,
  ]);
  if (byPhone >= INQUIRY_MAX_PER_WINDOW || byIp >= INQUIRY_MAX_PER_WINDOW) throw new UserError(t.inquiry.tooMany, undefined, "RATE_LIMITED");

  // Нэр, үнийг клиентээс биш DB-ээс
  const variants = await db.variant.findMany({
    where: { id: { in: d.items.map((i) => i.variantId) }, isActive: true, product: { isPublished: true } },
    select: { id: true, size: true, price: true, product: { select: { name: true } } },
  });
  const items: InquiryItem[] = d.items.map((i) => {
    const v = variants.find((x) => x.id === i.variantId);
    if (!v) throw new UserError(t.inquiry.itemMissing);
    return { variantId: v.id, productName: v.product.name, size: v.size, qty: i.qty, price: v.price };
  });

  await db.$transaction(async (tx) => {
    const inquiry = await tx.productInquiry.create({
      data: { name: d.name, phone: d.phone, items: items as unknown as Prisma.InputJsonValue, note: d.note || null, ip: ctx.ip, createdAt: now },
    });
    await enqueue(tx, { type: "INQUIRY_EMAIL", payload: { inquiryId: inquiry.id }, dedupeKey: `inquiry:${inquiry.id}` });
  });
  return reply();
}

export function countNewInquiries() {
  return db.productInquiry.count({ where: { status: "NEW" } });
}

export async function listInquiries(status?: InquiryStatus) {
  const rows = await db.productInquiry.findMany({
    where: status ? { status } : undefined,
    orderBy: [{ createdAt: "desc" }],
    take: 200,
    select: { id: true, name: true, phone: true, items: true, note: true, status: true, createdAt: true, updatedAt: true, handledBy: { select: { name: true } } },
  });
  return rows.map((r) => ({ ...r, items: r.items as unknown as InquiryItem[] }));
}

export async function setInquiryStatus(id: string, status: InquiryStatus, actorId: string) {
  const next = z.enum(INQUIRY_STATUSES).parse(status);
  return db.$transaction(async (tx) => {
    const before = await tx.productInquiry.findUnique({ where: { id }, select: { status: true } });
    if (!before) throw new UserError("Хүсэлт олдсонгүй.");
    await tx.productInquiry.update({ where: { id }, data: { status: next, handledById: actorId } });
    await audit(tx, { userId: actorId, action: "inquiry.status", entity: "ProductInquiry", entityId: id, before, after: { status: next } });
  });
}
