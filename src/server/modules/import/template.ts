/**
 * Импортын .xlsx загвар: «Бүтээгдэхүүн», «Хувилбар» (толгой + тайлбар мөр + 2 жишээ),
 * «Лавлах» (одоогийн ангилал / арьсны асуудлын slug-ууд).
 */
import ExcelJS from "exceljs";
import {
  NOTE_MARK,
  PRODUCT_COLUMNS,
  PRODUCT_SHEET,
  REFERENCE_SHEET,
  VARIANT_COLUMNS,
  VARIANT_SHEET,
  type ColumnDef,
} from "./columns";

/** --color-navy (#0e2243) */
const NAVY = "FF0E2243";

function addSheet<K extends string>(wb: ExcelJS.Workbook, name: string, cols: ColumnDef<K>[]) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 2 }] });
  ws.columns = cols.map((c) => ({ key: c.key, width: c.width }));

  const header = ws.addRow(cols.map((c) => (c.required ? `${c.header} *` : c.header)));
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  header.alignment = { vertical: "middle", wrapText: true };
  header.height = 30;
  cols.forEach((c, i) => {
    header.getCell(i + 1).note = c.note;
  });

  const notes = ws.addRow(cols.map((c) => `${NOTE_MARK} ${c.note}`));
  notes.font = { italic: true, size: 9, color: { argb: "FF6B7280" } };
  notes.alignment = { vertical: "top", wrapText: true };
  notes.height = 60;

  for (const i of [0, 1] as const) {
    const r = ws.addRow(cols.map((c) => c.examples[i]));
    r.font = { color: { argb: "FF9CA3AF" } };
  }
  return ws;
}

export async function buildTemplate(collections: { slug: string; name: string; kind: "CATEGORY" | "CONCERN" }[]): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "CLÉSS";
  wb.created = new Date();

  const products = addSheet(wb, PRODUCT_SHEET, PRODUCT_COLUMNS);
  const badgeCol = PRODUCT_COLUMNS.findIndex((c) => c.key === "badge") + 1;
  const pubCol = PRODUCT_COLUMNS.findIndex((c) => c.key === "isPublished") + 1;
  for (let r = 3; r <= 500; r++) {
    products.getCell(r, badgeCol).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"ШИНЭ,ИКОНИК,ХЯЗГААРЛАГДМАЛ,ЗӨВХӨН ОНЛАЙН"'],
    };
    products.getCell(r, pubCol).dataValidation = { type: "list", allowBlank: true, formulae: ['"тийм,үгүй"'] };
  }

  const variants = addSheet(wb, VARIANT_SHEET, VARIANT_COLUMNS);
  for (const key of ["price", "costPrice"] as const) {
    const col = VARIANT_COLUMNS.findIndex((c) => c.key === key) + 1;
    variants.getColumn(col).numFmt = "#,##0";
  }

  const ref = wb.addWorksheet(REFERENCE_SHEET);
  ref.columns = [
    { header: "Төрөл", key: "kind", width: 18 },
    { header: "slug", key: "slug", width: 28 },
    { header: "Нэр", key: "name", width: 36 },
  ];
  ref.getRow(1).font = { bold: true };
  for (const c of [...collections].sort((a, b) => a.kind.localeCompare(b.kind) || a.slug.localeCompare(b.slug))) {
    ref.addRow({ kind: c.kind === "CATEGORY" ? "Ангилал" : "Арьсны асуудал", slug: c.slug, name: c.name });
  }

  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer);
}
