"use client";

import { useState } from "react";
import { Dialog } from "@/components/admin/Dialog";
import { useServerAction } from "@/components/admin/use-action";
import { Button, Field, Input, Select } from "@/components/admin/ui";
import { t } from "@/i18n";
import { formatDateLabel, formatTime, ubDateKey } from "@/lib/time";
import { apptFreeSearch } from "@/server/actions/appointments";
import type { CalService } from "./types";

const c = t.admin.calendar;
const MAX_PER_DAY = 12;
type Result = Extract<Awaited<ReturnType<typeof apptFreeSearch>>, { ok: true }>["data"];

/** Quick answer for the phone: free times for a service over the next 7 days */
export function FreeSlotSearch({
  open,
  onClose,
  services,
  staff,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  services: CalService[];
  staff: { id: string; name: string }[];
  onPick: (p: { serviceId: string; staffId: string; date: string; time: string }) => void;
}) {
  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [from, setFrom] = useState(ubDateKey());
  const [result, setResult] = useState<Result | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const search = useServerAction(apptFreeSearch);

  const name = (id: string) => result?.staff.find((s) => s.id === id)?.name ?? "";

  return (
    <Dialog open={open} onClose={onClose} title={c.free.title} wide>
      <form
        className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px_150px_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (serviceId) void search.run({ serviceId, staffId: staffId || null, from, days: 7 }, { onSuccess: (r) => (setResult(r), setExpanded({})) });
        }}
      >
        <Field label={c.dialog.service} htmlFor="fs-service">
          <Select id="fs-service" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
            <option value="">{c.dialog.chooseService}</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.durationMin}′
              </option>
            ))}
          </Select>
        </Field>
        <Field label={c.dialog.staff} htmlFor="fs-staff">
          <Select id="fs-staff" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            <option value="">{c.dialog.anyStaff}</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={c.free.from} htmlFor="fs-from">
          <Input id="fs-from" type="date" value={from} min={ubDateKey()} onChange={(e) => e.target.value && setFrom(e.target.value)} />
        </Field>
        <Button type="submit" disabled={!serviceId || search.pending}>
          {c.free.search}
        </Button>
      </form>

      {result && (
        <div className="mt-4 max-h-[55dvh] space-y-3 overflow-y-auto">
          {result.days.every((d) => d.slots.length === 0) && <p className="text-[14px] text-navy/60">{c.free.none}</p>}
          {result.days
            .filter((d) => d.slots.length > 0)
            .map((d) => {
              const all = d.slots.filter((s, i, arr) => staffId || arr.findIndex((x) => x.startsAt === s.startsAt) === i);
              const shown = expanded[d.date] ? all : all.slice(0, MAX_PER_DAY);
              return (
                <section key={d.date}>
                  <h3 className="mb-1 text-[13px] font-medium">{formatDateLabel(d.date)}</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {shown.map((s) => (
                      <button
                        key={`${s.startsAt}|${s.staffId}`}
                        type="button"
                        onClick={() => onPick({ serviceId, staffId: s.staffId, date: d.date, time: formatTime(new Date(s.startsAt)) })}
                        className="rounded-md border border-line bg-white px-2.5 py-1 text-[13px] tabular-nums hover:border-navy/40"
                      >
                        {formatTime(new Date(s.startsAt))}
                        {!staffId && <span className="text-navy/45"> · {name(s.staffId)}</span>}
                      </button>
                    ))}
                    {all.length > shown.length && (
                      <button type="button" className="px-2 text-[13px] underline underline-offset-4" onClick={() => setExpanded((e) => ({ ...e, [d.date]: true }))}>
                        {c.free.more(all.length - shown.length)}
                      </button>
                    )}
                  </div>
                </section>
              );
            })}
        </div>
      )}
    </Dialog>
  );
}
