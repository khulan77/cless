"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useServerAction } from "@/components/admin/use-action";
import { Button, Card, Checkbox, Field, Input, Select, inputClass } from "@/components/admin/ui";
import { t } from "@/i18n";
import { formatDateTime, formatHm, formatRange, ubDateKey } from "@/lib/time";
import {
  addTimeOffAction,
  deleteTimeOffAction,
  saveBookingHoursAction,
  saveScheduleAction,
  saveStaffServicesAction,
} from "@/server/actions/appointments";

const s = t.admin.staffSchedules;
/** Monday first */
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];
type Interval = { start: string; end: string };
type Week = Record<number, Interval[]>;

/** 24-hour time picker in 15-minute steps (native type=time follows the browser locale, e.g. AM/PM) */
const TIMES = Array.from({ length: 24 * 4 + 1 }, (_, i) => formatHm(i * 15));
function TimeSelect({ value, onChange, label, id, allowEmpty }: { value: string; onChange: (v: string) => void; label: string; id?: string; allowEmpty?: boolean }) {
  return (
    <select id={id} aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={`${inputClass} h-8 w-[84px] px-2 text-[13px] tabular-nums`}>
      {allowEmpty && <option value="">--:--</option>}
      {TIMES.map((tm) => (
        <option key={tm} value={tm}>
          {tm}
        </option>
      ))}
    </select>
  );
}

function WeekEditor({ value, onChange, idPrefix }: { value: Week; onChange: (w: Week) => void; idPrefix: string }) {
  const set = (day: number, list: Interval[]) => onChange({ ...value, [day]: list });
  return (
    <div className="space-y-1.5">
      {WEEKDAYS.map((day) => {
        const list = value[day] ?? [];
        return (
          <div key={day} className="grid grid-cols-[72px_minmax(0,1fr)] items-start gap-2">
            <span className="pt-1.5 text-[13px] font-medium">{t.time.weekdays[day]}</span>
            <div className="flex flex-wrap items-center gap-2">
              {list.length === 0 && <span className="pt-1 text-[13px] text-navy/45">{s.closed}</span>}
              {list.map((iv, i) => (
                <span key={i} className="inline-flex items-center gap-1">
                  <TimeSelect
                    label={`${t.time.weekdays[day]} ${i + 1} — ${s.fromTime}`}
                    id={`${idPrefix}-${day}-${i}-s`}
                    value={iv.start}
                    onChange={(v) => set(day, list.map((x, j) => (j === i ? { ...x, start: v } : x)))}
                  />
                  <span className="text-navy/40">–</span>
                  <TimeSelect
                    label={`${t.time.weekdays[day]} ${i + 1} — ${s.toTime}`}
                    value={iv.end}
                    onChange={(v) => set(day, list.map((x, j) => (j === i ? { ...x, end: v } : x)))}
                  />
                  <button type="button" aria-label={s.removeInterval} className="rounded p-1 text-navy/45 hover:text-red-700" onClick={() => set(day, list.filter((_, j) => j !== i))}>
                    <Trash2 className="size-3.5" />
                  </button>
                </span>
              ))}
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[12px] text-navy/60 hover:bg-navy/5"
                onClick={() => set(day, [...list, list.length ? { start: "14:00", end: "19:00" } : { start: "10:00", end: "19:00" }])}
              >
                <Plus className="size-3" /> {s.addInterval}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function BranchHoursForm({ initial }: { initial: { hours: Record<string, Interval[]>; slotMinutes: number; minLeadMinutes: number } }) {
  const router = useRouter();
  const [week, setWeek] = useState<Week>(() => Object.fromEntries(WEEKDAYS.map((d) => [d, initial.hours[String(d)] ?? []])));
  const [slot, setSlot] = useState(initial.slotMinutes);
  const [lead, setLead] = useState(initial.minLeadMinutes);
  const a = useServerAction(saveBookingHoursAction);
  return (
    <Card title={s.branchHours} description={s.branchHoursHint}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void a.run(
            { hours: Object.fromEntries(Object.entries(week).map(([d, l]) => [d, l])) as Record<"0", Interval[]>, slotMinutes: slot, minLeadMinutes: lead },
            { onSuccess: () => router.refresh() },
          );
        }}
      >
        <WeekEditor value={week} onChange={setWeek} idPrefix="branch" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={s.slotMinutes} htmlFor="bh-slot" error={a.fieldErrors.slotMinutes}>
            <Select id="bh-slot" value={slot} onChange={(e) => setSlot(Number(e.target.value))}>
              {[5, 10, 15, 20, 30, 60].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={s.minLead} htmlFor="bh-lead">
            <Input id="bh-lead" type="number" min={0} max={1440} step={15} value={lead} onChange={(e) => setLead(Number(e.target.value) || 0)} />
          </Field>
        </div>
        {a.fieldErrors && Object.entries(a.fieldErrors).filter(([k]) => k.startsWith("hours")).map(([k, v]) => <p key={k} className="text-[12px] text-red-600">{v[0]}</p>)}
        <Button type="submit" disabled={a.pending}>
          {s.save}
        </Button>
      </form>
    </Card>
  );
}

export type StaffCardData = {
  id: string;
  name: string;
  roleLabel: string;
  isBookable: boolean;
  schedule: { weekday: number; startTime: string; endTime: string }[];
  timeOff: { id: string; startsAt: string; endsAt: string; reason: keyof typeof t.admin.timeOffReason; note: string | null }[];
  serviceIds: string[];
};

export function StaffScheduleCard({ staff, services }: { staff: StaffCardData; services: { id: string; name: string }[] }) {
  const router = useRouter();
  const [week, setWeek] = useState<Week>(() => {
    const w: Week = {};
    for (const d of WEEKDAYS) w[d] = staff.schedule.filter((x) => x.weekday === d).map((x) => ({ start: x.startTime, end: x.endTime }));
    return w;
  });
  const [serviceIds, setServiceIds] = useState(staff.serviceIds);
  const [bookable, setBookable] = useState(staff.isBookable);
  const today = ubDateKey();
  const [off, setOff] = useState({ from: today, to: today, fromTime: "", toTime: "", reason: "VACATION" as StaffCardData["timeOff"][number]["reason"], note: "" });
  const [conflicts, setConflicts] = useState<{ id: string; startsAt: string; endsAt: string; customer: { name: string }; service: { name: string } }[] | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const saveWeek = useServerAction(saveScheduleAction);
  const saveSvc = useServerAction(saveStaffServicesAction);
  const addOff = useServerAction(addTimeOffAction);
  const delOff = useServerAction(deleteTimeOffAction);
  const p = `st-${staff.id}`;

  return (
    <Card title={staff.name} description={staff.roleLabel}>
      <div className="grid gap-6 xl:grid-cols-2">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const intervals = Object.entries(week).flatMap(([d, l]) => l.map((i) => ({ weekday: Number(d), startTime: i.start, endTime: i.end })));
            void saveWeek.run({ staffId: staff.id, intervals }, { onSuccess: () => router.refresh() });
          }}
        >
          <h3 className="text-[13px] font-medium uppercase tracking-[0.4px] text-navy/55">{s.weekly}</h3>
          <WeekEditor value={week} onChange={setWeek} idPrefix={p} />
          {Object.values(saveWeek.fieldErrors)[0] && <p className="text-[12px] text-red-600">{Object.values(saveWeek.fieldErrors)[0]![0]}</p>}
          <Button type="submit" size="sm" disabled={saveWeek.pending}>
            {s.save}
          </Button>
        </form>

        <div className="space-y-6">
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              void saveSvc.run({ staffId: staff.id, serviceIds, isBookable: bookable }, { onSuccess: () => router.refresh() });
            }}
          >
            <h3 className="text-[13px] font-medium uppercase tracking-[0.4px] text-navy/55">{s.services}</h3>
            <Checkbox label={s.bookable} checked={bookable} onChange={(e) => setBookable(e.target.checked)} />
            <p className="text-[12px] text-navy/50">{s.servicesHint}</p>
            <div className="grid gap-1 sm:grid-cols-2">
              {services.map((sv) => (
                <Checkbox
                  key={sv.id}
                  label={sv.name}
                  checked={serviceIds.includes(sv.id)}
                  onChange={(e) => setServiceIds((ids) => (e.target.checked ? [...ids, sv.id] : ids.filter((x) => x !== sv.id)))}
                  className="text-[13px]"
                />
              ))}
            </div>
            <Button type="submit" size="sm" variant="secondary" disabled={saveSvc.pending}>
              {s.save}
            </Button>
          </form>

          <div className="space-y-2">
            <h3 className="text-[13px] font-medium uppercase tracking-[0.4px] text-navy/55">{s.timeOff}</h3>
            {staff.timeOff.length === 0 ? (
              <p className="text-[13px] text-navy/50">{s.noTimeOff}</p>
            ) : (
              <ul className="divide-y divide-line rounded-md border border-line text-[13px]">
                {staff.timeOff.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span>
                      {formatDateTime(new Date(o.startsAt))} — {formatDateTime(new Date(o.endsAt))} · {t.admin.timeOffReason[o.reason]}
                      {o.note ? <span className="text-navy/50"> · {o.note}</span> : null}
                    </span>
                    <button type="button" aria-label={s.deleteTimeOff} className="rounded p-1 text-navy/45 hover:text-red-700" onClick={() => setDeleteId(o.id)}>
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form
              className="grid gap-2 rounded-md bg-navy/[0.03] p-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                void addOff.run(
                  { staffId: staff.id, from: off.from, to: off.to, fromTime: off.fromTime || null, toTime: off.toTime || null, reason: off.reason, note: off.note || null },
                  { onSuccess: (r) => (setConflicts(r.conflicts), router.refresh()) },
                );
              }}
            >
              <Field label={s.from} htmlFor={`${p}-from`} error={addOff.fieldErrors.from}>
                <Input id={`${p}-from`} type="date" value={off.from} onChange={(e) => setOff({ ...off, from: e.target.value })} />
              </Field>
              <Field label={s.to} htmlFor={`${p}-to`} error={addOff.fieldErrors.to}>
                <Input id={`${p}-to`} type="date" value={off.to} onChange={(e) => setOff({ ...off, to: e.target.value })} />
              </Field>
              <Field label={s.fromTime} htmlFor={`${p}-ft`} hint={s.allDayHint}>
                <TimeSelect id={`${p}-ft`} label={s.fromTime} allowEmpty value={off.fromTime} onChange={(v) => setOff({ ...off, fromTime: v })} />
              </Field>
              <Field label={s.toTime} htmlFor={`${p}-tt`} error={addOff.fieldErrors.toTime}>
                <TimeSelect id={`${p}-tt`} label={s.toTime} allowEmpty value={off.toTime} onChange={(v) => setOff({ ...off, toTime: v })} />
              </Field>
              <Field label={s.reason} htmlFor={`${p}-reason`}>
                <Select id={`${p}-reason`} value={off.reason} onChange={(e) => setOff({ ...off, reason: e.target.value as typeof off.reason })}>
                  {Object.entries(t.admin.timeOffReason).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={s.note} htmlFor={`${p}-note`}>
                <Input id={`${p}-note`} value={off.note} onChange={(e) => setOff({ ...off, note: e.target.value })} />
              </Field>
              <div className="sm:col-span-2">
                <Button type="submit" size="sm" variant="secondary" disabled={addOff.pending}>
                  {s.addTimeOff}
                </Button>
              </div>
            </form>
            {conflicts && conflicts.length > 0 && (
              <div role="alert" className="rounded-md bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
                <p>{s.conflicts(conflicts.length)}</p>
                <ul className="mt-1 list-disc pl-5">
                  {conflicts.map((x) => (
                    <li key={x.id}>
                      {formatRange(new Date(x.startsAt), new Date(x.endsAt))} · {x.customer.name} · {x.service.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={deleteId !== null}
        title={s.deleteTimeOff}
        confirmLabel={t.admin.delete}
        danger
        pending={delOff.pending}
        onClose={() => setDeleteId(null)}
        onConfirm={() => delOff.run(deleteId!, { onSuccess: () => (setDeleteId(null), router.refresh()) })}
      />
    </Card>
  );
}
