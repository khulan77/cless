/**
 * .xlsx → мөрүүд (бүх утга string). Шалгалт validate.ts-д.
 * DB-гүй цэвэр функц — unit test хийгдэнэ.
 */
import ExcelJS from "exceljs";
import { infra } from "@/i18n/mn.infra";
import {
  MAX_ROWS,
  NOTE_MARK,
  PRODUCT_COLUMNS,
  PRODUCT_SHEET,
  VARIANT_COLUMNS,
  VARIANT_SHEET,
  normalizeHeader,
  type ColumnDef,
  type ProductColumn,
  type VariantColumn,
} from "./columns";

const E = infra.import.err;

export type RawRow<K extends string> = { row: number; values: Record<K, string> };

export type ParsedWorkbook = {
  products: RawRow<ProductColumn>[];
  variants: RawRow<VariantColumn>[];
  /** Файлын түвшний алдаа (sheet/багана алга г.м.) */
  errors: string[];
};

export async function parseWorkbook(data: ArrayBuffer | Uint8Array): Promise<ParsedWorkbook> {
  const wb = new ExcelJS.Workbook();
  try {
    // exceljs-ийн төрөл Node Buffer хүлээдэг ч ArrayBuffer-ийг ч уншина
    await wb.xlsx.load(data as unknown as ArrayBuffer);
  } catch {
    return { products: [], variants: [], errors: [E.unreadable] };
  }
  const errors: string[] = [];
  const products = readSheet(wb, PRODUCT_SHEET, PRODUCT_COLUMNS, errors);
  const variants = readSheet(wb, VARIANT_SHEET, VARIANT_COLUMNS, errors);
  if (!errors.length && products.length === 0 && variants.length === 0) errors.push(E.noRows);
  return { products, variants, errors };
}

function findSheet(wb: ExcelJS.Workbook, name: string) {
  const want = normalizeHeader(name);
  return wb.worksheets.find((ws) => normalizeHeader(ws.name) === want);
}

function readSheet<K extends string>(
  wb: ExcelJS.Workbook,
  sheetName: string,
  columns: ColumnDef<K>[],
  errors: string[],
): RawRow<K>[] {
  const ws = findSheet(wb, sheetName);
  if (!ws) {
    errors.push(E.missingSheet(sheetName));
    return [];
  }

  // Толгойн мөр = эхний хоосон биш мөр
  let headerRow = 0;
  for (let r = 1; r <= Math.min(ws.rowCount, 10); r++) {
    if (ws.getRow(r).values && rowTexts(ws.getRow(r)).some(Boolean)) {
      headerRow = r;
      break;
    }
  }
  if (!headerRow) {
    errors.push(E.missingColumn(sheetName, columns[0]!.header));
    return [];
  }

  const colIndex = new Map<K, number>();
  ws.getRow(headerRow).eachCell((cell, col) => {
    const h = normalizeHeader(cellText(cell.value));
    const def = columns.find(
      (c) => normalizeHeader(c.header) === h || c.key.toLowerCase() === h || c.aliases?.includes(h),
    );
    if (def && !colIndex.has(def.key)) colIndex.set(def.key, col);
  });
  let missing = false;
  for (const c of columns) {
    if (c.required && !colIndex.has(c.key)) {
      errors.push(E.missingColumn(sheetName, c.header));
      missing = true;
    }
  }
  if (missing) return [];

  const rows: RawRow<K>[] = [];
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const values = {} as Record<K, string>;
    let any = false;
    for (const c of columns) {
      const idx = colIndex.get(c.key);
      const v = idx ? cellText(row.getCell(idx).value) : "";
      values[c.key] = v;
      if (v) any = true;
    }
    if (!any) continue;
    // Загварын тайлбар мөр
    if (Object.values<string>(values).some((v) => v.startsWith(NOTE_MARK))) continue;
    rows.push({ row: r, values });
    if (rows.length > MAX_ROWS) {
      errors.push(E.tooManyRows(sheetName, MAX_ROWS));
      return [];
    }
  }
  return rows;
}

function rowTexts(row: ExcelJS.Row): string[] {
  const out: string[] = [];
  row.eachCell((c) => out.push(cellText(c.value)));
  return out;
}

/** ExcelJS-ийн нүдний утга → string (rich text, hyperlink, томьёо, тоо, огноо) */
export function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  if (typeof v === "boolean") return v ? "тийм" : "үгүй";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("richText" in v && Array.isArray(v.richText)) return v.richText.map((p) => p.text).join("").trim();
    if ("hyperlink" in v) {
      const text = "text" in v ? cellText(v.text as ExcelJS.CellValue) : "";
      // Excel автоматаар линк болгосон URL — бодит хаягийг авна
      return /^https?:\/\//i.test(String(v.hyperlink)) && (!text || /^https?:\/\//i.test(text)) ? String(v.hyperlink).trim() : text;
    }
    if ("result" in v) return cellText(v.result as ExcelJS.CellValue);
    if ("error" in v) return "";
  }
  return String(v).trim();
}
