/**
 * Цалингийн Excel: (1) бүх мөр + задаргаа (ирц, урамшуулал, нэмэлт/хасалт); (2) банкны шилжүүлгийн жагсаалт.
 * Банкны жагсаалтыг гаргах бүрт AuditLog-д бичнэ (дүн, данс бичихгүй).
 */
import ExcelJS from "exceljs";
import { t } from "@/i18n";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { getPeriod } from "./periods";
import { bankAccounts } from "./staff";

const P = t.admin.payroll;
const NAVY = "FF0E2243";
const MONEY = '#,##0"₮"';

function book() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "CLÉSS";
  wb.created = new Date();
  const sheet = (name: string, cols: { header: string; width: number; money?: boolean }[]) => {
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = cols.map((c) => ({ header: c.header, width: c.width, style: c.money ? { numFmt: MONEY } : {} }));
    const h = ws.getRow(1);
    h.font = { bold: true, color: { argb: "FFFFFFFF" } };
    h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    return ws;
  };
  const bytes = async () => new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer);
  return { sheet, bytes };
}

export async function payrollExcel(periodId: string) {
  const p = await getPeriod(periodId);
  if (!p) return null;
  const { sheet, bytes } = book();
  const C = P.col;
  const isFinal = p.kind === "FINAL";
  const main = sheet(P.periods.title, [
    { header: C.staff, width: 26 },
    { header: P.att.planned, width: 11 },
    { header: C.days, width: 11 },
    { header: C.base, width: 14, money: true },
    { header: C.service, width: 16, money: true },
    { header: C.product, width: 16, money: true },
    { header: P.adj.ADDITION, width: 14, money: true },
    { header: P.adj.DEDUCTION, width: 14, money: true },
    { header: C.gross, width: 15, money: true },
    { header: C.si, width: 13, money: true },
    { header: C.pit, width: 13, money: true },
    ...(isFinal ? [{ header: C.advance, width: 14, money: true }] : []),
    { header: C.net, width: 15, money: true },
    { header: C.er, width: 15, money: true },
  ]);
  for (const l of p.lines) {
    main.addRow([
      l.staff.name, l.plannedDays, l.workedDays, l.baseSalary, l.serviceCommission, l.productCommission, l.adjustments, l.deductions,
      l.gross, l.siEmployee, l.pit, ...(isFinal ? [l.advancePaid] : []), l.net, l.siEmployer,
    ]);
  }
  const sum = (k: "baseSalary" | "serviceCommission" | "productCommission" | "adjustments" | "deductions" | "gross" | "siEmployee" | "pit" | "advancePaid" | "net" | "siEmployer") =>
    p.lines.reduce((s, l) => s + l[k], 0);
  const totalRow = main.addRow([
    P.period.totals, "", "", sum("baseSalary"), sum("serviceCommission"), sum("productCommission"), sum("adjustments"), sum("deductions"),
    sum("gross"), sum("siEmployee"), sum("pit"), ...(isFinal ? [sum("advancePaid")] : []), sum("net"), sum("siEmployer"),
  ]);
  totalRow.font = { bold: true };

  const days = p.lines[0]?.details.attendance.map((a) => a.date) ?? [];
  const att = sheet(P.att.title, [{ header: C.staff, width: 26 }, ...days.map((d) => ({ header: d.slice(5), width: 6 }))]);
  for (const l of p.lines) att.addRow([l.staff.name, ...l.details.attendance.map((a) => P.att.short[a.status])]);
  att.addRow([]);
  for (const [k, v] of Object.entries(P.att.status)) att.addRow([`${P.att.short[k]} = ${v}`]);

  const D = P.detail;
  const com = sheet(D.commissions, [
    { header: C.staff, width: 24 },
    { header: D.date, width: 12 },
    { header: D.item, width: 36 },
    { header: D.receipt, width: 16 },
    { header: D.qty, width: 7 },
    { header: D.amount, width: 14, money: true },
    { header: D.rule, width: 12 },
    { header: D.commission, width: 14, money: true },
  ]);
  for (const l of p.lines) for (const c of l.details.commissions) com.addRow([l.staff.name, c.day, c.name, c.receipt ?? "", c.qty, c.amount, c.rule ?? "", c.commission]);

  const adj = sheet(D.adjustments, [
    { header: C.staff, width: 24 },
    { header: P.adj.type, width: 28 },
    { header: D.amount, width: 14, money: true },
    { header: P.adj.reason, width: 50 },
  ]);
  for (const a of p.adjustments) adj.addRow([a.staff.name, P.adj[a.type], a.amount, a.reason]);

  return { bytes: await bytes(), filename: `tsalin_${p.from}_${p.to}.xlsx` };
}

/** Банкны шилжүүлэг: нэр, данс, гарт олгох дүн. Зөвхөн батлагдсан/олгосон үе. */
export async function bankTransferExcel(periodId: string, actorId: string) {
  const p = await getPeriod(periodId);
  if (!p || p.status === "DRAFT") return null;
  const accounts = await bankAccounts(p.lines.map((l) => l.staffId));
  const { sheet, bytes } = book();
  const ws = sheet(P.period.exportBank, [
    { header: "№", width: 5 },
    { header: P.col.staff, width: 28 },
    { header: P.staff.bank, width: 34 },
    { header: P.col.net, width: 16, money: true },
  ]);
  const payable = p.lines.filter((l) => l.net > 0);
  payable.forEach((l, i) => ws.addRow([i + 1, l.staff.name, accounts.get(l.staffId) ?? "", l.net]));
  const total = ws.addRow(["", P.period.totals, "", payable.reduce((s, l) => s + l.net, 0)]);
  total.font = { bold: true };
  await audit(db, { userId: actorId, action: "payroll.export.bank", entity: "PayrollPeriod", entityId: p.id, after: { rows: payable.length } });
  return { bytes: await bytes(), filename: `bank_${p.from}_${p.to}.xlsx` };
}
