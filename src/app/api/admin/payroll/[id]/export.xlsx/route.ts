/** Цалингийн үеийн Excel — бүх мөр + задаргаа. payroll:read. Кэшлэхгүй. */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { canView } from "@/server/modules/finance/access";
import { payrollExcel } from "@/server/modules/payroll/excel";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await canView(user.role, "payroll"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const file = await payrollExcel((await params).id);
  if (!file) return NextResponse.json({ error: "not found" }, { status: 404 });
  return new NextResponse(file.bytes, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${file.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
