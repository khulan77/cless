/**
 * QPay callback. Body-д ИТГЭХГҮЙ: URL-ийн pid+acct+sig (HMAC)-ийг шалгаад, төлбөрийг
 * тухайн дансны QPay payment/check-ээр өөрсдөө баталгаажуулна. Idempotent — олон удаа ирж болно.
 * PROMPT 29: ?acct=A|B — төлбөрийн данстай таарахгүй бол татгалзана (өөр дансны invoice-ийг хүлээж авахгүй).
 *   acct-гүй хуучин URL (нэг данстай үеийн нээлттэй invoice) — гарын үсэг нь зөвхөн pid, данс A.
 * VERIFY: QPay callback-ийг GET эсвэл POST-оор дууддаг эсэх, хүлээх хариу ("SUCCESS")-г тодруулах.
 */
import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { log } from "@/server/log";
import { callbackSignedValue, verifyQPayPayment } from "@/server/modules/payments/service";
import { callbackSecret } from "@/server/modules/payments/providers/qpay";
import { verifyPaymentSignature } from "@/server/modules/payments/providers/qpay/signature";

async function handle(req: NextRequest) {
  const pid = req.nextUrl.searchParams.get("pid") ?? "";
  const sig = req.nextUrl.searchParams.get("sig") ?? "";
  const rawAcct = req.nextUrl.searchParams.get("acct");
  if (rawAcct !== null && rawAcct !== "A" && rawAcct !== "B") return NextResponse.json({ error: "invalid account" }, { status: 400 });
  const acct = rawAcct ?? "A";
  const signed = rawAcct === null ? pid : callbackSignedValue(pid, acct);
  if (!pid || !verifyPaymentSignature(signed, sig, callbackSecret())) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  const payment = await db.payment.findUnique({ where: { id: pid }, select: { qpayAccount: true } });
  if (!payment) return NextResponse.json({ error: "not found" }, { status: 404 });
  if ((payment.qpayAccount ?? "A") !== acct) {
    log.warn("qpay callback account mismatch", { paymentId: pid, acct });
    return NextResponse.json({ error: "account mismatch" }, { status: 409 });
  }
  try {
    const r = await verifyQPayPayment(pid, null);
    if (r.sale.status === "PAID") revalidateTag("catalog", { expire: 0 });
    return new NextResponse("SUCCESS", { status: 200 });
  } catch (e) {
    log.error("qpay callback verify failed", { paymentId: pid, error: e instanceof Error ? e : String(e) });
    // 5xx → QPay дахин оролдоно; worker мөн 1 минут тутам шалгана
    return NextResponse.json({ error: "verify failed" }, { status: 502 });
  }
}

export const GET = handle;
export const POST = handle;
