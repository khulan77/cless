"use client";

import { ChevronDown, Lock } from "lucide-react";
import { useState } from "react";
import { Dialog } from "@/components/admin/Dialog";
import { useServerAction } from "@/components/admin/use-action";
import { Button, Field, Input } from "@/components/admin/ui";
import { t } from "@/i18n";
import { setWorkDayAction } from "@/server/actions/payroll";

const A = t.admin.payroll.att;
const STATUSES = ["WORKED", "HALF_DAY", "PAID_LEAVE", "UNPAID_LEAVE", "SICK", "ABSENT", "OFF"] as const;
type Status = (typeof STATUSES)[number];
const WD = ["Ня", "Да", "Мя", "Лх", "Пү", "Ба", "Бя"];
const WEIGHT: Record<Status, number> = { WORKED: 1, HALF_DAY: 0.5, PAID_LEAVE: 1, UNPAID_LEAVE: 0, SICK: 0, ABSENT: 0, OFF: 0 };

export const STATUS_TONE: Record<Status, string> = {
  WORKED: "bg-ok-bg text-ok",
  HALF_DAY: "bg-warn-bg text-warn",
  PAID_LEAVE: "bg-info-bg text-info",
  UNPAID_LEAVE: "bg-ink/[0.08] text-ink-soft",
  SICK: "bg-info-bg text-info",
  ABSENT: "bg-err-bg text-err",
  OFF: "bg-canvas text-ink-faint",
};

export type GridDay = { date: string; status: Status; marked: boolean; planned: boolean; note: string | null; hours: number | null };
export type GridRow = { id: string; name: string; role: string; fromSchedule: boolean; days: GridDay[] };

const weekday = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay();
const dayNum = (d: string) => Number(d.slice(8));

export function AttendanceGrid({ days, rows, holidays, lockedDays, canEdit }: { days: string[]; rows: GridRow[]; holidays: string[]; lockedDays: string[]; canEdit: boolean }) {
  const hol = new Set(holidays);
  const locked = new Set(lockedDays);
  const [edit, setEdit] = useState<{ row: GridRow; day: GridDay } | null>(null);
  const editable = (d: string) => canEdit && !locked.has(d);

  const cell = (row: GridRow, d: GridDay, big = false) => (
    <button
      type="button"
      disabled={!editable(d.date)}
      onClick={() => setEdit({ row, day: d })}
      title={`${d.date} · ${A.status[d.status]}${d.marked ? ` · ${A.marked}` : ""}${d.note ? ` · ${d.note}` : ""}`}
      aria-label={`${row.name}, ${d.date}: ${A.status[d.status]}`}
      className={`relative grid place-items-center rounded-lg font-medium tabular-nums transition ${big ? "h-11 text-[14px]" : "h-9 w-9 text-[13px]"} ${STATUS_TONE[d.status]} ${d.marked ? "ring-2 ring-navy/40" : ""} ${editable(d.date) ? "hover:ring-2 hover:ring-navy" : "cursor-default"}`}
    >
      {big ? dayNum(d.date) : A.short[d.status]}
      {d.note && <span aria-hidden className="absolute right-0.5 top-0.5 size-1.5 rounded-full bg-navy" />}
    </button>
  );

  const sumOf = (r: GridRow) => ({ worked: r.days.reduce((s, d) => s + WEIGHT[d.status], 0), planned: r.days.filter((d) => d.planned).length });

  if (rows.length === 0) return <p className="text-[15px] text-ink-soft">{A.empty}</p>;

  return (
    <>
      <Legend />
      {/* ≥ md: хүснэгт */}
      <div className="hidden overflow-x-auto rounded-2xl border border-hairline bg-white md:block">
        <table className="w-full border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 min-w-48 border-b border-hairline bg-white px-4 py-2 text-left font-medium text-ink-soft">{t.admin.payroll.col.staff}</th>
              {days.map((d) => (
                <th key={d} className={`border-b border-hairline px-0.5 py-2 text-center font-medium ${hol.has(d) ? "text-err" : weekday(d) === 0 || weekday(d) === 6 ? "text-ink-faint" : "text-ink-soft"}`}>
                  <div>{dayNum(d)}</div>
                  <div className="text-[11px] font-normal">{WD[weekday(d)]}</div>
                  {locked.has(d) && <Lock className="mx-auto size-3" aria-label={A.locked} />}
                </th>
              ))}
              <th className="border-b border-hairline px-3 py-2 text-right font-medium text-ink-soft">{A.worked} / {A.planned}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const s = sumOf(r);
              return (
                <tr key={r.id}>
                  <th scope="row" className="sticky left-0 z-10 border-b border-hairline bg-white px-4 py-1.5 text-left font-medium">
                    <span className="block truncate text-[14px]">{r.name}</span>
                    <span className="block text-[12px] font-normal text-ink-soft">{t.admin.nav.roles[r.role]}{!r.fromSchedule && ` · ${A.noSchedule}`}</span>
                  </th>
                  {r.days.map((d) => (
                    <td key={d.date} className="border-b border-hairline px-0.5 py-1.5 text-center">{cell(r, d)}</td>
                  ))}
                  <td className="border-b border-hairline px-3 text-right tabular-nums">{s.worked} / {s.planned}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* < md: ажилтан бүр эвхэгддэг карт */}
      <div className="space-y-3 md:hidden">
        {rows.map((r) => {
          const s = sumOf(r);
          return (
            <details key={r.id} className="group rounded-2xl border border-hairline bg-white">
              <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium">{r.name}</span>
                  <span className="block text-[13px] text-ink-soft">{A.worked}: {s.worked} / {s.planned}</span>
                </span>
                <ChevronDown className="size-5 text-ink-soft transition group-open:rotate-180" aria-hidden />
              </summary>
              <div className="grid grid-cols-7 gap-1.5 px-3 pb-4">
                {WD.map((w, i) => (
                  <span key={w} className="text-center text-[11px] text-ink-faint">{WD[(i + 1) % 7]}</span>
                ))}
                {/* Даваагаас эхэлнэ: эхний өдрийн өмнөх хоосон нүд */}
                {Array.from({ length: (weekday(r.days[0]!.date) + 6) % 7 }, (_, i) => <span key={`pad${i}`} />)}
                {r.days.map((d) => <div key={d.date}>{cell(r, d, true)}</div>)}
              </div>
            </details>
          );
        })}
      </div>

      {edit && <EditDay key={`${edit.row.id}${edit.day.date}`} row={edit.row} day={edit.day} onClose={() => setEdit(null)} />}
    </>
  );
}

function Legend() {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-ink-soft" aria-label={A.legend}>
      {STATUSES.map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <span className={`grid size-6 place-items-center rounded-md text-[12px] font-medium ${STATUS_TONE[s]}`}>{A.short[s]}</span>
          {A.status[s]}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5"><span className="size-6 rounded-md ring-2 ring-navy/40" />{A.marked}</span>
      <span className="inline-flex items-center gap-1.5"><Lock className="size-3.5" />{A.locked}</span>
    </div>
  );
}

function EditDay({ row, day, onClose }: { row: GridRow; day: GridDay; onClose: () => void }) {
  const [status, setStatus] = useState<Status>(day.status);
  const [hours, setHours] = useState(day.hours?.toString() ?? "");
  const [note, setNote] = useState(day.note ?? "");
  const { run, pending, fieldErrors } = useServerAction(setWorkDayAction);
  const save = () =>
    run({ staffId: row.id, date: day.date, status, hours: hours === "" ? null : Number(hours), note: note || null }, { onSuccess: onClose });

  return (
    <Dialog
      open
      onClose={onClose}
      title={`${row.name} · ${day.date}`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t.admin.cancel}</Button>
          <Button onClick={save} disabled={pending}>{pending ? t.admin.saving : A.save}</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <fieldset>
          <legend className="mb-2 text-[14px] font-medium">{t.admin.status}</legend>
          <div className="grid grid-cols-2 gap-2">
            {STATUSES.map((s) => (
              <label key={s} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-[14px] ${status === s ? "border-navy bg-navy/[0.04]" : "border-hairline"}`}>
                <input type="radio" name="status" value={s} checked={status === s} onChange={() => setStatus(s)} className="accent-navy" />
                <span className={`grid size-6 place-items-center rounded-md text-[12px] font-medium ${STATUS_TONE[s]}`}>{A.short[s]}</span>
                {A.status[s]}
              </label>
            ))}
          </div>
        </fieldset>
        <Field label={A.hours} htmlFor="att-hours" error={fieldErrors.hours}>
          <Input id="att-hours" type="number" inputMode="decimal" min={0} max={24} step={0.5} value={hours} onChange={(e) => setHours(e.target.value)} className="max-w-32" />
        </Field>
        <Field label={A.note} htmlFor="att-note" error={fieldErrors.note}>
          <Input id="att-note" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}

