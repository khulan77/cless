/**
 * Экспорт (PROMPT 18 §1, §2.5):
 *  - Зардлын жагсаалт — CSV / XLSX.
 *  - "Бүх системийн тайлан" — нэг XLSX, sheet бүрээр: P&L, мөнгөн гүйлгээ, баланс, НӨАТ, борлуулалт,
 *    үйлчилгээ (үйлчилгээ/ажилтнаар), бүтээгдэхүүн, касс, цалин, зардал.
 *  - Нягтлангийн имэйлд — хувийн, хугацаатай холбоос (HMAC гарын үсэг, AUTH_SECRET).
 * Үйлчлүүлэгчийн хувийн мэдээлэл (нэр, утас) аль ч sheet-д ороогүй. Цалин — ажилтнаар (нягтланд зориулсан).
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import ExcelJS from "exceljs";
import { t } from "@/i18n";
import { ubDateKey } from "@/lib/time";
import { db } from "@/server/db";
import { fromDbDate, toDbDate } from "@/server/modules/payroll/dates";
import type { LineDetails } from "@/server/modules/payroll/periods";
import type { ReportRange } from "@/server/modules/reports/definitions";
import { loadReport } from "@/server/modules/reports/queries";
import { listExpenses } from "./expenses";
import { balanceSheet, cashFlow, profitAndLoss, vatReport } from "./reports";

const PAY = t.admin.payMethod as Record<string, string>;
const MONEY = '#,##0"₮"';
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export { XLSX as XLSX_MIME };

type Expenses = Awaited<ReturnType<typeof listExpenses>>;

function header(ws: ExcelJS.Worksheet) {
  const h = ws.getRow(1);
  h.font = { bold: true, color: { argb: "FFFFFFFF" } };
  h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0E2243" } };
  ws.views = [{ state: "frozen", ySplit: 1 }];
}

function sheet(wb: ExcelJS.Workbook, name: string, cols: { header: string; width: number; money?: boolean }[]) {
  const ws = wb.addWorksheet(name);
  ws.columns = cols.map((c) => ({ header: c.header, width: c.width, ...(c.money ? { style: { numFmt: MONEY } } : {}) }));
  header(ws);
  return ws;
}

const book = () => {
  const wb = new ExcelJS.Workbook();
  wb.creator = "CLÉSS";
  wb.created = new Date();
  return wb;
};
const bytes = async (wb: ExcelJS.Workbook) => new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer);

// ───────────────────────── Зардал ─────────────────────────

const EXPENSE_COLS = ["Огноо", "Код", "Ангилал", "Төлбөрийн код", "Нийлүүлэгч", "Дүн (НӨАТ-тэй)", "НӨАТ", "Цэвэр дүн", "Төлсөн", "Тайлбар", "Бүртгэсэн"] as const;

function expenseRow(e: Expenses[number]) {
  return [e.date, e.category.code, e.category.name, e.reference ?? "", e.vendor ?? "", e.amount, e.vatAmount, e.net, e.paidVia ? (PAY[e.paidVia] ?? e.paidVia) : "", e.note ?? "", e.createdBy];
}

function addExpenseSheet(wb: ExcelJS.Workbook, rows: Expenses) {
  const ws = sheet(wb, "Зардал", EXPENSE_COLS.map((h, i) => ({ header: h, width: [12, 10, 28, 18, 18, 16, 12, 16, 12, 30, 18][i]!, money: i >= 5 && i <= 7 })));
  for (const e of rows) ws.addRow(expenseRow(e));
  const sum = (k: "amount" | "vatAmount" | "net") => rows.reduce((s, e) => s + e[k], 0);
  ws.addRow(["Нийт", "", "", "", "", sum("amount"), sum("vatAmount"), sum("net")]).font = { bold: true };
}

export async function expensesXlsx(rows: Expenses) {
  const wb = book();
  addExpenseSheet(wb, rows);
  return bytes(wb);
}

/** CSV (UTF-8 BOM — Excel кирилл зөв уншина) */
export function expensesCsv(rows: Expenses): string {
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    // Формула шахалтаас хамгаална (=, +, -, @)
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[",\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return "﻿" + [EXPENSE_COLS.join(","), ...rows.map((e) => expenseRow(e).map(esc).join(","))].join("\n");
}

// ───────────────────────── Бүх системийн тайлан ─────────────────────────

export async function financeWorkbook(range: ReportRange): Promise<Uint8Array> {
  const [pl, cf, bs, vat, rep, expenses, periods] = await Promise.all([
    profitAndLoss(range),
    cashFlow(range),
    balanceSheet(range.to),
    vatReport(range),
    loadReport(range, { canCost: true }),
    listExpenses({ from: range.from, to: range.to }, 5000),
    db.payrollPeriod.findMany({
      where: { startDate: { lte: toDbDate(range.to) }, endDate: { gte: toDbDate(range.from) }, status: { in: ["APPROVED", "PAID"] } },
      orderBy: { startDate: "asc" },
      include: { lines: { include: { staff: { select: { name: true } } }, orderBy: { staff: { name: "asc" } } } },
    }),
  ]);
  const wb = book();
  const title = `${range.from} — ${range.to}`;

  // P&L
  const p = sheet(wb, "Орлого-зарлага", [{ header: title, width: 48 }, { header: "НӨАТ-гүй", width: 16, money: true }, { header: "НӨАТ", width: 14, money: true }]);
  const R = pl.revenue;
  for (const [label, net, v] of [
    ["Үйлчилгээний орлого (үнийн дүн)", R.service.gross, null],
    ["  Хөнгөлөлт", -R.service.discount, null],
    ["  Үйлчилгээний орлого (буцаалт, хөнгөлөлт хассан)", R.service.net, R.service.vat],
    ["Бүтээгдэхүүний орлого (үнийн дүн)", R.product.gross, null],
    ["  Хөнгөлөлт", -R.product.discount, null],
    ["  Бүтээгдэхүүний орлого (буцаалт, хөнгөлөлт хассан)", R.product.net, R.product.vat],
    ["Нийт цэвэр орлого", R.total.net, R.total.vat],
    ["Борлуулсан бүтээгдэхүүний өртөг", -pl.cogs, null],
    ["Нийт ашиг", pl.grossProfit, null],
    ...pl.expenses.map((e) => [`${e.info ? "(мэдээлэл) " : ""}${e.code} · ${e.name}`, e.info ? e.net : -e.net, e.vat] as [string, number, number]),
    ["Нийт зардал", -pl.expensesTotal, null],
    ["Цэвэр ашиг", pl.netProfit, null],
  ] as [string, number, number | null][]) {
    p.addRow([label, net, v]);
  }
  p.getRow(p.rowCount).font = { bold: true };
  p.addRow([]);
  p.addRow(["Анхаар: дүн нь НӨАТ-гүй. ХХОАТ цалингийн зардалд багтсан тул нийлбэрт ороогүй."]);

  // Мөнгөн гүйлгээ
  const c = sheet(wb, "Мөнгөн гүйлгээ", [{ header: title, width: 40 }, { header: "Бэлэн", width: 16, money: true }, { header: "Данс", width: 16, money: true }]);
  c.addRow(["Эхний үлдэгдэл", cf.opening?.cash ?? null, cf.opening?.bank ?? null]);
  for (const i of cf.inflows) c.addRow([`Орсон: ${PAY[i.method] ?? i.method}`, i.method === "CASH" ? i.amount : 0, i.method === "CASH" ? 0 : i.amount]);
  for (const o of cf.outflows) c.addRow([`Гарсан: ${o.label}`, -o.cash, -o.bank]);
  c.addRow(["Цэвэр өөрчлөлт", cf.totals.netCash, cf.totals.netBank]);
  c.addRow(["Эцсийн үлдэгдэл", cf.closing?.cash ?? null, cf.closing?.bank ?? null]).font = { bold: true };
  for (const n of cf.nonCash) c.addRow([`(мөнгө биш) ${PAY[n.method] ?? n.method}`, n.amount, null]);
  if (cf.openingNote) c.addRow([cf.openingNote]);

  // Баланс
  const b = sheet(wb, "Баланс", [{ header: `Удирдлагын баланс (хялбаршуулсан) — ${bs.asOf}`, width: 48 }, { header: "Дүн", width: 18, money: true }, { header: "Тайлбар", width: 40 }]);
  b.addRow(["ХӨРӨНГӨ"]).font = { bold: true };
  for (const a of bs.assets) b.addRow([a.label, a.amount, a.note ?? ""]);
  b.addRow(["Нийт хөрөнгө", bs.totalAssets]).font = { bold: true };
  b.addRow(["ӨР ТӨЛБӨР"]).font = { bold: true };
  for (const l of bs.liabilities) b.addRow([l.label, l.amount, l.note ?? ""]);
  b.addRow(["Нийт өр төлбөр", bs.totalLiabilities]).font = { bold: true };
  b.addRow(["Өмч (хөрөнгө − өр)", bs.equity]).font = { bold: true };
  b.addRow([]);
  b.addRow(["Давхар бичилтийн баланс биш — нягтлангийн программд шилжүүлэх лавлагаа."]);

  // НӨАТ
  const v = sheet(wb, "НӨАТ", [
    { header: "Сар", width: 10 },
    { header: "Борлуулалт (НӨАТ-гүй)", width: 20, money: true },
    { header: "Борлуулалтын НӨАТ", width: 18, money: true },
    { header: "Зардлын НӨАТ", width: 16, money: true },
    { header: "Төлөх НӨАТ", width: 16, money: true },
    { header: "eBarimt-д бүртгэгдсэн НӨАТ", width: 22, money: true },
  ]);
  for (const r of vat) v.addRow([r.month, r.salesNet, r.salesVat, r.expenseVat, r.payable, r.ebarimtVat]);

  // Борлуулалт
  const s = sheet(wb, "Борлуулалт", [{ header: "Өдөр", width: 12 }, { header: "Үйлчилгээ", width: 16, money: true }, { header: "Бүтээгдэхүүн", width: 16, money: true }, { header: "Нийт", width: 16, money: true }]);
  for (const d of rep.days) s.addRow([d.day, d.service, d.product, d.service + d.product]);
  s.addRow(["Нийт", rep.kpi.service, rep.kpi.product, rep.kpi.total]).font = { bold: true };
  s.addRow(["Борлуулалтын тоо", rep.kpi.sales]);
  s.addRow(["Буцаалт", rep.kpi.refunds]);

  // Үйлчилгээ (үйлчилгээ, ажилтнаар)
  const sv = sheet(wb, "Үйлчилгээ", [{ header: "Үйлчилгээ / ажилтан", width: 40 }, { header: "Тоо", width: 8 }, { header: "Дүн", width: 16, money: true }]);
  for (const r of rep.byService) sv.addRow([r.name, r.qty, r.amount]);
  sv.addRow([]);
  sv.addRow(["Ажилтнаар", null, null]).font = { bold: true };
  for (const st of rep.byStaff) {
    sv.addRow([st.name ?? "Тодорхойгүй", null, st.service]).font = { bold: true };
    for (const r of st.services) sv.addRow([`  ${r.name}`, r.qty, r.amount]);
  }

  // Бүтээгдэхүүн
  const pr = sheet(wb, "Бүтээгдэхүүн", [{ header: "Бүтээгдэхүүн", width: 44 }, { header: "Тоо", width: 8 }, { header: "Дүн", width: 16, money: true }, { header: "Ашгийн хувь %", width: 14 }]);
  for (const r of rep.byProduct) pr.addRow([r.name, r.qty, r.amount, r.margin ?? null]);

  // Касс
  const k = sheet(wb, "Касс", [{ header: "Төлбөрийн хэлбэр / ээлж", width: 36 }, { header: "Хүлээгдэж буй", width: 16, money: true }, { header: "Тоолсон", width: 16, money: true }, { header: "Зөрүү", width: 14, money: true }]);
  for (const pmt of rep.payments) k.addRow([PAY[pmt.method] ?? pmt.method, pmt.amount]);
  k.addRow([]);
  for (const sh of cf.shifts) k.addRow([`Ээлж ${sh.closedAt ? ubDateKey(sh.closedAt) : ""}`, sh.expected, sh.counted, sh.difference]);

  // Цалин
  const w = sheet(wb, "Цалин", [
    { header: "Үе", width: 24 },
    { header: "Ажилтан", width: 24 },
    { header: "Үндсэн", width: 14, money: true },
    { header: "Үйлч. суурь", width: 14, money: true },
    { header: "Үйлч. урамшуулал", width: 14, money: true },
    { header: "Бүт. суурь", width: 14, money: true },
    { header: "Бүт. урамшуулал", width: 14, money: true },
    { header: "Нэмэлт", width: 12, money: true },
    { header: "Хасалт", width: 12, money: true },
    { header: "Нийт", width: 14, money: true },
    { header: "НДШ (ажилтан)", width: 14, money: true },
    { header: "ХХОАТ", width: 12, money: true },
    { header: "НДШ (ажил олгогч)", width: 14, money: true },
    { header: "Гарт", width: 14, money: true },
    { header: "Ажилласан цаг", width: 12 },
    { header: "Нормын цаг", width: 12 },
    { header: "Илүү цаг (мэдээлэл)", width: 14 },
  ]);
  for (const per of periods) {
    for (const l of per.lines) {
      const d = l.details as unknown as LineDetails;
      w.addRow([
        `${fromDbDate(per.startDate)}–${fromDbDate(per.endDate)}`,
        l.staff.name,
        l.baseSalary,
        d.bases?.service ?? null,
        l.serviceCommission,
        d.bases?.product ?? null,
        l.productCommission,
        l.adjustments,
        l.deductions,
        l.gross,
        l.siEmployee,
        l.pit,
        l.siEmployer,
        l.net,
        d.hours?.worked ?? null,
        d.hours?.norm ?? null,
        d.hours?.overtime ?? null,
      ]);
    }
  }

  addExpenseSheet(wb, expenses);
  return bytes(wb);
}

// ───────────────────────── Хугацаатай холбоос ─────────────────────────

const secret = () => process.env.AUTH_SECRET || "cless-dev-export-secret";
const b64 = (s: string) => Buffer.from(s).toString("base64url");
const sign = (payload: string) => createHmac("sha256", secret()).update(`finance-export:${payload}`).digest("base64url");

export const EXPORT_LINK_DAYS = 7;

/** Хувийн, хугацаатай (анхдагч 7 хоног) татах холбоосын токен */
export function exportToken(range: ReportRange, now = Date.now(), days = EXPORT_LINK_DAYS): string {
  const payload = b64(JSON.stringify({ f: range.from, t: range.to, e: Math.floor(now / 1000) + days * 86_400 }));
  return `${payload}.${sign(payload)}`;
}

export function verifyExportToken(token: string, now = Date.now()): ReportRange | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(payload));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const v = JSON.parse(Buffer.from(payload, "base64url").toString()) as { f: string; t: string; e: number };
    if (typeof v.e !== "number" || v.e * 1000 < now) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.f) || !/^\d{4}-\d{2}-\d{2}$/.test(v.t)) return null;
    return { from: v.f, to: v.t };
  } catch {
    return null;
  }
}
