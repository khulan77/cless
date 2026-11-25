"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useServerAction } from "@/components/admin/use-action";
import { Badge, Button, Checkbox, Field, IconButton, Input, Select } from "@/components/admin/ui";
import { t } from "@/i18n";
import { formatMNT } from "@/lib/money";
import { addSalaryAction, removeSalaryAction, saveStaffPayrollAction } from "@/server/actions/payroll";

const S = t.admin.payroll.staff;

export type StaffPayrollView = {
  id: string;
  name: string;
  role: string;
  current: number;
  siCategory: string | null;
  bankMasked: string;
  hasBank: boolean;
  history: { id: string; effectiveFrom: string; monthly: number; note: string | null }[];
};

export function StaffPayrollCard({ s, categories, today }: { s: StaffPayrollView; categories: { code: string; label: string }[]; today: string }) {
  const [monthly, setMonthly] = useState("");
  const [from, setFrom] = useState(today);
  const [note, setNote] = useState("");
  const [cat, setCat] = useState(s.siCategory ?? "");
  const [bank, setBank] = useState("");
  const [clearBank, setClearBank] = useState(false);
  const add = useServerAction(addSalaryAction);
  const remove = useServerAction(removeSalaryAction);
  const save = useServerAction(saveStaffPayrollAction);

  return (
    <article className="rounded-2xl border border-hairline bg-white p-5">
      <header className="flex flex-wrap items-baseline gap-3">
        <h3 className="font-display text-[20px] font-semibold">{s.name}</h3>
        <Badge>{t.admin.nav.roles[s.role]}</Badge>
        <span className="ml-auto text-[14px] text-ink-soft">
          {S.current}: <strong className="text-[17px] font-semibold tabular-nums text-ink">{formatMNT(s.current)}</strong>
        </span>
      </header>

      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <section>
          <h4 className="mb-2 text-[14px] font-medium">{S.history}</h4>
          {s.history.length === 0 ? (
            <p className="text-[14px] text-ink-soft">{S.noHistory}</p>
          ) : (
            <ul className="divide-y divide-hairline text-[14px]">
              {s.history.map((h) => (
                <li key={h.id} className="flex min-h-11 items-center gap-3">
                  <span className="w-24 font-mono tabular-nums">{h.effectiveFrom}</span>
                  <span className="w-32 text-right tabular-nums">{formatMNT(h.monthly)}</span>
                  <span className="flex-1 truncate text-ink-soft">{h.note}</span>
                  <IconButton label={`${t.admin.delete}: ${h.effectiveFrom}`} disabled={remove.pending} onClick={() => remove.run(h.id)}>
                    <Trash2 className="size-4" />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
          <form
            className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              add.run({ staffId: s.id, monthly: Number(monthly), effectiveFrom: from, note }, { onSuccess: () => { setMonthly(""); setNote(""); } });
            }}
          >
            <Field label={S.monthly} htmlFor={`m-${s.id}`} error={add.fieldErrors.monthly}>
              <Input id={`m-${s.id}`} inputMode="numeric" required value={monthly} onChange={(e) => setMonthly(e.target.value.replace(/[^\d]/g, ""))} />
            </Field>
            <Field label={S.effectiveFrom} htmlFor={`f-${s.id}`} error={add.fieldErrors.effectiveFrom}>
              <Input id={`f-${s.id}`} type="date" required value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Button type="submit" disabled={add.pending}>{S.newSalary}</Button>
            <Field label={S.note} htmlFor={`n-${s.id}`} className="sm:col-span-3">
              <Input id={`n-${s.id}`} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </form>
        </section>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.run(
              { staffId: s.id, siCategory: cat || null, bankAccount: clearBank ? "" : bank ? bank : undefined },
              { onSuccess: () => { setBank(""); setClearBank(false); } },
            );
          }}
        >
          <Field label={S.category} htmlFor={`c-${s.id}`}>
            <Select id={`c-${s.id}`} value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">{S.categoryDefault}</option>
              {categories.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.label}</option>)}
            </Select>
          </Field>
          <Field label={`${S.bank} · ${s.bankMasked}`} htmlFor={`b-${s.id}`} hint={`${S.bankHint} ${S.bankKeep}.`}>
            <Input id={`b-${s.id}`} autoComplete="off" placeholder={S.bankPh} value={bank} onChange={(e) => setBank(e.target.value)} disabled={clearBank} />
          </Field>
          {s.hasBank && <Checkbox label={S.bankClear} checked={clearBank} onChange={(e) => setClearBank(e.target.checked)} />}
          <Button type="submit" variant="secondary" disabled={save.pending}>{t.admin.save}</Button>
        </form>
      </div>
    </article>
  );
}
