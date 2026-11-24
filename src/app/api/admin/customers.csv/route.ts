/**
 * Үйлчлүүлэгчийн жагсаалт CSV (A7): хайлт, эрэмбэтэй ижил, бүх хуудас. Утас/имэйл зөвхөн
 * customer:contact:read эрхтэйд. Хувийн мэдээлэл тул кэшлэхгүй.
 */
import { NextResponse, type NextRequest } from "next/server";
import { t } from "@/i18n";
import { formatDateLabel } from "@/lib/time";
import { can } from "@/server/auth/permissions";
import { getCurrentUser } from "@/server/auth/session";
import { listCustomersRanked } from "@/server/modules/customers/history";

const L = t.admin.customers.list;
const cell = (v: string | number | null) => {
  const s = v === null ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!can(user.role, "customer:read")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  const contact = can(user.role, "customer:contact:read");
  const { rows } = await listCustomersRanked({ q: sp.get("q") ?? undefined, sort: sp.get("sort") ?? undefined, dir: sp.get("dir") ?? undefined, all: true });
  const lines: (string | number | null)[][] = [
    [L.name, ...(contact ? [L.phone, L.email] : []), L.total, L.product, L.service, L.visits, L.lastVisit],
    ...rows.map((c) => [c.name, ...(contact ? [c.phone, c.email] : []), c.total, c.product, c.service, c.visits, c.lastVisit ? formatDateLabel(c.lastVisit) : null]),
  ];
  return new NextResponse("﻿" + lines.map((l) => l.map(cell).join(",")).join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="customers.csv"',
      "Cache-Control": "private, no-store",
    },
  });
}
