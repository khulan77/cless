/** "Бүх системийн тайлан" — нэг XLSX, sheet бүрээр. Харах эрх: finance:read эсвэл MANAGER (тохиргоогоор). */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { canView } from "@/server/modules/finance/access";
import { XLSX_MIME, financeWorkbook } from "@/server/modules/finance/export";
import { searchParamsObject } from "@/server/modules/finance/params";
import { financeRange } from "@/server/modules/finance/reports";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await canView(user.role, "finance"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { range } = financeRange(searchParamsObject(new URL(req.url)));
  const bytes = await financeWorkbook(range);
  return new NextResponse(Buffer.from(bytes), {
    headers: { "Content-Type": XLSX_MIME, "Content-Disposition": `attachment; filename="sanhuu_${range.from}_${range.to}.xlsx"`, "Cache-Control": "private, no-store" },
  });
}
