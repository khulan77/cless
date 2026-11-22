/** Тестэд .xlsx үүсгэх туслах (header-ээр нь багана тааруулна) */
import ExcelJS from "exceljs";
import { PRODUCT_COLUMNS, PRODUCT_SHEET, VARIANT_COLUMNS, VARIANT_SHEET, type ProductColumn, type VariantColumn } from "./columns";

export type ProductRowInput = Partial<Record<ProductColumn, string | number>>;
export type VariantRowInput = Partial<Record<VariantColumn, string | number>>;

export async function makeXlsx(products: ProductRowInput[], variants: VariantRowInput[], opts: { omitSheet?: string } = {}) {
  const wb = new ExcelJS.Workbook();
  if (opts.omitSheet !== PRODUCT_SHEET) {
    const ws = wb.addWorksheet(PRODUCT_SHEET);
    ws.addRow(PRODUCT_COLUMNS.map((c) => c.header));
    for (const p of products) ws.addRow(PRODUCT_COLUMNS.map((c) => p[c.key] ?? null));
  }
  if (opts.omitSheet !== VARIANT_SHEET) {
    const ws = wb.addWorksheet(VARIANT_SHEET);
    ws.addRow(VARIANT_COLUMNS.map((c) => c.header));
    for (const v of variants) ws.addRow(VARIANT_COLUMNS.map((c) => v[c.key] ?? null));
  }
  return new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer);
}

export const product = (slug: string, extra: ProductRowInput = {}): ProductRowInput => ({
  slug,
  name: slug.toUpperCase().replace(/-/g, " "),
  description: "Тайлбар",
  ...extra,
});

export const variant = (productSlug: string, sku: string, extra: VariantRowInput = {}): VariantRowInput => ({
  productSlug,
  sku,
  size: "50 мл",
  price: 100000,
  ...extra,
});
