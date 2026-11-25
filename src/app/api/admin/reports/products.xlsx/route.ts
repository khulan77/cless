/**
 * Тайлан → Бүтээгдэхүүн Excel (A10): «Бүтээгдэхүүн» (бараа бүрээр) ба «Ажилтнаар» (бараа × ажилтан).
 * report:read эрхтэй. Кэшлэхгүй.
 */
import ExcelJS from "exceljs";
import { NextResponse, type NextRequest } from "next/server";
import { t } from "@/i18n";
import { can } from "@/server/auth/permissions";
import { getCurrentUser } from "@/server/auth/session";
import { rangeFromParams } from "@/server/modules/reports/definitions";
import { productAnalytics } from "@/server/modules/reports/products";

const P = t.admin.report.products;
const NAVY = "FF0E2243";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!can(user.role, "report:read")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  const { range } = rangeFromParams({ from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined, preset: sp.get("preset") ?? undefined });
  const rows = await productAnalytics(range);

  const wb = new ExcelJS.Workbook();
  wb.creator = "CLÉSS";
  wb.created = new Date();
  const sheet = (name: string, cols: { header: string; width: number; money?: boolean }[]) => {
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = cols.map((c) => ({ header: c.header, width: c.width, style: c.money ? { numFmt: '#,##0"₮"' } : {} }));
    const h = ws.getRow(1);
    h.font = { bold: true, color: { argb: "FFFFFFFF" } };
    h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    return ws;
  };
  const a = sheet(P.sheetProducts, [
    { header: P.name, width: 44 },
    { header: "SKU", width: 16 },
    { header: "Баркод", width: 18 },
    { header: P.soldQty, width: 10 },
    { header: P.revenue, width: 16, money: true },
    { header: P.usedQty, width: 13 },
  ]);
  for (const r of rows) a.addRow([r.name, r.sku, r.barcode ?? "", r.soldQty, r.revenue, r.usedQty]);
  const b = sheet(P.sheetStaff, [
    { header: P.name, width: 44 },
    { header: "SKU", width: 16 },
    { header: P.staff, width: 24 },
    { header: P.soldQty, width: 10 },
    { header: P.revenue, width: 16, money: true },
    { header: P.usedQty, width: 13 },
  ]);
  for (const r of rows) for (const s of r.byStaff) b.addRow([r.name, r.sku, s.name ?? P.unknownStaff, s.soldQty, s.revenue, s.usedQty]);

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="products_${range.from}_${range.to}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
