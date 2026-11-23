import { t } from "@/i18n";

/** Short money for chart axes ("1.2 million", "800 thousand") */
export function compactMNT(v: number): string {
  const a = Math.abs(v);
  if (a >= 1_000_000) return t.admin.report.million(trim(v / 1_000_000));
  if (a >= 1_000) return t.admin.report.thousand(trim(v / 1_000));
  return String(Math.round(v));
}
const trim = (x: number) => (Math.round(x * 10) / 10).toString();

/** "2026-11-05" → "11/05" */
export const shortDay = (d: string) => `${d.slice(5, 7)}/${d.slice(8, 10)}`;
