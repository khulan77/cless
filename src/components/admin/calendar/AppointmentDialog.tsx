"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CustomerPicker, type PickedCustomer } from "@/components/admin/customers/CustomerPicker";
import { Dialog } from "@/components/admin/Dialog";
import { useServerAction } from "@/components/admin/use-action";
import { Button, Field, Input, Select, Textarea } from "@/components/admin/ui";
import { t } from "@/i18n";
import { formatTime, ubDateKey } from "@/lib/time";
import { apptCreate, apptSlots, apptUpdate } from "@/server/actions/appointments";
import type { CalService } from "./types";

const c = t.admin.calendar;
const d = c.dialog;
const SOURCES = ["PHONE", "INSTAGRAM", "FACEBOOK", "WALK_IN", "OTHER"] as const;
type Source = (typeof SOURCES)[number];

export type ApptDialogInit = {
  /** edit mode */
  id?: string;
  version?: number;
  customer?: PickedCustomer | null;
  serviceId?: string;
  staffId?: string;
  date: string;
  /** "HH:MM" — preselect this slot if it is available */
  time?: string;
  roomId?: string | null;
  source?: Source;
  note?: string | null;
};

type SlotsResult = Extract<Awaited<ReturnType<typeof apptSlots>>, { ok: true }>["data"];
type Slot = SlotsResult["slots"][number];

export function AppointmentDialog({ open, init, services, onClose }: { open: boolean; init: ApptDialogInit | null; services: CalService[]; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title={init?.id ? d.editTitle : d.newTitle} wide>
      {init && <DialogBody key={JSON.stringify(init)} init={init} services={services} onClose={onClose} />}
    </Dialog>
  );
}

function DialogBody({ init, services, onClose }: { init: ApptDialogInit; services: CalService[]; onClose: () => void }) {
  const router = useRouter();
  const [customer, setCustomer] = useState<PickedCustomer | null>(init.customer ?? null);
  const [serviceId, setServiceId] = useState(init.serviceId ?? "");
  const [staffId, setStaffId] = useState(init.staffId ?? "");
  const [date, setDate] = useState(init.date);
  const [result, setResult] = useState<SlotsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<Slot | null>(null);
  const [roomId, setRoomId] = useState<string>(init.roomId ?? "");
  const [source, setSource] = useState<Source>(init.source ?? "PHONE");
  const [note, setNote] = useState(init.note ?? "");
  const create = useServerAction(apptCreate);
  const update = useServerAction(apptUpdate);
  const save = init.id ? update : create;

  // Load free slots whenever service / date / staff change
  useEffect(() => {
    if (!serviceId || !date) return;
    let stale = false;
    const run = async () => {
      setLoading(true);
      const res = await apptSlots({ serviceId, date, staffId: staffId || null, excludeId: init.id ?? null });
      if (stale) return;
      setLoading(false);
      if (!res.ok) return setResult(null);
      setResult(res.data);
      // Preselect: the clicked cell or the appointment being edited
      const want = init.time && date === init.date ? init.time : null;
      const match = want ? res.data.slots.find((s) => formatTime(new Date(s.startsAt)) === want && (!staffId || s.staffId === staffId)) : undefined;
      setPicked(match ?? null);
      if (match?.roomId) setRoomId(match.roomId);
    };
    void run();
    return () => {
      stale = true;
    };
  }, [serviceId, date, staffId, init.id, init.time, init.date]);

  // "Anyone": one chip per time (first free staff member)
  const chips = useMemo(() => {
    if (!result) return [];
    const seen = new Set<string>();
    return result.slots.filter((s) => {
      const key = staffId ? `${s.startsAt}|${s.staffId}` : s.startsAt;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [result, staffId]);

  const staffName = (id: string) => result?.staff.find((s) => s.id === id)?.name ?? "";
  const needsRoom = Boolean(result?.requiresRoom && result.rooms.length > 0);

  const submit = async () => {
    if (!customer || !picked) return;
    const payload = {
      customerId: customer.id,
      serviceId,
      staffId: picked.staffId,
      roomId: needsRoom ? roomId || picked.roomId : null,
      startsAt: picked.startsAt,
      source,
      note: note || null,
    };
    const res = init.id ? await update.run({ ...payload, id: init.id, version: init.version ?? 0 }) : await create.run(payload);
    if (res.ok) {
      onClose();
      router.refresh();
    } else if (res.code === "APPT_OVERLAP" || res.code?.startsWith("SLOT_")) {
      // The slot was just taken — reload the free slots
      setPicked(null);
      const again = await apptSlots({ serviceId, date, staffId: staffId || null, excludeId: init.id ?? null });
      if (again.ok) setResult(again.data);
    }
  };

  return (
    // Not a <form>: CustomerPicker renders its own create-customer form (nested forms are invalid)
    <div className="space-y-4">
      <CustomerPicker customer={customer} onChange={setCustomer} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={d.service} htmlFor="ad-service" error={save.fieldErrors.serviceId}>
          <Select id="ad-service" value={serviceId} onChange={(e) => (setServiceId(e.target.value), setPicked(null))}>
            <option value="">{d.chooseService}</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.durationMin}′
              </option>
            ))}
          </Select>
        </Field>
        <Field label={d.staff} htmlFor="ad-staff" error={save.fieldErrors.staffId}>
          <Select id="ad-staff" value={staffId} onChange={(e) => (setStaffId(e.target.value), setPicked(null))} disabled={!serviceId}>
            <option value="">{d.anyStaff}</option>
            {(result?.staff ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={d.date} htmlFor="ad-date">
          <Input id="ad-date" type="date" value={date} min={ubDateKey()} onChange={(e) => e.target.value && (setDate(e.target.value), setPicked(null))} />
        </Field>
      </div>

      {serviceId && (
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-navy/80">{d.slots}</legend>
          {loading ? (
            <p className="text-[13px] text-navy/55">{d.loadingSlots}</p>
          ) : chips.length === 0 ? (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-[13px] text-amber-800">{d.noSlots}</p>
          ) : (
            <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto" role="listbox" aria-label={d.slots}>
              {chips.map((s) => {
                const on = picked?.startsAt === s.startsAt && picked.staffId === s.staffId;
                return (
                  <button
                    key={`${s.startsAt}|${s.staffId}`}
                    type="button"
                    role="option"
                    aria-selected={on}
                    onClick={() => (setPicked(s), s.roomId && setRoomId(s.roomId))}
                    className={`rounded-md border px-2.5 py-1 text-[13px] tabular-nums ${on ? "border-navy bg-navy text-white" : "border-line bg-white hover:border-navy/40"}`}
                  >
                    {formatTime(new Date(s.startsAt))}
                    {staffId ? "" : <span className={on ? "text-white/70" : "text-navy/45"}> · {staffName(s.staffId)}</span>}
                  </button>
                );
              })}
            </div>
          )}
          {picked && <p className="mt-1.5 text-[12px] text-navy/60">{d.selected(formatTime(new Date(picked.startsAt)), staffName(picked.staffId))}</p>}
          {save.fieldErrors.startsAt && <p className="mt-1 text-[12px] text-red-600" role="alert">{save.fieldErrors.startsAt[0]}</p>}
        </fieldset>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {needsRoom && (
          <Field label={d.room} htmlFor="ad-room" error={save.fieldErrors.roomId}>
            <Select id="ad-room" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
              <option value="">{d.chooseRoom}</option>
              {result!.rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label={d.source} htmlFor="ad-source">
          <Select id="ad-source" value={source} onChange={(e) => setSource(e.target.value as Source)}>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {t.admin.apptSource[s]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label={d.note} htmlFor="ad-note">
        <Textarea id="ad-note" className="min-h-16" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>

      <div className="flex items-center justify-end gap-2 border-t border-line pt-4">
        {!customer && <span className="mr-auto text-[12px] text-navy/55">{d.customerFirst}</span>}
        {customer && serviceId && !picked && <span className="mr-auto text-[12px] text-navy/55">{d.pickSlot}</span>}
        <Button variant="secondary" onClick={onClose}>
          {t.admin.cancel}
        </Button>
        <Button onClick={() => void submit()} disabled={!customer || !picked || save.pending || (needsRoom && !roomId && !picked?.roomId)}>
          {d.save}
        </Button>
      </div>
    </div>
  );
}
