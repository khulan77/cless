/**
 * QPay callback. Body-д ИТГЭХГҮЙ: URL-ийн pid+sig (HMAC)-ийг шалгаад, төлбөрийг
 * QPay-ийн payment/check-ээр өөрсдөө баталгаажуулна. Idempotent — олон удаа ирж болно.
 * VERIFY: QPay callback-ийг GET эсвэл POST-оор дууддаг эсэх, хүлээх хариу ("SUCCESS")-г тодруулах.
 */
import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { log } from "@/server/log";
import { verifyQPayPayment } from "@/server/modules/payments/service";
import { callbackSecret } from "@/server/modules/payments/providers/qpay";
import { verifyPaymentSignature } from "@/server/modules/payments/providers/qpay/signature";

async function handle(req: NextRequest) {
  const pid = req.nextUrl.searchParams.get("pid") ?? "";
  const sig = req.nextUrl.searchParams.get("sig") ?? "";
  if (!pid || !verifyPaymentSignature(pid, sig, callbackSecret())) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
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
