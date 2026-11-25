/**
 * Үйлчлүүлэгчийн сайтын session (PROMPT 15 §3) — ажилтны Auth.js session-оос ТУСДАА:
 * өөр cookie ("cless_customer"), DB-д токены sha256 хэш л, 30 хоног. Admin руу хандах эрхгүй (admin нь Auth.js-ийг шалгана).
 */
import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/server/db";

export const CUSTOMER_COOKIE = "cless_customer";
export const SESSION_DAYS = 30;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createCustomerSession(customerId: string, now = new Date()) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 86_400_000);
  await db.customerSession.create({ data: { tokenHash: hash(token), customerId, expiresAt } });
  const jar = await cookies();
  jar.set(CUSTOMER_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: expiresAt });
}

/** Нэвтэрсэн үйлчлүүлэгч (эсвэл null). Хугацаа дууссан бол null. */
export async function getCurrentCustomer() {
  const token = (await cookies()).get(CUSTOMER_COOKIE)?.value;
  if (!token) return null;
  const s = await db.customerSession.findUnique({
    where: { tokenHash: hash(token) },
    select: { id: true, expiresAt: true, lastSeenAt: true, customer: { select: { id: true, name: true, phone: true, email: true, emailVerifiedAt: true, emailConsentAt: true } } },
  });
  if (!s || s.expiresAt <= new Date()) return null;
  // 1 цаг тутам "сүүлд харсан"-ыг шинэчилнэ
  if (Date.now() - s.lastSeenAt.getTime() > 3_600_000) await db.customerSession.update({ where: { id: s.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
  return s.customer;
}

export async function signOutCustomer() {
  const jar = await cookies();
  const token = jar.get(CUSTOMER_COOKIE)?.value;
  if (token) await db.customerSession.deleteMany({ where: { tokenHash: hash(token) } });
  jar.delete(CUSTOMER_COOKIE);
}

/** Server action-д: нэвтэрсэн үйлчлүүлэгч заавал (ажилтны эрх энд хамаарахгүй) */
export async function requireCustomer() {
  const c = await getCurrentCustomer();
  if (!c) {
    const { UnauthorizedError } = await import("@/server/errors");
    throw new UnauthorizedError("Эхлээд нэвтэрнэ үү.");
  }
  return c;
}
