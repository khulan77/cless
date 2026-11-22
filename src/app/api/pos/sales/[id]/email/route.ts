/**
 * Төлбөрийн амжилтын дэлгэц: айлчлалын имэйлийн төлөв (polling).
 */
import { NextResponse, type NextRequest } from "next/server";
import { can } from "@/server/auth/permissions";
import { getCurrentUser } from "@/server/auth/session";
import { db } from "@/server/db";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!can(user.role, "pos:use")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  const sale = await db.sale.findUnique({
    where: { id },
    select: { customer: { select: { id: true, email: true } }, visit: { select: { id: true, emailStatus: true, emailError: true } } },
  });
  if (!sale) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(
    {
      customerId: sale.customer?.id ?? null,
      email: sale.customer?.email ?? null,
      visitId: sale.visit?.id ?? null,
      emailStatus: sale.visit?.emailStatus ?? null,
      emailError: sale.visit?.emailError ?? null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
