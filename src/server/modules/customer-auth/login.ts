/**
 * Үйлчлүүлэгчийн нууц үггүй нэвтрэлт (PROMPT 15 §3): утас (эсвэл имэйл) → код → нэвтэрсэн.
 *  - Утсаар Customer-тэй тааруулна (A2-ын нормчлол). Ресепшн аль хэдийн бүртгэсэн бол ШИНЭ МӨР ҮҮСГЭХГҮЙ — түүх хадгалагдана.
 *  - Байхгүй бол нэр + хувийн мэдээллийн зөвшөөрөл (огноотой) асууж шинэ Customer (registeredVia = ONLINE).
 *  - Имэйлээр код — зөвхөн имэйлтэй бүртгэлтэй үйлчлүүлэгчид (шинэ бүртгэл утсаар).
 */
import { z } from "zod";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { UserError } from "@/server/errors";
import { normalizePhone } from "@/server/modules/customers/service";
import { assertSendAllowed, checkCode, startCode } from "@/server/modules/verification/service";

const GENERIC = "Код илгээгдлээ.";
const COMPLETE_WINDOW_MS = 15 * 60_000;

export function normalizeCustomerTarget(raw: string): string | null {
  const v = raw.trim().toLowerCase();
  if (v.includes("@")) return z.email().safeParse(v).success ? v : null;
  return normalizePhone(v);
}

export async function requestCustomerCode(p: { to: string; ip: string }) {
  const to = normalizeCustomerTarget(p.to);
  if (!to) throw new UserError("8 оронтой утасны дугаар эсвэл имэйлээ оруулна уу.", { to: ["Утас эсвэл имэйл буруу."] });
  if (to.includes("@")) {
    const c = await db.customer.findFirst({ where: { email: to }, select: { id: true } });
    if (!c) {
      // Бүртгэл байгаа эсэхийг задруулахгүй — хязгаарыг тоолоод ижил хариу
      await assertSendAllowed(to, p.ip);
      return { id: `c${Date.now().toString(36)}x`, message: "Хэрэв энэ имэйлээр бүртгэлтэй бол код илгээгдлээ. Анх удаа бол утсаараа нэвтэрнэ үү." };
    }
    const s = await startCode({ purpose: "CUSTOMER_LOGIN", to, ip: p.ip, customerId: c.id });
    return { id: s.id, message: GENERIC, devCode: (s as { devCode?: string }).devCode };
  }
  const existing = await db.customer.findUnique({ where: { phone: to }, select: { id: true } });
  const s = await startCode({ purpose: "CUSTOMER_LOGIN", to, ip: p.ip, customerId: existing?.id ?? null });
  return { id: s.id, message: GENERIC, devCode: (s as { devCode?: string }).devCode };
}

export type CodeResult = { status: "signed-in"; customerId: string } | { status: "needs-profile"; verificationId: string };

/** Код зөв: байгаа үйлчлүүлэгч бол нэвтэрнэ (зөвшөөрөлгүй бол профайл асууна), шинэ бол профайл асууна */
export async function verifyCustomerCode(p: { id: string; to: string; code: string }, now = new Date()): Promise<CodeResult> {
  const to = normalizeCustomerTarget(p.to);
  if (!to) throw new UserError("Утас эсвэл имэйл буруу.");
  const v = await checkCode({ id: p.id, code: p.code, purpose: "CUSTOMER_LOGIN", to }, now);
  const customer = to.includes("@")
    ? await db.customer.findFirst({ where: { email: to }, select: { id: true, dataConsentAt: true } })
    : await db.customer.findUnique({ where: { phone: to }, select: { id: true, dataConsentAt: true } });
  if (customer?.dataConsentAt) {
    await markLogin(customer.id, now);
    return { status: "signed-in", customerId: customer.id };
  }
  return { status: "needs-profile", verificationId: v.id };
}

export const profileSchema = z.object({
  verificationId: z.string().min(1),
  to: z.string().min(3),
  name: z.string().trim().min(2, "Нэрээ оруулна уу.").max(120),
  consent: z.literal(true, { error: "Хувийн мэдээлэл ашиглахыг зөвшөөрнө үү." }),
  emailConsent: z.boolean().default(false),
});

/** Код баталгаажсаны дараа (15 мин дотор): шинэ бол үүсгэх, байгаа бол зөвшөөрлийг бичих. Нэг verification нэг л удаа. */
export async function completeCustomerProfile(raw: z.input<typeof profileSchema>, now = new Date()) {
  const v = profileSchema.parse(raw);
  const to = normalizeCustomerTarget(v.to);
  if (!to) throw new UserError("Утас эсвэл имэйл буруу.");
  return db.$transaction(async (tx) => {
    const ver = await tx.verification.findUnique({ where: { id: v.verificationId } });
    const { hashTarget } = await import("@/server/modules/verification/service");
    if (!ver || ver.purpose !== "CUSTOMER_LOGIN" || ver.status !== "APPROVED" || !ver.approvedAt || now.getTime() - ver.approvedAt.getTime() > COMPLETE_WINDOW_MS || ver.targetHash !== hashTarget(to)) {
      throw new UserError("Баталгаажуулалтын хугацаа дууссан. Дахин код авна уу.");
    }
    // Нэг удаа: approvedAt-ийг "ашигласан" гэж тэмдэглэнэ (status → CANCELED)
    const used = await tx.verification.updateMany({ where: { id: ver.id, status: "APPROVED" }, data: { status: "CANCELED" } });
    if (used.count !== 1) throw new UserError("Баталгаажуулалт аль хэдийн ашиглагдсан. Дахин код авна уу.");

    const existing = to.includes("@") ? await tx.customer.findFirst({ where: { email: to } }) : await tx.customer.findUnique({ where: { phone: to } });
    if (existing) {
      // Ресепшний бүртгэлтэй нэгтгэнэ — нэрийг дарж бичихгүй (ресепшн зассан байж болно)
      await tx.customer.update({
        where: { id: existing.id },
        data: { dataConsentAt: now, lastLoginAt: now, onlineRegisteredAt: existing.onlineRegisteredAt ?? now, ...(v.emailConsent && !existing.emailConsentAt ? { emailConsentAt: now } : {}) },
      });
      await audit(tx, { userId: null, action: "customer.online_link", entity: "Customer", entityId: existing.id, after: { consent: true } });
      return { customerId: existing.id, created: false };
    }
    if (to.includes("@")) throw new UserError("Анх удаа бол утсаараа нэвтэрнэ үү.");
    const c = await tx.customer.create({
      data: { name: v.name, phone: to, registeredVia: "ONLINE", onlineRegisteredAt: now, lastLoginAt: now, dataConsentAt: now, emailConsentAt: v.emailConsent ? now : null },
    });
    await audit(tx, { userId: null, action: "customer.online_register", entity: "Customer", entityId: c.id, after: { registeredVia: "ONLINE" } });
    return { customerId: c.id, created: true };
  });
}

async function markLogin(customerId: string, now: Date) {
  await db.customer.update({ where: { id: customerId }, data: { lastLoginAt: now } });
}
