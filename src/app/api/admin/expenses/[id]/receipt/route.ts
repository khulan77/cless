/** Зардлын баримт (зураг / PDF) — хувийн storage-аас, зөвхөн харах эрхтэйд. Кэшлэхгүй. */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { canView } from "@/server/modules/finance/access";
import { receiptMime } from "@/server/modules/finance/receipts";
import { privateStorage } from "@/server/storage/private";

const NO_STORE = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" };

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  if (!(await canView(user.role, "expenses"))) return NextResponse.json({ error: "not found" }, { status: 404, headers: NO_STORE });
  const e = await db.expense.findUnique({ where: { id: (await params).id }, select: { receiptPath: true } });
  const data = e?.receiptPath ? await privateStorage.read(e.receiptPath) : null;
  if (!e?.receiptPath || !data) return NextResponse.json({ error: "not found" }, { status: 404, headers: NO_STORE });
  return new NextResponse(new Uint8Array(data), { headers: { ...NO_STORE, "Content-Type": receiptMime(e.receiptPath), "Content-Disposition": "inline" } });
}
