/** Нягтланд илгээсэн өдрийн тайлангийн Excel (WeSend хавсралтгүй тул имэйл дэх холбоос). report:send. Кэшлэхгүй. */
import { NextResponse } from "next/server";
import { can } from "@/server/auth/permissions";
import { getCurrentUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { buildDailyExcel, dailySummary } from "@/server/modules/reports/accountant";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/admin/login", process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:20267"));
  if (!can(user.role, "report:send")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const d = await db.reportDispatch.findUnique({ where: { id: (await params).id }, select: { day: true } });
  if (!d) return NextResponse.json({ error: "not found" }, { status: 404 });
  const bytes = await buildDailyExcel(await dailySummary(d.day));
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="tailan_${d.day}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
