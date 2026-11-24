"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { CustomerPicker, type PickedCustomer } from "@/components/admin/customers/CustomerPicker";
import { Dialog } from "@/components/admin/Dialog";
import { useServerAction } from "@/components/admin/use-action";
import { Badge, Button, Field, Input, Select, Textarea } from "@/components/admin/ui";
import type { ApptStatus } from "@/generated/prisma/enums";
import { t } from "@/i18n";
import { ExtraTimePicker } from "./ExtraTimePicker";
import { formatMNT } from "@/lib/money";
import { formatTime, ubDateKey } from "@/lib/time";
import { apptCreate, apptSlots, apptStatus, apptUpdate } from "@/server/actions/appointments";
import { statusTone } from "./status";
import type { CalService } from "./types";

const c = t.admin.calendar;
const d = c.dialog;
const SOURCES = ["PHONE", "INSTAGRAM", "FACEBOOK", "WALK_IN", "OTHER"] as const;
type Source = (typeof SOURCES)[number];

export type ApptDialogInit = {
  /** edit mode */
  id?: string;
  version?: number;
  status?: ApptStatus;
  customer?: PickedCustomer | null;
  serviceId?: string;
  staffId?: string;
  date: string;
  /** "HH:MM" — preselect this slot if it is available */
  time?: string;
  roomId?: string | null;
  /** "+ Нэмэлт цаг" in minutes */
  extraMin?: number;
  source?: Source;
  note?: string | null;
};

type SlotsResult = Extract<Awaited<ReturnType<typeof apptSlots>>, { ok: true }>["data"];
type Slot = SlotsResult["slots"][number];

export function AppointmentDialog({ open, init, services, cancelReasons, canCancel, onClose }: {
  open: boolean;
  init: ApptDialogInit | null;
  services: CalService[];
  cancelReasons: string[];
  canCancel: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={init?.id ? d.editTitle : d.newTitle}
      badge={init?.status ? <Badge tone={statusTone(init.status)}>{t.admin.apptStatus[init.status]}</Badge> : undefined}
      wide
    >
      {init && <DialogBody key={JSON.stringify(init)} init={init} services={services} cancelReasons={cancelReasons} canCancel={canCancel} onClose={onClose} />}
    </Dialog>
  );
}

function DialogBody({ init, services, cancelReasons, canCancel, onClose }: { init: ApptDialogInit; services: CalService[]; cancelReasons: string[]; canCancel: boolean; onClose: () => void }) {
  const router = useRouter();
  const [customer, setCustomer] = useState<PickedCustomer | null>(init.customer ?? null);
  const [serviceId, setServiceId] = useState(init.serviceId ?? "");
  const [staffId, setStaffId] = useState(init.staffId ?? "");
  const [date, setDate] = useState(init.date);
  const [result, setResult] = useState<SlotsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<Slot | null>(null);
  const [roomId, setRoomId] = useState<string>(init.roomId ?? "");
  const [extraMin, setExtraMin] = useState(init.extraMin ?? 0);
  const [source, setSource] = useState<Source>(init.source ?? "PHONE");
  const [note, setNote] = useState(init.note ?? "");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const create = useServerAction(apptCreate);
  const update = useServerAction(apptUpdate);
  const status = useServerAction(apptStatus);
  const save = init.id ? update : create;

  // Load free slots whenever service / date / staff change
  useEffect(() => {
    if (!serviceId || !date) return;
    let stale = false;
    const run = async () => {
      setLoading(true);
      const res = await apptSlots({ serviceId, date, staffId: staffId || null, excludeId: init.id ?? null, extraMin });
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
  }, [serviceId, date, staffId, extraMin, init.id, init.time, init.date]);

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

  // Services grouped by category (in sort order; uncategorised last)
  const groups = useMemo(() => {
    const out: { name: string; items: CalService[] }[] = [];
    for (const s of services) {
      const name = s.category?.trim() || d.other;
      const g = out.find((x) => x.name === name);
      if (g) g.items.push(s);
      else out.push({ name, items: [s] });
    }
    return [...out.filter((g) => g.name !== d.other), ...out.filter((g) => g.name === d.other)];
  }, [services]);

  const service = services.find((s) => s.id === serviceId);
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
      extraMin,
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
      const again = await apptSlots({ serviceId, date, staffId: staffId || null, excludeId: init.id ?? null, extraMin });
      if (again.ok) setResult(again.data);
    }
  };

  const hint = !customer ? d.customerFirst : serviceId && !picked ? d.pickSlot : null;

  return (
    // Not a <form>: CustomerPicker renders its own create-customer form (nested forms are invalid)
    <div className="space-y-7">
      <CustomerPicker customer={customer} onChange={setCustomer} plain />

      <fieldset>
        <legend className="mb-2 text-[14px] font-medium text-ink">{d.service}</legend>
        {save.fieldErrors.serviceId && <p className="mb-2 text-[13px] text-danger" role="alert">{save.fieldErrors.serviceId[0]}</p>}
        <div className="space-y-4" role="radiogroup" aria-label={d.service}>
          {groups.map((g) => (
            <div key={g.name}>
              {groups.length > 1 && <p className="mb-2 text-[13px] font-medium uppercase tracking-[0.06em] text-champagne-ink">{g.name}</p>}
              <div className="grid gap-2 sm:grid-cols-2">
                {g.items.map((s) => {
                  const on = s.id === serviceId;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => {
                        setServiceId(s.id);
                        setPicked(null);
                      }}
                      className={`relative rounded-xl border bg-white px-4 py-3 text-left transition-colors duration-150 ${on ? "border-navy ring-1 ring-navy" : "border-hairline hover:border-ink/25"}`}
                    >
                      <span className="block pr-6 text-[15px] font-medium text-ink">{s.name}</span>
                      <span className="mt-0.5 block text-[14px] text-ink-soft tabular-nums">
                        {d.duration(s.durationMin)} · {formatMNT(s.price)}
                        {s.priceFrom ? "+" : ""}
                      </span>
                      {on && <Check className="absolute right-3 top-3 size-[18px] text-navy" strokeWidth={2.25} aria-hidden />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
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
          <legend className="mb-2 text-[14px] font-medium text-ink">{d.slots}</legend>
          {loading ? (
            <p className="text-[14px] text-ink-soft">{d.loadingSlots}</p>
          ) : chips.length === 0 ? (
            <p className="rounded-xl bg-warn-bg px-4 py-3 text-[14px] text-warn">{d.noSlots}</p>
          ) : (
            <div className="flex max-h-56 flex-wrap gap-2 overflow-y-auto" role="listbox" aria-label={d.slots}>
              {chips.map((s) => {
                const on = picked?.startsAt === s.startsAt && picked.staffId === s.staffId;
                return (
                  <button
                    key={`${s.startsAt}|${s.staffId}`}
                    type="button"
                    role="option"
                    aria-selected={on}
                    onClick={() => (setPicked(s), s.roomId && setRoomId(s.roomId))}
                    className={`h-10 rounded-full border px-4 text-[14px] tabular-nums transition-colors duration-150 ${on ? "border-navy bg-navy text-white" : "border-hairline bg-white text-ink hover:border-ink/30"}`}
                  >
                    {formatTime(new Date(s.startsAt))}
                    {staffId ? "" : <span className={on ? "text-white/75" : "text-ink-soft"}> · {staffName(s.staffId)}</span>}
                  </button>
                );
              })}
            </div>
          )}
          {picked && <p className="mt-2 text-[14px] text-ink-soft">{d.selected(formatTime(new Date(picked.startsAt)), staffName(picked.staffId))}</p>}
          {save.fieldErrors.startsAt && <p className="mt-1 text-[13px] text-danger" role="alert">{save.fieldErrors.startsAt[0]}</p>}
        </fieldset>
      )}

      {serviceId && <ExtraTimePicker value={extraMin} onChange={setExtraMin} />}

      <div className="grid gap-4 sm:grid-cols-2">
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
        <Textarea id="ad-note" className="min-h-20" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>

      {/* Sticky action row */}
      <div className="sticky -bottom-6 -mx-7 -mb-6 flex flex-wrap items-center gap-3 border-t border-hairline bg-white px-7 py-4">
        {init.id && canCancel && (
          <Button variant="danger" onClick={() => setCancelOpen(true)}>
            {d.cancelAppt}
          </Button>
        )}
        <div className="mr-auto min-w-0">
          {service ? (
            <p className="text-[15px]">
              <span className="text-ink-soft">{d.total} </span>
              <span className="text-[18px] font-semibold tabular-nums">
                {formatMNT(service.price)}
                {service.priceFrom ? "+" : ""}
              </span>
            </p>
          ) : null}
          {hint && <p className="text-[13px] text-ink-soft">{hint}</p>}
        </div>
        <Button variant="secondary" onClick={onClose}>
          {t.admin.cancel}
        </Button>
        <Button onClick={() => void submit()} disabled={!customer || !picked || save.pending || (needsRoom && !roomId && !picked?.roomId)}>
          {d.save}
        </Button>
      </div>

      {init.id && (
        <ConfirmDialog
          open={cancelOpen}
          title={c.cancelTitle}
          confirmLabel={c.actions.cancel}
          danger
          pending={status.pending}
          confirmDisabled={!reason}
          onClose={() => (setCancelOpen(false), setReason(""))}
          onConfirm={() =>
            void status.run({ id: init.id!, action: "cancel", reason }, {
              onSuccess: () => {
                setCancelOpen(false);
                onClose();
                router.refresh();
              },
            })
          }
        >
          <p className="text-[15px] text-ink-soft">{c.cancelExplain}</p>
          <Field label={c.reason} htmlFor="dlg-cancel-reason">
            <Select id="dlg-cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus>
              <option value="">{c.chooseReason}</option>
              {cancelReasons.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </Field>
        </ConfirmDialog>
      )}
    </div>
  );
}
