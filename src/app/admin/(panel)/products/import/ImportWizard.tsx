"use client";

import { Download, FileSpreadsheet, Upload } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge, Button, Card, Table, btnClass, tdClass, thClass } from "@/components/admin/ui";
import { formatMNT } from "@/lib/money";
import { infra } from "@/i18n/mn.infra";
import { t } from "@/i18n";
import { previewProductImport, runProductImport } from "@/server/modules/import/actions";
import type { ImportPreview, ImportReport } from "@/server/modules/import/service";

const T = infra.import;
const TOUCH = "max-sm:h-11 max-sm:w-full";

const TONE = { create: "green", update: "amber", unchanged: "neutral", error: "red" } as const;

export function ImportWizard() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"preview" | "run" | null>(null);

  const formData = () => {
    const fd = new FormData();
    if (file) fd.set("file", file);
    return fd;
  };

  const onPreview = () =>
    start(async () => {
      setMode("preview");
      setReport(null);
      try {
        const res = await previewProductImport(formData());
        if (res.ok) setPreview(res.data);
        else {
          setPreview(null);
          toast.error(res.error);
        }
      } catch {
        toast.error(t.admin.networkError);
      }
    });

  const onRun = () => {
    if (!preview) return;
    const n = preview.summary.create + preview.summary.update;
    if (!window.confirm(T.confirm(n))) return;
    start(async () => {
      setMode("run");
      try {
        const res = await runProductImport(formData());
        if (res.ok) {
          setReport(res.data);
          setPreview(null);
          toast.success(T.report.line(res.data));
        } else toast.error(res.error);
      } catch {
        toast.error(t.admin.networkError);
      }
    });
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setReport(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  if (report) return <ReportView report={report} onAgain={reset} />;

  return (
    <div className="space-y-5">
      <Card title={T.step1}>
        <p className="mb-4 max-w-[70ch] text-[14px] text-navy/70">{T.step1Text}</p>
        <a href="/admin/products/import/template" className={btnClass("secondary", "md", TOUCH)} download>
          <Download className="size-4" aria-hidden /> {T.downloadTemplate}
        </a>
        <ul className="mt-5 list-disc space-y-1 pl-5 text-[13px] text-navy/60">
          {T.rules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </Card>

      <Card title={T.step2}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className={btnClass("secondary", "md", `${TOUCH} cursor-pointer`)}>
            <FileSpreadsheet className="size-4" aria-hidden />
            {T.chooseFile}
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setPreview(null);
              }}
            />
          </label>
          <span className="min-w-0 truncate text-[13px] text-navy/60">{file ? file.name : T.fileHint}</span>
          <Button onClick={onPreview} disabled={!file || pending} className={`${TOUCH} sm:ml-auto`}>
            <Upload className="size-4" aria-hidden />
            {pending && mode === "preview" ? T.previewing : T.preview}
          </Button>
        </div>
      </Card>

      {preview && <PreviewView preview={preview} pending={pending && mode === "run"} onRun={onRun} />}
    </div>
  );
}

function PreviewView({ preview, pending, onRun }: { preview: ImportPreview; pending: boolean; onRun: () => void }) {
  const { summary } = preview;
  const nothing = summary.create + summary.update === 0;
  return (
    <Card title={T.step3}>
      <dl className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["create", "update", "unchanged", "error"] as const).map((k) => (
          <div key={k} className="rounded-md border border-line px-4 py-3">
            <dt className="text-[12px] uppercase tracking-[0.4px] text-navy/60">{T.summary[k]}</dt>
            <dd className={`text-[22px] font-medium tabular-nums ${k === "error" && summary.error ? "text-red-700" : ""}`}>{summary[k]}</dd>
          </div>
        ))}
      </dl>

      {preview.errors.length > 0 && (
        <div className="mb-5 rounded-md border border-red-200 bg-red-50 p-4 text-[13.5px] text-red-800" role="alert">
          <p className="mb-2 font-medium">{T.globalErrors}</p>
          <ul className="list-disc space-y-1 pl-5">
            {preview.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {preview.products.length > 0 && (
        <Table>
          <thead>
            <tr>
              <th className={`${thClass} w-14`}>{T.col.row}</th>
              <th className={thClass}>{T.col.product}</th>
              <th className={thClass}>{T.col.variants}</th>
              <th className={thClass}>{T.col.status}</th>
              <th className={thClass}>{T.col.notes}</th>
            </tr>
          </thead>
          <tbody>
            {preview.products.map((p) => (
              <tr key={`${p.row}-${p.slug}`} className={p.action === "error" ? "bg-red-50/50" : undefined}>
                <td className={`${tdClass} tabular-nums text-navy/60`}>{p.row}</td>
                <td className={tdClass}>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-[12px] text-navy/50">{p.slug}</p>
                </td>
                <td className={`${tdClass} text-[12.5px]`}>
                  <ul className="space-y-0.5">
                    {p.variants.map((v) => (
                      <li key={`${v.row}-${v.sku}`} className="whitespace-nowrap">
                        <span className="font-mono">{v.sku}</span> · {v.size} · {v.price !== null && !Number.isNaN(v.price) ? formatMNT(v.price) : "—"}
                        {v.initialStock > 0 && <span className="text-navy/50"> · +{v.initialStock}</span>}
                        {v.action !== "unchanged" && p.action !== "create" && (
                          <span className="ml-1"><Badge tone={TONE[v.action]}>{T.action[v.action]}</Badge></span>
                        )}
                      </li>
                    ))}
                  </ul>
                </td>
                <td className={tdClass}>
                  <Badge tone={TONE[p.action]}>{T.action[p.action]}</Badge>
                </td>
                <td className={`${tdClass} max-w-[420px] text-[12.5px]`}>
                  {p.errors.map((e) => (
                    <p key={e} className="text-red-700">{e}</p>
                  ))}
                  {p.warnings.map((w) => (
                    <p key={w} className="text-amber-800">{w}</p>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-end">
        {!preview.canImport && (
          <p className="text-[13px] text-navy/60">{nothing && summary.error === 0 && !preview.errors.length ? T.nothingToDo : T.runDisabled}</p>
        )}
        <Button onClick={onRun} disabled={!preview.canImport || pending} className={TOUCH}>
          {pending ? T.running : T.run}
        </Button>
      </div>
    </Card>
  );
}

function ReportView({ report, onAgain }: { report: ImportReport; onAgain: () => void }) {
  return (
    <Card title={T.report.title}>
      <p className="text-[18px] font-medium">{T.report.line(report)}</p>
      <ul className="mt-2 space-y-0.5 text-[14px] text-navy/70">
        {report.unchanged > 0 && <li>{T.summary.unchanged}: {report.unchanged}</li>}
        {report.stockReceived > 0 && <li>{T.report.stock(report.stockReceived)}</li>}
        {report.imagesDownloaded > 0 && <li>{T.report.images(report.imagesDownloaded)}</li>}
      </ul>
      {report.errors.length > 0 && (
        <ul className="mt-4 list-disc space-y-1 rounded-md border border-red-200 bg-red-50 p-4 pl-8 text-[13.5px] text-red-800" role="alert">
          {report.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {report.warnings.length > 0 && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-[13.5px] text-amber-900">
          <p className="mb-1 font-medium">{T.warnings}</p>
          <ul className="list-disc space-y-1 pl-5">
            {report.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link href="/admin/products" className={btnClass("primary", "md", TOUCH)}>{T.report.toList}</Link>
        <Button variant="secondary" onClick={onAgain} className={TOUCH}>{T.report.again}</Button>
      </div>
    </Card>
  );
}
