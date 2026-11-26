/** Зардлын жагсаалт — CSV эсвэл XLSX (шүүлттэй). Харах эрх: expense:read эсвэл MANAGER (тохиргоогоор). */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { canView } from "@/server/modules/finance/access";
import { listExpenses } from "@/server/modules/finance/expenses";
import { XLSX_MIME, expensesCsv, expensesXlsx } from "@/server/modules/finance/export";
import { expenseFilterFrom, searchParamsObject } from "@/server/modules/finance/params";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await canView(user.role, "expenses"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const url = new URL(req.url);
  const f = expenseFilterFrom(searchParamsObject(url));
  const rows = await listExpenses(f, 10_000);
  const name = `zardal_${f.from}_${f.to}`;
  const headers = { "Cache-Control": "private, no-store" };
  if (url.searchParams.get("format") === "csv") {
    return new NextResponse(expensesCsv(rows), { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.csv"` } });
  }
  return new NextResponse(Buffer.from(await expensesXlsx(rows)), { headers: { ...headers, "Content-Type": XLSX_MIME, "Content-Disposition": `attachment; filename="${name}.xlsx"` } });
}
