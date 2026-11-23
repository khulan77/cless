"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/admin/ui";
import { t } from "@/i18n";
import type { Report } from "@/server/modules/reports/queries";

const R = t.admin.report;
const H = R.csvHeader;

const cell = (v: string | number) => {
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Builds the CSV in the browser from the data already on the page (no extra request) */
export function CsvButton({ report }: { report: Pick<Report, "range" | "days" | "byService" | "byStaff" | "byProduct"> }) {
  const download = () => {
    const lines: (string | number)[][] = [[H.day, H.service, H.product, H.total]];
    for (const d of report.days) lines.push([d.day, d.service, d.product, d.service + d.product]);
    lines.push([]);
    lines.push([H.section, H.name, H.qty, H.amount]);
    for (const r of report.byService) lines.push([R.byService, r.name, r.qty, r.amount]);
    for (const r of report.byProduct) lines.push([R.byProduct, r.name, r.qty, r.amount]);
    for (const s of report.byStaff) lines.push([R.byStaff, s.name ?? R.unknownStaff, "", s.amount]);
    // BOM so Excel opens Cyrillic correctly
    const blob = new Blob(["﻿" + lines.map((l) => l.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `report_${report.range.from}_${report.range.to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <Button variant="secondary" onClick={download}>
      <Download className="size-[18px]" strokeWidth={1.75} /> {R.csv}
    </Button>
  );
}
