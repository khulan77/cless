/**
 * POS төлбөрийн төлөв (QPay QR дэлгэцийн polling). Зөвхөн DB уншина;
 * `?check=1` үед QPay-ээс шалгана (UI ~10 секунд тутам).
 */
import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { paymentStatus, verifyQPayPayment } from "@/server/modules/payments/service";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/pos/payments/[id]/status">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!can(user.role, "pos:use")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  try {
    const check = req.nextUrl.searchParams.get("check") === "1";
    const view = check ? await verifyQPayPayment(id, user.id) : await paymentStatus(id);
    if (check && view.sale.status === "PAID") revalidateTag("catalog", { expire: 0 });
    return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 400 });
  }
}
