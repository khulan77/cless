/** Банкны шилжүүлгийн жагсаалт (тайлсан дансны дугаартай) — payroll:write (ADMIN, ACCOUNTANT). Батлагдсан үе. Кэшлэхгүй. */
import { NextResponse } from "next/server";
import { can } from "@/server/auth/permissions";
import { getCurrentUser } from "@/server/auth/session";
import { bankTransferExcel } from "@/server/modules/payroll/excel";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!can(user.role, "payroll:write")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const file = await bankTransferExcel((await params).id, user.id);
  if (!file) return NextResponse.json({ error: "not found" }, { status: 404 });
  return new NextResponse(file.bytes, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${file.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
