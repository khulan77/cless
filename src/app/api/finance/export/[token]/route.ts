/**
 * Нягтлангийн имэйл дэх "Бүх системийн тайлан"-гийн холбоос — нэвтрэлтгүй, харин HMAC гарын үсэгтэй,
 * хугацаатай (7 хоног) токен. Токен дотор зөвхөн хугацаа (from, to, дуусах). Хөтөч/прокси кэшлэхгүй.
 */
import { NextResponse } from "next/server";
import { XLSX_MIME, financeWorkbook, verifyExportToken } from "@/server/modules/finance/export";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const range = verifyExportToken((await params).token);
  if (!range) return NextResponse.json({ error: "Холбоос хүчингүй эсвэл хугацаа нь дууссан." }, { status: 410, headers: { "Cache-Control": "no-store" } });
  const bytes = await financeWorkbook(range);
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": XLSX_MIME,
      "Content-Disposition": `attachment; filename="sanhuu_${range.from}_${range.to}.xlsx"`,
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex",
    },
  });
}
