/**
 * Callback URL-ийн гарын үсэг: HMAC-SHA256(paymentId, QPAY_CALLBACK_SECRET).
 * Callback-ийн body-д итгэхгүй — зөвхөн "энэ төлбөрийг шалга" гэсэн дохио.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export function signPaymentId(paymentId: string, secret: string): string {
  return createHmac("sha256", secret).update(paymentId).digest("hex");
}

export function verifyPaymentSignature(paymentId: string, sig: string, secret: string): boolean {
  if (!secret || !/^[0-9a-f]{64}$/i.test(sig)) return false;
  const expected = Buffer.from(signPaymentId(paymentId, secret), "hex");
  const given = Buffer.from(sig, "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}
