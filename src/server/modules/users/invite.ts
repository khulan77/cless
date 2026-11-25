/**
 * Ажилтны урилга → код → нууц үг (PROMPT 15 §2).
 *
 *   createInvitedUser: нэр, утас (заавал), имэйл (сонголтоор), role — нууц үггүй. Төлөв INVITED, 72 цаг.
 *   sendInvite:        SMS (утас) эсвэл имэйлээр /admin/activate холбоос. (WeSend-ийн код хамгийн ихдээ 10 мин
 *                      хүчинтэй тул кодыг идэвхжүүлэх хуудсан дээр хүсэхэд илгээнэ.)
 *   activate:          утас/имэйл + код + шинэ нууц үг → ACTIVE. Код нэг л удаа.
 *   reset:             нууц үг мартсан — бүртгэл байгаа эсэхийг задруулахгүй.
 *   confirmPhone:      хуучин хэрэглэгч утсаа баталгаажуулж утсаар нэвтрэх боломжтой болно.
 * Утас, код, нууц үгийг log/audit-д бичихгүй.
 */
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { Prisma, Role } from "@/generated/prisma/client";
import { SITE_URL } from "@/lib/site-url";
import { passwordPairSchema } from "@/lib/validation/password";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { ForbiddenError, UserError } from "@/server/errors";
import { bookableAfterRoleChange, defaultBookable } from "@/server/modules/appointments/bookable";
import { normalizePhone } from "@/server/modules/customers/service";
import { sendEmail } from "@/server/modules/notifications/mailer";
import { sendSms } from "@/server/modules/notifications/sms";
import { brand } from "@/server/modules/notifications/providers/wesend";
import { checkCode, startCode } from "@/server/modules/verification/service";
import { canAssign, canEditSalary, canManageUser } from "./policy";

export const INVITE_HOURS = 72;
const GENERIC_SENT = "Хэрэв бүртгэлтэй бол код илгээгдлээ.";
export const MSG = {
  noPermission: "Энэ эрхтэй хэрэглэгч нэмэх/засах эрх танд алга.",
  phoneTaken: "Энэ утасны дугаартай ажилтан бүртгэлтэй байна.",
  emailTaken: "Энэ имэйлтэй ажилтан бүртгэлтэй байна.",
  phoneInvalid: "8 оронтой утасны дугаар оруулна уу.",
  inviteExpired: "Урилгын хугацаа дууссан. Админаас дахин урилга авна уу.",
  genericSent: GENERIC_SENT,
} as const;

type Actor = { id: string; role: Role };

const phoneField = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const n = normalizePhone(v);
    if (!n) ctx.addIssue({ code: "custom", message: MSG.phoneInvalid });
    return n ?? "";
  });
const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .max(200)
  .transform((v) => v || null)
  .pipe(z.email("Имэйл хаяг буруу байна.").nullable());

export const inviteSchema = z.object({
  name: z.string().trim().min(2, "Нэрээ оруулна уу.").max(120),
  phone: phoneField,
  email: emailField.optional().default(null),
  role: z.enum(["ADMIN", "MANAGER", "ACCOUNTANT", "STAFF"]),
  baseSalary: z.coerce.number().int().min(0).max(1_000_000_000).optional(),
});

/** "99112233" эсвэл имэйл → нэвтрэх хайлтын нөхцөл */
export function identifierWhere(raw: string): Prisma.UserWhereInput | null {
  const v = raw.trim().toLowerCase();
  if (v.includes("@")) return z.email().safeParse(v).success ? { email: v } : null;
  const p = normalizePhone(v);
  return p ? { loginPhone: p } : null;
}
/** Хэвийн болгосон утас/имэйл (кодыг энд илгээнэ) */
export function normalizeIdentifier(raw: string): string | null {
  const v = raw.trim().toLowerCase();
  if (v.includes("@")) return z.email().safeParse(v).success ? v : null;
  return normalizePhone(v);
}

const unusableHash = () => bcrypt.hash(randomBytes(32).toString("hex"), 10);

async function assertUnique(tx: Prisma.TransactionClient, phone: string, email: string | null, exceptId?: string) {
  const [p, e] = await Promise.all([
    tx.user.findFirst({ where: { loginPhone: phone, ...(exceptId && { id: { not: exceptId } }) }, select: { id: true } }),
    email ? tx.user.findFirst({ where: { email, ...(exceptId && { id: { not: exceptId } }) }, select: { id: true } }) : null,
  ]);
  if (p) throw new UserError(MSG.phoneTaken, { phone: [MSG.phoneTaken] });
  if (e) throw new UserError(MSG.emailTaken, { email: [MSG.emailTaken] });
}

export async function createInvitedUser(raw: z.input<typeof inviteSchema>, actor: Actor, now = new Date()) {
  const v = inviteSchema.parse(raw);
  if (!canAssign(actor.role, null, v.role)) throw new ForbiddenError(MSG.noPermission);
  // Цалинг зөвхөн ADMIN, ACCOUNTANT — бусад нь оруулсан ч үл тооно
  const baseSalary = canEditSalary(actor.role) ? (v.baseSalary ?? 0) : 0;
  const user = await db.$transaction(async (tx) => {
    await assertUnique(tx, v.phone, v.email);
    const u = await tx.user.create({
      data: {
        name: v.name,
        phone: v.phone,
        loginPhone: v.phone,
        email: v.email,
        role: v.role,
        baseSalary,
        passwordHash: await unusableHash(),
        isBookable: defaultBookable(v.role),
        status: "INVITED",
        invitedAt: now,
        invitedById: actor.id,
        inviteExpiresAt: new Date(now.getTime() + INVITE_HOURS * 3600_000),
      },
      select: { id: true, name: true, role: true },
    });
    await audit(tx, { userId: actor.id, action: "user.invite", entity: "User", entityId: u.id, after: { name: u.name, role: u.role, baseSalary } });
    return u;
  });
  const delivery = await sendInvite(user.id).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e) }));
  return { id: user.id, delivery };
}

/** Урилгын SMS/имэйл (идэвхжүүлэх холбоос). Алдааг буцаана — хэрэглэгч үүссэн хэвээр, "Дахин илгээх" боломжтой. */
export async function sendInvite(userId: string) {
  const u = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, loginPhone: true, email: true } });
  const link = `${SITE_URL}/admin/activate`;
  const text = `${brand()}: ${u.name}, таныг удирдлагын системд урьлаа. ${INVITE_HOURS} цагийн дотор ${link} хаягаар орж утсаа баталгаажуулан нууц үгээ үүсгэнэ үү.`;
  if (u.loginPhone) {
    await sendSms({ id: `invite:${userId}:${Date.now()}`, to: u.loginPhone, text, kind: "STAFF_INVITE" });
  } else if (u.email) {
    await sendEmail({
      id: `invite:${userId}:${Date.now()}`,
      to: u.email,
      kind: "STAFF_INVITE",
      subject: `${brand()} — урилга`,
      text,
      html: `<p>${escapeHtml(u.name)}, таныг ${escapeHtml(brand())}-ийн удирдлагын системд урьлаа.</p><p><a href="${link}">Бүртгэлээ идэвхжүүлэх</a> (${INVITE_HOURS} цагийн дотор).</p>`,
    });
  }
  return { ok: true as const };
}

async function loadManaged(tx: Prisma.TransactionClient, id: string, actor: Actor) {
  const u = await tx.user.findUnique({ where: { id }, select: { id: true, role: true, status: true, isActive: true, loginPhone: true, email: true } });
  if (!u) throw new UserError("Хэрэглэгч олдсонгүй.");
  if (!canManageUser(actor.role, u.role)) throw new ForbiddenError(MSG.noPermission);
  return u;
}

export async function resendInvite(id: string, actor: Actor, now = new Date()) {
  await db.$transaction(async (tx) => {
    const u = await loadManaged(tx, id, actor);
    if (u.status !== "INVITED") throw new UserError("Энэ хэрэглэгч аль хэдийн идэвхжсэн.");
    await tx.user.update({ where: { id }, data: { isActive: true, inviteExpiresAt: new Date(now.getTime() + INVITE_HOURS * 3600_000), invitedAt: now, invitedById: actor.id } });
    await audit(tx, { userId: actor.id, action: "user.invite_resend", entity: "User", entityId: id });
  });
  await sendInvite(id);
}

export async function cancelInvite(id: string, actor: Actor, now = new Date()) {
  await db.$transaction(async (tx) => {
    const u = await loadManaged(tx, id, actor);
    if (u.status !== "INVITED") throw new UserError("Энэ хэрэглэгч аль хэдийн идэвхжсэн.");
    await tx.user.update({ where: { id }, data: { isActive: false, inviteExpiresAt: now } });
    await tx.verification.updateMany({ where: { userId: id, status: "PENDING" }, data: { status: "CANCELED" } });
    await audit(tx, { userId: actor.id, action: "user.invite_cancel", entity: "User", entityId: id });
  });
}

// ───────────────────────── Нийтийн урсгал (нэвтрээгүй) ─────────────────────────

/** Хэрэв бүртгэл байхгүй ч ижил хариу — "код илгээгдлээ" (бүртгэл байгаа эсэхийг задруулахгүй) */
function fakeId() {
  return `c${randomBytes(12).toString("hex")}`;
}

export async function requestStaffCode(p: { identifier: string; purpose: "STAFF_INVITE" | "STAFF_RESET"; ip: string }, now = new Date()) {
  const to = normalizeIdentifier(p.identifier);
  if (!to) throw new UserError("Утас эсвэл имэйлээ зөв оруулна уу.", { identifier: ["Утас эсвэл имэйл буруу."] });
  const where = identifierWhere(to)!;
  const user = await db.user.findFirst({ where: { ...where, isActive: true }, select: { id: true, status: true, inviteExpiresAt: true } });
  const eligible =
    user && (p.purpose === "STAFF_INVITE" ? user.status === "INVITED" && (user.inviteExpiresAt ?? now) > now : user.status === "ACTIVE");
  if (!eligible) {
    // Хязгаарыг ч тоолно (бүртгэлгүй дугаарыг тоолж оролдохоос хамгаална)
    const { assertSendAllowed } = await import("@/server/modules/verification/service");
    await assertSendAllowed(to, p.ip, now);
    return { id: fakeId(), message: GENERIC_SENT };
  }
  const s = await startCode({ purpose: p.purpose, to, ip: p.ip, userId: user.id }, now);
  return { id: s.id, message: GENERIC_SENT, devCode: (s as { devCode?: string }).devCode };
}

export const activateSchema = z.object({ id: z.string().min(1), identifier: z.string().min(3).max(200), code: z.string().min(4).max(10) }).and(passwordPairSchema);

async function setPassword(userId: string, password: string, action: string, now: Date, extra: Prisma.UserUpdateInput = {}) {
  const passwordHash = await bcrypt.hash(password, 12);
  await db.$transaction(async (tx) => {
    const u = await tx.user.update({ where: { id: userId }, data: { passwordHash, mustChangePassword: false, passwordChangedAt: now, ...extra }, select: { email: true, loginPhone: true } });
    await audit(tx, { userId, action, entity: "User", entityId: userId });
    // Түгжигдсэн бол нээх
    const keys = [u.email && `email:${u.email}`, u.loginPhone && `email:${u.loginPhone}`].filter(Boolean) as string[];
    if (keys.length) await tx.loginAttempt.deleteMany({ where: { key: { in: keys }, success: false } });
  });
}

export async function activateAccount(raw: z.input<typeof activateSchema>, now = new Date()) {
  const v = activateSchema.parse(raw);
  const to = normalizeIdentifier(v.identifier);
  if (!to) throw new UserError("Утас эсвэл имэйл буруу.");
  const ver = await checkCode({ id: v.id, code: v.code, purpose: "STAFF_INVITE", to }, now);
  const u = ver.userId ? await db.user.findUnique({ where: { id: ver.userId }, select: { id: true, status: true, isActive: true, inviteExpiresAt: true } }) : null;
  if (!u || u.status !== "INVITED" || !u.isActive) throw new UserError("Урилга хүчингүй байна.");
  if ((u.inviteExpiresAt ?? now) <= now) throw new UserError(MSG.inviteExpired);
  await setPassword(u.id, v.password, "user.activated", now, { status: "ACTIVE", activatedAt: now, inviteExpiresAt: null });
  return { userId: u.id };
}

export async function resetWithCode(raw: z.input<typeof activateSchema>, now = new Date()) {
  const v = activateSchema.parse(raw);
  const to = normalizeIdentifier(v.identifier);
  if (!to) throw new UserError("Утас эсвэл имэйл буруу.");
  const ver = await checkCode({ id: v.id, code: v.code, purpose: "STAFF_RESET", to }, now);
  const u = ver.userId ? await db.user.findUnique({ where: { id: ver.userId }, select: { id: true, status: true, isActive: true } }) : null;
  if (!u || u.status !== "ACTIVE" || !u.isActive) throw new UserError("Код хүчингүй байна. Шинэ код авна уу.");
  // passwordChangedAt шинэчлэгдэж бүх хуучин session хүчингүй
  await setPassword(u.id, v.password, "user.reset_with_code", now);
  return { userId: u.id };
}

// ───────────────────────── Нэвтэрсэн хэрэглэгч: утсаа баталгаажуулах ─────────────────────────

export async function requestPhoneCode(userId: string, rawPhone: string, ip: string) {
  const phone = normalizePhone(rawPhone);
  if (!phone) throw new UserError(MSG.phoneInvalid, { phone: [MSG.phoneInvalid] });
  const taken = await db.user.findFirst({ where: { loginPhone: phone, id: { not: userId } }, select: { id: true } });
  if (taken) throw new UserError(MSG.phoneTaken, { phone: [MSG.phoneTaken] });
  const s = await startCode({ purpose: "STAFF_PHONE", to: phone, ip, userId });
  return { id: s.id, mask: s.mask, devCode: (s as { devCode?: string }).devCode };
}

export async function confirmPhone(userId: string, p: { id: string; phone: string; code: string }) {
  const phone = normalizePhone(p.phone);
  if (!phone) throw new UserError(MSG.phoneInvalid);
  const ver = await checkCode({ id: p.id, code: p.code, purpose: "STAFF_PHONE", to: phone });
  if (ver.userId !== userId) throw new UserError("Код хүчингүй байна.");
  await db.$transaction(async (tx) => {
    const taken = await tx.user.findFirst({ where: { loginPhone: phone, id: { not: userId } }, select: { id: true } });
    if (taken) throw new UserError(MSG.phoneTaken);
    await tx.user.update({ where: { id: userId }, data: { loginPhone: phone, phone } });
    await audit(tx, { userId, action: "user.phone_verified", entity: "User", entityId: userId });
  });
}

// ───────────────────────── Засах (ADMIN / MANAGER — policy) ─────────────────────────

export const editUserSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2).max(120),
  phone: phoneField,
  email: emailField.optional().default(null),
  role: z.enum(["ADMIN", "MANAGER", "ACCOUNTANT", "STAFF"]),
  baseSalary: z.coerce.number().int().min(0).max(1_000_000_000).optional(),
  isActive: z.boolean(),
});

export async function editUser(raw: z.input<typeof editUserSchema>, actor: Actor) {
  const v = editUserSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const before = await tx.user.findUnique({
      where: { id: v.id },
      select: { id: true, name: true, email: true, phone: true, loginPhone: true, role: true, isActive: true, isBookable: true, baseSalary: true },
    });
    if (!before) throw new UserError("Хэрэглэгч олдсонгүй.");
    // MANAGER: зөвхөн STAFF-ийг, зөвхөн STAFF хэвээр (дэвшүүлэхгүй)
    if (!canAssign(actor.role, before.role, v.role)) throw new ForbiddenError(MSG.noPermission);
    if (v.id === actor.id) {
      if (!v.isActive) throw new UserError("Өөрийгөө идэвхгүй болгох боломжгүй.", { isActive: ["Өөрийгөө идэвхгүй болгох боломжгүй."] });
      if (v.role !== before.role) throw new UserError("Өөрийнхөө эрхийг өөрчлөх боломжгүй.", { role: ["Өөрийнхөө эрхийг өөрчлөх боломжгүй."] });
    }
    const losesAdmin = before.role === "ADMIN" && before.isActive && (v.role !== "ADMIN" || !v.isActive);
    if (losesAdmin) {
      const admins = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "User" WHERE "role" = 'ADMIN' AND "isActive" = true FOR UPDATE`;
      if (admins.filter((a) => a.id !== v.id).length === 0) throw new UserError("Сүүлийн идэвхтэй админы эрхийг бууруулах / идэвхгүй болгох боломжгүй.");
    }
    const phoneChanged = v.phone !== before.loginPhone;
    if (phoneChanged || v.email !== before.email) await assertUnique(tx, v.phone, v.email !== before.email ? v.email : null, v.id);
    const after = await tx.user.update({
      where: { id: v.id },
      data: {
        name: v.name,
        phone: v.phone,
        loginPhone: v.phone,
        email: v.email,
        role: v.role,
        isActive: v.isActive,
        isBookable: bookableAfterRoleChange(before, v.role),
        // Цалин — зөвхөн ADMIN, ACCOUNTANT
        ...(canEditSalary(actor.role) && v.baseSalary !== undefined ? { baseSalary: v.baseSalary } : {}),
      },
      select: { id: true, name: true, role: true, isActive: true, baseSalary: true },
    });
    const action = before.isActive && !after.isActive ? "user.deactivate" : !before.isActive && after.isActive ? "user.activate" : "user.update";
    await audit(tx, {
      userId: actor.id,
      action,
      entity: "User",
      entityId: v.id,
      before: { name: before.name, role: before.role, isActive: before.isActive, baseSalary: before.baseSalary, phoneChanged: false },
      after: { ...after, phoneChanged },
    });
    return after;
  });
}

/** Нөөц: түр нууц үг (утасгүй үед) — ADMIN, MANAGER (STAFF-д) */
export async function setTemporaryPassword(id: string, password: string, actor: Actor) {
  await db.$transaction(async (tx) => {
    const u = await loadManaged(tx, id, actor);
    const passwordHash = await bcrypt.hash(password, 12);
    await tx.user.update({ where: { id }, data: { passwordHash, mustChangePassword: true, passwordChangedAt: new Date(), status: "ACTIVE", activatedAt: new Date() } });
    await audit(tx, { userId: actor.id, action: "user.reset_password", entity: "User", entityId: id });
    const keys = [u.email && `email:${u.email}`, u.loginPhone && `email:${u.loginPhone}`].filter(Boolean) as string[];
    if (keys.length) await tx.loginAttempt.deleteMany({ where: { key: { in: keys }, success: false } });
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
