"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Dialog } from "@/components/admin/Dialog";
import { useServerAction } from "@/components/admin/use-action";
import { Button, Field, IconButton, Input, Textarea } from "@/components/admin/ui";
import { t } from "@/i18n";
import { saveRateSetAction } from "@/server/actions/payroll";
import type { RateSetInput } from "@/server/modules/payroll/rates";

const R = t.admin.payroll.rates;

export type RateSetView = {
  id: string;
  effectiveFrom: string;
  employeeSiBp: number;
  employerRates: { code: string; label: string; bp: number }[];
  siBreakdown: { label: string; employeeBp: number; employerBp: number }[];
  siCap: number | null;
  pitBp: number;
  pitCredits: { from: number; to: number | null; credit: number }[];
  note: string | null;
};

const pct = (bp: number) => String(bp / 100);
type Row<T> = T & { key: number };
let k = 0;
const withKey = <T,>(x: T): Row<T> => ({ ...x, key: k++ });

/** Хувь хэмжээ оруулах/засах. Хувийг "11.5" гэж (%) оруулна. Утга урьдчилан бөглөгдөхгүй — нягтлан оруулна. */
export function RateSetEditor({ initial, onClose }: { initial: RateSetView | null; onClose: () => void }) {
  const [from, setFrom] = useState(initial?.effectiveFrom ?? "");
  const [employee, setEmployee] = useState(initial ? pct(initial.employeeSiBp) : "");
  const [employer, setEmployer] = useState(
    (initial?.employerRates.length ? initial.employerRates : [{ code: "", label: "", bp: NaN }]).map((r) => withKey({ code: r.code, label: r.label, pct: Number.isNaN(r.bp) ? "" : pct(r.bp) })),
  );
  const [parts, setParts] = useState((initial?.siBreakdown ?? []).map((r) => withKey({ label: r.label, employeePct: pct(r.employeeBp), employerPct: pct(r.employerBp) })));
  const [cap, setCap] = useState(initial?.siCap?.toString() ?? "");
  const [pit, setPit] = useState(initial ? pct(initial.pitBp) : "");
  const [credits, setCredits] = useState((initial?.pitCredits ?? []).map((c) => withKey({ from: String(c.from), to: c.to === null ? "" : String(c.to), credit: String(c.credit) })));
  const [note, setNote] = useState(initial?.note ?? "");
  const save = useServerAction((x: { id: string | null; input: RateSetInput }) => saveRateSetAction(x.id, x.input));
  const err = save.fieldErrors;

  const submit = () =>
    save.run(
      {
        id: initial?.id ?? null,
        input: {
          effectiveFrom: from,
          employeePct: employee as unknown as number,
          employerRates: employer.map((r) => ({ code: r.code, label: r.label, pct: r.pct as unknown as number })),
          siBreakdown: parts.map((p) => ({ label: p.label, employeePct: p.employeePct as unknown as number, employerPct: p.employerPct as unknown as number })),
          siCap: cap === "" ? null : (cap as unknown as number),
          pitPct: pit as unknown as number,
          pitCredits: credits.map((c) => ({ from: c.from as unknown as number, to: c.to === "" ? null : (c.to as unknown as number), credit: c.credit as unknown as number })),
          note,
        },
      },
      { onSuccess: onClose },
    );

  const rowErr = (prefix: string, i: number) => Object.entries(err).find(([key]) => key.startsWith(`${prefix}.${i}`))?.[1];

  return (
    <Dialog
      open
      wide
      onClose={onClose}
      title={initial ? R.edit : R.add}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t.admin.cancel}</Button>
          <Button onClick={submit} disabled={save.pending}>{save.pending ? t.admin.saving : R.save}</Button>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={R.effectiveFrom} htmlFor="rs-from" error={err.effectiveFrom}>
            <Input id="rs-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label={R.employee} htmlFor="rs-ee" error={err.employeePct}>
            <Input id="rs-ee" inputMode="decimal" value={employee} onChange={(e) => setEmployee(e.target.value)} />
          </Field>
          <Field label={R.pit} htmlFor="rs-pit" error={err.pitPct}>
            <Input id="rs-pit" inputMode="decimal" value={pit} onChange={(e) => setPit(e.target.value)} />
          </Field>
        </div>

        <Rows
          title={R.employerRates}
          error={err.employerRates}
          onAdd={() => setEmployer([...employer, withKey({ code: "", label: "", pct: "" })])}
        >
          {employer.map((r, i) => (
            <div key={r.key} className="grid grid-cols-[6rem_1fr_6rem_auto] items-start gap-2">
              <Input aria-label={R.code} placeholder={R.code} value={r.code} onChange={(e) => setEmployer(employer.map((x) => (x.key === r.key ? { ...x, code: e.target.value } : x)))} />
              <Input aria-label={R.label} placeholder={R.label} value={r.label} onChange={(e) => setEmployer(employer.map((x) => (x.key === r.key ? { ...x, label: e.target.value } : x)))} />
              <Input aria-label={R.pct} placeholder="%" inputMode="decimal" value={r.pct} onChange={(e) => setEmployer(employer.map((x) => (x.key === r.key ? { ...x, pct: e.target.value } : x)))} />
              <IconButton label={t.admin.removeRow} onClick={() => setEmployer(employer.filter((x) => x.key !== r.key))} disabled={employer.length === 1}><Trash2 className="size-4" /></IconButton>
              <RowError msg={rowErr("employerRates", i)} />
            </div>
          ))}
        </Rows>

        <Rows title={R.breakdown} onAdd={() => setParts([...parts, withKey({ label: "", employeePct: "", employerPct: "" })])}>
          {parts.map((p, i) => (
            <div key={p.key} className="grid grid-cols-[1fr_7rem_7rem_auto] items-start gap-2">
              <Input aria-label={R.label} placeholder={R.label} value={p.label} onChange={(e) => setParts(parts.map((x) => (x.key === p.key ? { ...x, label: e.target.value } : x)))} />
              <Input aria-label={t.admin.payroll.detail.employee} placeholder={`${t.admin.payroll.detail.employee} %`} inputMode="decimal" value={p.employeePct} onChange={(e) => setParts(parts.map((x) => (x.key === p.key ? { ...x, employeePct: e.target.value } : x)))} />
              <Input aria-label={t.admin.payroll.detail.employer} placeholder={`${t.admin.payroll.detail.employer} %`} inputMode="decimal" value={p.employerPct} onChange={(e) => setParts(parts.map((x) => (x.key === p.key ? { ...x, employerPct: e.target.value } : x)))} />
              <IconButton label={t.admin.removeRow} onClick={() => setParts(parts.filter((x) => x.key !== p.key))}><Trash2 className="size-4" /></IconButton>
              <RowError msg={rowErr("siBreakdown", i)} />
            </div>
          ))}
        </Rows>

        <Field label={R.siCap} htmlFor="rs-cap" error={err.siCap}>
          <Input id="rs-cap" inputMode="numeric" value={cap} onChange={(e) => setCap(e.target.value.replace(/[^\d]/g, ""))} className="max-w-60" />
        </Field>

        <Rows title={R.credits} error={err.pitCredits} onAdd={() => setCredits([...credits, withKey({ from: "", to: "", credit: "" })])}>
          {credits.length > 0 && (
            <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-[13px] text-ink-soft">
              <span>{R.from}</span><span>{R.to}</span><span>{R.credit}</span><span className="w-11" />
            </div>
          )}
          {credits.map((c, i) => (
            <div key={c.key} className="grid grid-cols-[1fr_1fr_1fr_auto] items-start gap-2">
              {(["from", "to", "credit"] as const).map((f) => (
                <Input key={f} aria-label={R[f]} inputMode="numeric" value={c[f]} onChange={(e) => setCredits(credits.map((x) => (x.key === c.key ? { ...x, [f]: e.target.value.replace(/[^\d]/g, "") } : x)))} />
              ))}
              <IconButton label={t.admin.removeRow} onClick={() => setCredits(credits.filter((x) => x.key !== c.key))}><Trash2 className="size-4" /></IconButton>
              <RowError msg={rowErr("pitCredits", i)} />
            </div>
          ))}
        </Rows>

        <Field label={R.note} htmlFor="rs-note">
          <Textarea id="rs-note" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}

function Rows({ title, error, onAdd, children }: { title: string; error?: string[]; onAdd: () => void; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-[14px] font-medium">{title}</legend>
      {children}
      {error?.[0] && <p role="alert" className="text-[13px] text-danger">{error[0]}</p>}
      <Button variant="ghost" size="sm" onClick={onAdd}><Plus className="size-4" /> {R.addRow}</Button>
    </fieldset>
  );
}

function RowError({ msg }: { msg?: string[] }) {
  return msg?.[0] ? <p role="alert" className="col-span-full text-[13px] text-danger">{msg[0]}</p> : null;
}
