"use client";

import { AlertTriangle, CheckCircle2, Plus } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useServerAction } from "@/components/admin/use-action";
import { Badge, Button } from "@/components/admin/ui";
import { t } from "@/i18n";
import { formatMNT } from "@/lib/money";
import { confirmRateSetAction, deleteRateSetAction } from "@/server/actions/payroll";
import { RateSetEditor, type RateSetView } from "./RateSetEditor";

const R = t.admin.payroll.rates;
const D = t.admin.payroll.detail;
const pct = (bp: number) => `${(bp / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;

export type RateSetRow = RateSetView & { confirmedAt: string | null; confirmedBy: string | null; status: "current" | "future" | "past" };

export function RateSetList({ sets, canEdit }: { sets: RateSetRow[]; canEdit: boolean }) {
  const [edit, setEdit] = useState<RateSetView | null | "new">(null);
  const [confirm, setConfirm] = useState<RateSetRow | null>(null);
  const [del, setDel] = useState<RateSetRow | null>(null);
  const confirmA = useServerAction(confirmRateSetAction);
  const delA = useServerAction(deleteRateSetAction);
  const current = sets.find((s) => s.status === "current");

  return (
    <div className="space-y-4">
      {(!current || !current.confirmedAt) && (
        <div role="alert" className="flex gap-3 rounded-2xl border border-danger/30 bg-err-bg px-5 py-4 text-err">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div>
            <p className="text-[15px] font-semibold">{R.warnNone}</p>
            <p className="mt-1 text-[14px]">{R.warnNoneHint}</p>
          </div>
        </div>
      )}
      {canEdit && (
        <Button onClick={() => setEdit("new")}><Plus className="size-[18px]" /> {R.add}</Button>
      )}
      {sets.length === 0 ? (
        <p className="text-[15px] text-ink-soft">{R.empty}</p>
      ) : (
        sets.map((s) => (
          <article key={s.id} className="rounded-2xl border border-hairline bg-white p-5">
            <header className="flex flex-wrap items-center gap-3">
              <h3 className="font-display text-[20px] font-semibold tabular-nums">{s.effectiveFrom}</h3>
              {s.status === "current" && <Badge tone="navy">{R.current}</Badge>}
              {s.status === "future" && <Badge tone="info">{R.future}</Badge>}
              {s.confirmedAt ? (
                <Badge tone="green"><CheckCircle2 className="size-3.5" /> {R.confirmedBy(s.confirmedBy ?? "—", s.confirmedAt)}</Badge>
              ) : (
                <Badge tone="red">{R.notConfirmed}</Badge>
              )}
              {canEdit && (
                <div className="ml-auto flex gap-2">
                  {!s.confirmedAt && <Button size="sm" onClick={() => setConfirm(s)}>{R.confirm}</Button>}
                  <Button size="sm" variant="secondary" onClick={() => setEdit(s)}>{R.edit}</Button>
                  <Button size="sm" variant="danger" onClick={() => setDel(s)}>{R.remove}</Button>
                </div>
              )}
            </header>
            <dl className="mt-4 grid gap-x-6 gap-y-3 text-[14px] sm:grid-cols-2 lg:grid-cols-4">
              <Item k={R.employee} v={pct(s.employeeSiBp)} />
              <Item k={R.employerRates} v={s.employerRates.map((r) => `${r.code} ${r.label}: ${pct(r.bp)}`).join(" · ")} />
              <Item k={D.cap} v={s.siCap === null ? D.noLimit : formatMNT(s.siCap)} />
              <Item k={R.pit} v={pct(s.pitBp)} />
            </dl>
            {s.siBreakdown.length > 0 && (
              <p className="mt-3 text-[13px] text-ink-soft">{s.siBreakdown.map((p) => `${p.label}: ${pct(p.employeeBp)} / ${pct(p.employerBp)}`).join(" · ")}</p>
            )}
            {s.pitCredits.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-[420px] text-[13px]">
                  <caption className="mb-1 text-left text-[13px] font-medium text-ink-soft">{R.credits}</caption>
                  <tbody>
                    {s.pitCredits.map((c) => (
                      <tr key={c.from}>
                        <td className="py-1 pr-4 tabular-nums">{formatMNT(c.from)} – {c.to === null ? "∞" : formatMNT(c.to)}</td>
                        <td className="py-1 tabular-nums">{formatMNT(c.credit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {s.note && <p className="mt-3 text-[13px] text-ink-soft">{s.note}</p>}
          </article>
        ))
      )}
      {edit && <RateSetEditor initial={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
      <ConfirmDialog
        open={!!confirm}
        title={R.confirm}
        confirmLabel={R.confirm}
        pending={confirmA.pending}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && confirmA.run(confirm.id, { onSuccess: () => setConfirm(null) })}
      >
        <p className="text-[15px]">{R.confirmQ}</p>
      </ConfirmDialog>
      <ConfirmDialog
        open={!!del}
        danger
        title={R.remove}
        confirmLabel={R.remove}
        pending={delA.pending}
        onClose={() => setDel(null)}
        onConfirm={() => del && delA.run(del.id, { onSuccess: () => setDel(null) })}
      >
        <p className="text-[15px]">{del?.effectiveFrom}</p>
      </ConfirmDialog>
    </div>
  );
}

function Item({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[13px] text-ink-soft">{k}</dt>
      <dd className="mt-0.5 tabular-nums">{v}</dd>
    </div>
  );
}
