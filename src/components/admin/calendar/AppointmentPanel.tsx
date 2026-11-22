"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useServerAction } from "@/components/admin/use-action";
import { Badge, Button, Field, Select, Textarea } from "@/components/admin/ui";
import { t } from "@/i18n";
import { formatMNT } from "@/lib/money";
import { formatDateLabel, formatDateTime, formatTime, ubDateKey } from "@/lib/time";
import { apptDetail, apptNote, apptOpenPos, apptStatus } from "@/server/actions/appointments";
import { availableActions, type ApptAction } from "@/server/modules/appointments/state";
import type { ApptDialogInit } from "./AppointmentDialog";
import type { CalPerms } from "./types";
import { saleLabel, statusTone } from "./status";

const c = t.admin.calendar;
type Detail = Extract<Awaited<ReturnType<typeof apptDetail>>, { ok: true }>["data"] & { loadedAt: number };

export function AppointmentPanel({
  id,
  perms,
  cancelReasons,
  onClose,
  onEdit,
}: {
  id: string;
  perms: CalPerms;
  cancelReasons: string[];
  onClose: () => void;
  onEdit: (init: ApptDialogInit) => void;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [confirm, setConfirm] = useState<ApptAction | null>(null);
  const [reason, setReason] = useState("");
  const status = useServerAction(apptStatus);
  const openPos = useServerAction(apptOpenPos);

  const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback(() => setReloadKey((k) => k + 1), []);
  useEffect(() => {
    let stale = false;
    void apptDetail(id).then((res) => {
      // Remember when it was loaded: "no-show" is only offered after the start time
      if (!stale && res.ok) setDetail({ ...res.data, loadedAt: Date.now() });
    });
    return () => {
      stale = true;
    };
  }, [id, reloadKey]);

  // Escape closes the panel (dialogs handle their own Escape)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !document.querySelector("dialog[open]") && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const run = (action: ApptAction, why?: string) =>
    status.run({ id, action, reason: why ?? null }, { onSuccess: () => (setConfirm(null), setReason(""), load(), router.refresh()) });

  if (!detail) {
    return (
      <aside className="fixed inset-y-0 right-0 z-30 w-[min(420px,100vw)] border-l border-line bg-white p-5 shadow-xl" aria-busy="true">
        <p className="text-[14px] text-navy/55">…</p>
      </aside>
    );
  }

  const startsAt = new Date(detail.startsAt);
  const endsAt = new Date(detail.endsAt);
  const started = detail.loadedAt >= startsAt.getTime();
  const actions = availableActions(detail.status).filter((a) => a !== "arrive" && (a !== "noShow" || started));
  const activeSale = detail.sales.find((s) => ["DRAFT", "PENDING_PAYMENT", "PARTIALLY_PAID"].includes(s.status));
  const sameDay = ubDateKey(new Date(detail.loadedAt)) === ubDateKey(startsAt);
  const showPos = perms.canPos && ["BOOKED", "CONFIRMED", "ARRIVED", "IN_PROGRESS"].includes(detail.status);
  const arrived = detail.status === "ARRIVED" || detail.status === "IN_PROGRESS";
  // Arrived / has an active POS sale: time & staff are fixed (changed in POS) — only the note is editable
  const locked = arrived || Boolean(activeSale);
  const editable = perms.canWrite && !locked && (detail.status === "BOOKED" || detail.status === "CONFIRMED");
  const canComplete = perms.canDoneManual && arrived && started;

  const rows: [string, React.ReactNode][] = [
    [c.when, `${formatDateLabel(startsAt)} ${formatTime(startsAt)}–${formatTime(endsAt)}`],
    [c.customer, <Link key="c" href={`/admin/customers/${detail.customer.id}`} className="underline-offset-4 hover:underline">{detail.customer.name}</Link>],
    ...(detail.customer.phone ? [[c.phone, <a key="p" href={`tel:${detail.customer.phone}`} className="underline-offset-4 hover:underline">{detail.customer.phone}</a>] as [string, React.ReactNode]] : []),
    ...(detail.customer.email ? [[c.email, detail.customer.email] as [string, React.ReactNode]] : []),
    [c.service, `${detail.service.name} · ${detail.service.durationMin}′${detail.service.bufferMin ? ` (+${detail.service.bufferMin}′ ${c.buffer.toLowerCase()})` : ""}`],
    [c.staff, detail.staff.name],
    ...(detail.room ? [[c.room, detail.room.name] as [string, React.ReactNode]] : []),
    [c.source, t.admin.apptSource[detail.source as keyof typeof t.admin.apptSource] ?? detail.source],
    [c.price, formatMNT(detail.priceSnapshot)],
    ...(detail.note ? [[c.note, <span key="n" className="whitespace-pre-line">{detail.note}</span>] as [string, React.ReactNode]] : []),
    ...(detail.cancelReason ? [[c.cancelReason, detail.cancelReason] as [string, React.ReactNode]] : []),
    ...(detail.sales.length ? [[c.sale, (
      <span key="s" className="flex flex-col">
        {detail.sales.map((s) => (
          <Link key={s.id} href={s.status === "DRAFT" ? `/admin/pos?sale=${s.id}` : `/admin/sales/${s.id}`} className="underline-offset-4 hover:underline">
            {saleLabel(s.number, s.status)}
          </Link>
        ))}
      </span>
    )] as [string, React.ReactNode]] : []),
  ];

  return (
    <aside role="dialog" aria-label={c.details} className="fixed inset-y-0 right-0 z-30 flex w-[min(420px,100vw)] flex-col border-l border-line bg-white shadow-xl">
      <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="text-[16px] font-medium">{detail.customer.name}</h2>
          <p className="mt-1">
            <Badge tone={statusTone(detail.status)}>{t.admin.apptStatus[detail.status]}</Badge>
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label={c.close} className="rounded p-1 hover:bg-navy/5">
          <X className="size-4" />
        </button>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <dl className="grid grid-cols-[120px_minmax(0,1fr)] gap-x-3 gap-y-2 text-[13.5px]">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-navy/55">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-wrap gap-2">
          {showPos && (
            <span className="inline-flex flex-col">
              <Button
                disabled={openPos.pending || !sameDay}
                aria-describedby={sameDay ? undefined : "pos-same-day"}
                onClick={() => openPos.run(id, { onSuccess: (r) => router.push(`/admin/pos?sale=${r.saleId}`) })}
              >
                {activeSale ? c.continuePos : c.openPos}
              </Button>
              {!sameDay && (
                <span id="pos-same-day" className="mt-1 text-[12px] text-navy/55">
                  {c.sameDayOnly}
                </span>
              )}
            </span>
          )}
          {editable && (
            <Button
              variant="secondary"
              onClick={() =>
                onEdit({
                  id: detail.id,
                  version: detail.version,
                  customer: { id: detail.customer.id, name: detail.customer.name, phone: detail.customer.phone ?? "", email: detail.customer.email ?? null },
                  serviceId: detail.service.id,
                  staffId: detail.staffId,
                  date: ubDateKey(startsAt),
                  time: formatTime(startsAt),
                  roomId: detail.roomId,
                  source: detail.source as ApptDialogInit["source"],
                  note: detail.note,
                })
              }
            >
              {c.edit}
            </Button>
          )}
          {perms.canStatus &&
            actions.map((a) => (
              <Button
                key={a}
                variant={a === "cancel" || a === "noShow" ? "danger" : "secondary"}
                disabled={status.pending}
                onClick={() => (a === "cancel" || a === "noShow" ? setConfirm(a) : void run(a))}
              >
                {c.actions[a]}
              </Button>
            ))}
          {canComplete && (
            <Button variant="ghost" onClick={() => setConfirm("complete")}>
              {c.actions.complete}
            </Button>
          )}
        </div>

        {perms.canWrite && locked && detail.status !== "DONE" && <NoteEditor key={detail.note ?? ""} id={id} initial={detail.note ?? ""} onSaved={() => (load(), router.refresh())} />}

        {detail.history.length > 0 && (
          <section>
            <h3 className="mb-1.5 text-[12px] font-medium uppercase tracking-[0.4px] text-navy/55">{c.history}</h3>
            <ol className="space-y-1 text-[12.5px] text-navy/70">
              {detail.history.map((h) => (
                <li key={h.id}>
                  {formatDateTime(new Date(h.createdAt))} · {c.historyActions[h.action] ?? h.action}
                  {h.user ? ` · ${h.user.name}` : ""}
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>

      <ConfirmDialog
        open={confirm === "cancel"}
        title={c.cancelTitle}
        confirmLabel={c.actions.cancel}
        danger
        pending={status.pending}
        confirmDisabled={!reason}
        onClose={() => (setConfirm(null), setReason(""))}
        onConfirm={() => void run("cancel", reason)}
      >
        <Field label={c.reason} htmlFor="cancel-reason">
          <Select id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus>
            <option value="">{c.chooseReason}</option>
            {cancelReasons.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </Field>
      </ConfirmDialog>
      <ConfirmDialog open={confirm === "noShow"} title={c.noShowTitle} confirmLabel={c.actions.noShow} danger pending={status.pending} onClose={() => setConfirm(null)} onConfirm={() => void run("noShow")}>
        <p className="text-[14px]">{c.noShowHint}</p>
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === "complete"}
        title={c.completeTitle}
        confirmLabel={c.actions.complete}
        pending={status.pending}
        confirmDisabled={reason.trim().length < 3}
        onClose={() => (setConfirm(null), setReason(""))}
        onConfirm={() => void run("complete", reason)}
      >
        <p className="text-[13px] text-navy/60">{c.completeHint}</p>
        <Field label={c.reason} htmlFor="complete-reason">
          <Textarea id="complete-reason" className="min-h-16" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </ConfirmDialog>
    </aside>
  );
}

function NoteEditor({ id, initial, onSaved }: { id: string; initial: string; onSaved: () => void }) {
  const [note, setNote] = useState(initial);
  const save = useServerAction(apptNote);
  return (
    <section className="space-y-1.5">
      <p className="text-[12px] text-navy/55">{c.lockedHint}</p>
      <Field label={c.note} htmlFor="appt-note">
        <Textarea id="appt-note" className="min-h-16" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <Button size="sm" variant="secondary" disabled={save.pending || note === initial} onClick={() => save.run({ id, note: note || null }, { onSuccess: onSaved })}>
        {c.saveNote}
      </Button>
    </section>
  );
}
