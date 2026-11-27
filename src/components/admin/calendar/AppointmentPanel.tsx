"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ServiceUseSuggestions } from "./ServiceUseSuggestions";
import { useCallback, useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useServerAction } from "@/components/admin/use-action";
import { Badge, Button, Field, Textarea } from "@/components/admin/ui";
import { t } from "@/i18n";
import { formatMNT } from "@/lib/money";
import { formatDateLabel, formatDateTime, formatTime, ubDateKey } from "@/lib/time";
import { apptDetail, apptExtraTime, apptNote, apptOpenPos, apptStatus } from "@/server/actions/appointments";
import { CANCEL_CATEGORY_LABELS, isCancelCategory } from "@/server/modules/appointments/cancel";
import { availableActions, type ApptAction } from "@/server/modules/appointments/state";
import type { ApptDialogInit } from "./AppointmentDialog";
import { CancelReasonFields, cancelReady, emptyCancel, type CancelValue } from "./CancelReasonFields";
import { ExtraTimePicker } from "./ExtraTimePicker";
import type { CalPerms } from "./types";
import { saleLabel, statusTone } from "./status";

const c = t.admin.calendar;

/** "Нэр · 24/11 14:05 · Ажилтан өвчтэй — тайлбар" (older cancellations: just the reason) */
function cancelLine(d: { cancelReason: string | null; cancelCategory: string | null; cancelledAt: Date | string | null; cancelledBy: { name: string } | null }) {
  const label = isCancelCategory(d.cancelCategory) ? CANCEL_CATEGORY_LABELS[d.cancelCategory] : null;
  const why = label ? (d.cancelReason && d.cancelReason !== label ? `${label} — ${d.cancelReason}` : label) : d.cancelReason;
  return [d.cancelledBy?.name, d.cancelledAt ? formatDateTime(new Date(d.cancelledAt)) : null, why].filter(Boolean).join(" · ");
}
type Detail = Extract<Awaited<ReturnType<typeof apptDetail>>, { ok: true }>["data"] & { loadedAt: number };

export function AppointmentPanel({
  id,
  perms,
  onClose,
  onEdit,
}: {
  id: string;
  perms: CalPerms;
  onClose: () => void;
  onEdit: (init: ApptDialogInit) => void;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [confirm, setConfirm] = useState<ApptAction | null>(null);
  const [reason, setReason] = useState("");
  const [cancel, setCancel] = useState<CancelValue>(emptyCancel);
  const status = useServerAction(apptStatus);
  const openPos = useServerAction(apptOpenPos);
  const extra = useServerAction(apptExtraTime);

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

  const run = (action: ApptAction, why?: string, category?: CancelValue["category"]) =>
    status.run(
      { id, action, reason: why ?? null, category: category || null },
      { onSuccess: () => (setConfirm(null), setReason(""), setCancel(emptyCancel), load(), router.refresh()) },
    );

  if (!detail) {
    return (
      <aside className="fixed inset-y-0 right-0 z-30 w-[min(440px,100vw)] space-y-4 border-l border-hairline bg-white p-7 shadow-[0_0_48px_rgba(14,34,67,0.12)]" aria-busy="true">
        <div className="h-8 w-2/3 animate-pulse rounded-xl bg-ink/[0.06]" />
        <div className="h-5 w-1/3 animate-pulse rounded-xl bg-ink/[0.06]" />
        <div className="h-40 animate-pulse rounded-xl bg-ink/[0.06]" />
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
    ...(detail.extraMin ? [[c.extraTime, c.extraLabel(detail.extraMin)] as [string, React.ReactNode]] : []),
    [c.source, t.admin.apptSource[detail.source as keyof typeof t.admin.apptSource] ?? detail.source],
    [c.price, formatMNT(detail.priceSnapshot)],
    ...(detail.note ? [[c.note, <span key="n" className="whitespace-pre-line">{detail.note}</span>] as [string, React.ReactNode]] : []),
    ...(detail.status === "CANCELLED" ? [[c.cancelledBy, cancelLine(detail)] as [string, React.ReactNode]] : []),
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
    <aside role="dialog" aria-label={c.details} className="fixed inset-y-0 right-0 z-30 flex w-[min(440px,100vw)] flex-col border-l border-hairline bg-white shadow-[0_0_48px_rgba(14,34,67,0.12)]">
      <header className="flex items-start justify-between gap-3 border-b border-hairline px-7 pb-5 pt-6">
        <div>
          <h2 className="font-display text-[26px] font-semibold leading-tight">{detail.customer.name}</h2>
          <p className="mt-2">
            <Badge tone={statusTone(detail.status)}>{t.admin.apptStatus[detail.status]}</Badge>
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label={c.close} className="-mr-2 grid size-10 place-items-center rounded-xl text-ink-soft hover:bg-ink/[0.05] hover:text-ink">
          <X className="size-5" strokeWidth={1.75} />
        </button>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto px-7 py-5">
        <dl className="grid grid-cols-[130px_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-[15px]">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-ink-soft">{k}</dt>
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
                <span id="pos-same-day" className="mt-1 text-[13px] text-ink-soft">
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
                  status: detail.status,
                  customer: { id: detail.customer.id, name: detail.customer.name, phone: detail.customer.phone ?? "", email: detail.customer.email ?? null },
                  serviceId: detail.service.id,
                  staffId: detail.staffId,
                  date: ubDateKey(startsAt),
                  time: formatTime(startsAt),
                  roomId: detail.roomId,
                  extraMin: detail.extraMin,
                  source: detail.source as ApptDialogInit["source"],
                  note: detail.note,
                })
              }
            >
              {c.edit}
            </Button>
          )}
          {perms.canStatus && detail.status === "PENDING" && (
            <>
              <p className="w-full rounded-xl bg-warn-bg px-3 py-2 text-[13px] text-warn">{c.pendingOnline}</p>
              <Button disabled={status.pending} onClick={() => void run("approve")}>{c.actions.approve}</Button>
              <Button variant="danger" disabled={status.pending} onClick={() => setConfirm("reject")}>{c.actions.reject}</Button>
            </>
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

        {detail.notes.length > 0 && (
          <section className="rounded-xl border border-champagne/30 bg-champagne/[0.06] px-4 py-3">
            <h3 className="mb-1.5 text-[13px] font-medium text-champagne-ink">{t.admin.notes.recent}</h3>
            <ul className="space-y-1.5 text-[14px]">
              {detail.notes.map((n) => (
                <li key={n.id}>
                  <span className="text-ink-soft">{formatDateTime(new Date(n.createdAt))} · {n.author.name}: </span>
                  <span className="whitespace-pre-line">{n.body}</span>
                </li>
              ))}
            </ul>
            <Link href={`/admin/customers/${detail.customer.id}?tab=notes`} className="mt-2 inline-block text-[13px] underline underline-offset-4">
              {t.admin.notes.title} →
            </Link>
          </section>
        )}

        {/* "+ Нэмэлт цаг" — also after arrival: it only moves the end of the block */}
        {perms.canWrite && ["BOOKED", "CONFIRMED", "ARRIVED", "IN_PROGRESS"].includes(detail.status) && (
          <ExtraTimePicker
            value={detail.extraMin}
            disabled={extra.pending}
            onChange={(extraMin) => extra.run({ id, extraMin }, { onSuccess: () => (load(), router.refresh()) })}
          />
        )}

        {perms.canWrite && locked && detail.status !== "DONE" && <NoteEditor key={detail.note ?? ""} id={id} initial={detail.note ?? ""} onSaved={() => (load(), router.refresh())} />}

        {perms.canIssue && ["ARRIVED", "IN_PROGRESS", "DONE"].includes(detail.status) && <ServiceUseSuggestions appointmentId={id} reloadKey={reloadKey} />}

        {detail.history.length > 0 && (
          <section>
            <h3 className="mb-1.5 text-[13px] font-medium uppercase tracking-[0.4px] text-ink-soft">{c.history}</h3>
            <ol className="space-y-1 text-[13px] text-ink-soft">
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
        confirmDisabled={!cancelReady(cancel)}
        onClose={() => (setConfirm(null), setCancel(emptyCancel))}
        onConfirm={() => void run("cancel", cancel.note, cancel.category)}
      >
        <CancelReasonFields id="cancel" value={cancel} onChange={setCancel} />
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === "reject"}
        title={c.rejectTitle}
        confirmLabel={c.actions.reject}
        danger
        pending={status.pending}
        confirmDisabled={reason.trim().length < 3}
        onClose={() => (setConfirm(null), setReason(""))}
        onConfirm={() => void run("reject", reason)}
      >
        <p className="text-[13px] text-ink-soft">{c.rejectHint}</p>
        <Field label={c.reason} htmlFor="reject-reason">
          <Textarea id="reject-reason" className="min-h-16" value={reason} onChange={(e) => setReason(e.target.value)} />
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
        <p className="text-[13px] text-ink-soft">{c.completeHint}</p>
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
      <p className="text-[13px] text-ink-soft">{c.lockedHint}</p>
      <Field label={c.note} htmlFor="appt-note">
        <Textarea id="appt-note" className="min-h-16" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <Button size="sm" variant="secondary" disabled={save.pending || note === initial} onClick={() => save.run({ id, note: note || null }, { onSuccess: onSaved })}>
        {c.saveNote}
      </Button>
    </section>
  );
}
