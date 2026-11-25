"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/admin/ui";
import { t } from "@/i18n";

const cell = (v: string | number | null | undefined) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV from rows already on the page (UTF-8 BOM so Excel opens Cyrillic correctly) */
export function DownloadCsv({ filename, rows, label = t.admin.report.csv }: { filename: string; rows: (string | number | null)[][]; label?: string }) {
  const download = () => {
    const blob = new Blob(["﻿" + rows.map((l) => l.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <Button variant="secondary" onClick={download}>
      <Download className="size-[18px]" strokeWidth={1.75} /> {label}
    </Button>
  );
}
