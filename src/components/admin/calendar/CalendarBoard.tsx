"use client";

import { CalendarDays, Check, ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Avatar, Button, SegmentedTabs, Select, pastelFor } from "@/components/admin/ui";
import { t } from "@/i18n";
import { formatMNT } from "@/lib/money";
import { addDays, formatHm, formatTime, ubAt, ubDateKey, ubMinuteOfDay, ubWeekday } from "@/lib/time";
import { apptMove } from "@/server/actions/appointments";
import { AppointmentDialog, type ApptDialogInit } from "./AppointmentDialog";
import { AppointmentPanel } from "./AppointmentPanel";
import { FreeSlotSearch } from "./FreeSlotSearch";
import type { CalAppt, CalColumn, CalPerms, CalService } from "./types";

const c = t.admin.calendar;
/** 1 minute = 1.6px → a 30-minute row is 48px */
const PX_PER_MIN = 1.6;

type Props = {
  view: "day" | "week";
  /** Day view columns: staff (default) or rooms */
  by: "staff" | "room";
  date: string;
  weekStaffId: string | null;
  columns: CalColumn[];
  appointments: CalAppt[];
  axis: { startMin: number; endMin: number };
  slotMinutes: number;
  services: CalService[];
  staff: { id: string; name: string }[];
  perms: CalPerms;
  /** Cancelled appointments in the visible range (not drawn) */
  cancelled: number;
};

const within = (list: { start: string; end: string }[], from: number, to: number) =>
  list.some((i) => Date.parse(i.start) <= from && Date.parse(i.end) >= to);
const overlaps = (list: { start: string; end: string }[], from: number, to: number) =>
  list.some((i) => Date.parse(i.start) < to && Date.parse(i.end) > from);
const minutes = (list: { start: string; end: string }[]) => list.reduce((s, i) => s + (Date.parse(i.end) - Date.parse(i.start)) / 60_000, 0);
const apptMin = (a: CalAppt) => (Date.parse(a.endsAt) - Date.parse(a.startsAt)) / 60_000;
const counts = (a: CalAppt) => a.status !== "NO_SHOW";
const hoursLabel = (min: number) => {
  const h = Math.round((min / 60) * 2) / 2;
  return Number.isInteger(h) ? String(h) : h.toFixed(1);
};

/** "2026-11-23" → "23 / 11 / 2026" */
const bigDate = (key: string) => key.split("-").reverse().join(" / ");

export function CalendarBoard(p: Props) {
  const router = useRouter();
  const [dialog, setDialog] = useState<ApptDialogInit | null>(null);
  const [panelId, setPanelId] = useState<string | null>(null);
  const [freeOpen, setFreeOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const today = useMemo(() => (nowMs === null ? null : ubDateKey(new Date(nowMs))), [nowMs]);

  // Current-time line (client only, refreshed every minute)
  useEffect(() => {
    const tick = () => setNowMs(Date.now());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const go = useCallback(
    (next: { date?: string; view?: "day" | "week"; staff?: string | null; by?: "staff" | "room" }) => {
      const sp = new URLSearchParams();
      sp.set("date", next.date ?? p.date);
      const view = next.view ?? p.view;
      if (view === "week") {
        sp.set("view", "week");
        const staff = next.staff === undefined ? p.weekStaffId : next.staff;
        if (staff) sp.set("staff", staff);
      } else if ((next.by ?? p.by) === "room") sp.set("by", "room");
      router.push(`/admin/calendar?${sp.toString()}`);
    },
    [p.by, p.date, p.view, p.weekStaffId, router],
  );
  const step = p.view === "week" ? 7 : 1;

  // Keyboard: ← → change day/week, T today, N new appointment (not while typing / in a dialog)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable || document.querySelector("dialog[open]")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowLeft") go({ date: addDays(p.date, -step) });
      else if (e.key === "ArrowRight") go({ date: addDays(p.date, step) });
      else if (e.key.toLowerCase() === "t") go({ date: ubDateKey() });
      else if (e.key.toLowerCase() === "n" && p.perms.canWrite) setDialog({ date: p.date });
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, p.date, p.perms.canWrite, step]);

  const rows = useMemo(() => {
    const list: number[] = [];
    for (let m = p.axis.startMin; m < p.axis.endMin; m += p.slotMinutes) list.push(m);
    return list;
  }, [p.axis, p.slotMinutes]);
  const ROW = p.slotMinutes * PX_PER_MIN;
  const gridH = rows.length * ROW;
  const top = (iso: string) => (ubMinuteOfDay(new Date(iso)) - p.axis.startMin) * PX_PER_MIN;
  const height = (from: string, to: string) => ((Date.parse(to) - Date.parse(from)) / 60_000) * PX_PER_MIN;

  // ── Stats (from what is on screen) ──
  const stats = useMemo(() => {
    const working = p.columns.reduce((s, col) => s + minutes(col.working), 0);
    const booked = p.appointments.filter(counts).reduce((s, a) => s + apptMin(a), 0);
    const total = p.appointments.filter(counts).reduce((s, a) => s + a.price, 0);
    const paid = p.appointments.reduce((s, a) => s + a.paid, 0);
    return {
      bookings: p.appointments.length,
      staffOn: p.columns.filter((col) => col.working.length > 0).length,
      load: working > 0 ? Math.min(100, Math.round((booked / working) * 100)) : 0,
      free: Math.max(0, working - booked),
      total,
      paid,
      remaining: Math.max(0, total - paid),
    };
  }, [p.columns, p.appointments]);

  const byRoom = (col: CalColumn) => col.roomId !== undefined;
  const colAppts = (col: CalColumn) =>
    p.appointments.filter((a) => (byRoom(col) ? a.roomId === col.roomId : a.staffId === col.staffId) && ubDateKey(new Date(a.startsAt)) === col.date);

  const move = async (appt: CalAppt, col: CalColumn, minute: number) => {
    const startsAt = ubAt(col.date, formatHm(minute)).toISOString();
    // Room columns move the appointment to another room (same staff); staff columns to another staff member
    const staffId = byRoom(col) ? appt.staffId : col.staffId;
    const roomId = byRoom(col) ? (col.roomId ?? null) : appt.roomId;
    if (startsAt === appt.startsAt && staffId === appt.staffId && roomId === appt.roomId) return;
    const res = await apptMove({ id: appt.id, version: appt.version, startsAt, staffId, roomId });
    if (!res.ok) toast.error(`${c.moveFailed} ${res.error}`);
    else if (res.message) toast.success(res.message);
    router.refresh();
  };
  const drop = (col: CalColumn, m: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const a = p.appointments.find((x) => x.id === dragId);
    if (a) void move(a, col, m);
    setDragId(null);
  };

  const nowMin = nowMs !== null ? ubMinuteOfDay(new Date(nowMs)) : null;
  const nowTop = nowMin !== null ? (nowMin - p.axis.startMin) * PX_PER_MIN : null;
  const nowVisible = nowTop !== null && nowTop >= 0 && nowTop <= gridH && p.columns.some((col) => col.date === today);
  const isToday = p.date === today;

  return (
    <div className="flex min-h-[640px] flex-col lg:h-[calc(100dvh-9rem)]">
      {/* ── Header: today · ‹ › · big date · actions ── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <button
          type="button"
          onClick={() => go({ date: ubDateKey() })}
          className={`h-10 rounded-full border px-4 text-[14px] font-medium transition-colors ${isToday ? "border-navy bg-navy text-white" : "border-hairline bg-white text-ink hover:border-ink/25"}`}
        >
          {c.today}
        </button>
        <div className="flex items-center">
          <button type="button" className="grid size-10 place-items-center rounded-full text-ink-soft hover:bg-ink/[0.05] hover:text-ink" aria-label={p.view === "week" ? c.prevWeek : c.prevDay} onClick={() => go({ date: addDays(p.date, -step) })}>
            <ChevronLeft className="size-5" strokeWidth={1.75} />
          </button>
          <button type="button" className="grid size-10 place-items-center rounded-full text-ink-soft hover:bg-ink/[0.05] hover:text-ink" aria-label={p.view === "week" ? c.nextWeek : c.nextDay} onClick={() => go({ date: addDays(p.date, step) })}>
            <ChevronRight className="size-5" strokeWidth={1.75} />
          </button>
        </div>
        <p className="flex items-baseline gap-3" aria-live="polite">
          <span className="font-display text-[30px] font-semibold leading-none tabular-nums text-ink">{bigDate(p.date)}</span>
          <span className="font-display text-[24px] font-medium leading-none text-ink-faint">{t.time.weekdays[ubWeekday(p.date)]}</span>
        </p>
        <label className="relative grid size-10 cursor-pointer place-items-center rounded-full text-ink-soft hover:bg-ink/[0.05] hover:text-ink" title={c.pickDate}>
          <CalendarDays className="size-5" strokeWidth={1.75} aria-hidden />
          <input
            type="date"
            aria-label={c.pickDate}
            value={p.date}
            onChange={(e) => e.target.value && go({ date: e.target.value })}
            onClick={(e) => e.currentTarget.showPicker?.()}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setFreeOpen(true)}>
            <Search className="size-[18px]" strokeWidth={1.75} /> {c.findFree}
          </Button>
          {p.perms.canWrite && (
            <Button onClick={() => setDialog({ date: p.date })}>
              <Plus className="size-[18px]" strokeWidth={2} /> {c.newAppt}
            </Button>
          )}
        </div>
      </div>

      {/* ── Stats + view switch ── */}
      <div className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-3 border-b border-hairline pb-4">
        <dl className="flex flex-wrap items-baseline gap-x-7 gap-y-2 text-[15px]">
          {[
            [c.stats.bookings, stats.bookings],
            [p.by === "room" && p.view === "day" ? c.stats.rooms : c.stats.staffOn, stats.staffOn],
            [c.stats.load, `${stats.load}%`],
            [c.stats.free, c.stats.hours(hoursLabel(stats.free))],
            [c.stats.cancelled, p.cancelled],
          ].map(([k, v]) => (
            <div key={String(k)} className="flex items-baseline gap-2">
              <dt className="text-ink-soft">{k}</dt>
              <dd className="font-semibold tabular-nums text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {p.view === "day" && (
            <SegmentedTabs
              label={c.byLabel}
              value={p.by}
              onChange={(by) => go({ by })}
              items={[
                { value: "staff", label: c.byStaff },
                { value: "room", label: c.byRoom },
              ]}
            />
          )}
          {p.view === "week" && (
            <div className="w-56">
              <Select aria-label={c.staff} value={p.weekStaffId ?? ""} onChange={(e) => go({ staff: e.target.value })}>
                {p.staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <SegmentedTabs
            label={c.view}
            value={p.view}
            onChange={(v) => go({ view: v, staff: v === "week" ? (p.weekStaffId ?? p.staff[0]?.id ?? null) : null })}
            items={[
              { value: "day", label: c.dayView },
              { value: "week", label: c.weekView },
            ]}
          />
        </div>
      </div>

      {p.columns.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-hairline bg-white px-6 py-12 text-center text-[15px] text-ink-soft">{p.by === "room" ? c.noRooms : c.noStaff}</p>
      ) : (
        <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-hairline bg-white">
          <div className="min-h-0 flex-1 overflow-auto">
            <div className="grid" style={{ gridTemplateColumns: `68px repeat(${p.columns.length}, minmax(180px, 1fr))`, minWidth: 68 + p.columns.length * 180 }}>
              {/* Column headers */}
              <div className="sticky left-0 top-0 z-30 border-b border-hairline bg-white" />
              {p.columns.map((col) => {
                const list = colAppts(col).filter(counts);
                const sum = list.reduce((s, a) => s + a.price, 0);
                const highlight = p.view === "week" && col.date === today;
                return (
                  <div key={col.key} className={`sticky top-0 z-20 flex items-center justify-center gap-3 border-b border-l border-hairline px-3 py-3 ${highlight ? "bg-[#F6F1E9]" : "bg-white"}`}>
                    {p.view === "day" && !byRoom(col) && <Avatar name={col.label} id={col.staffId} size={36} />}
                    <div className="min-w-0 text-left">
                      <p className="truncate text-[15px] font-semibold text-ink">{col.label}</p>
                      <p className="truncate text-[13px] text-ink-soft tabular-nums">{c.staffHead(list.length, formatMNT(sum))}</p>
                    </div>
                  </div>
                );
              })}

              {/* Time axis */}
              <div className="sticky left-0 z-20 border-r border-hairline bg-white" style={{ height: gridH }}>
                <div className="relative h-full">
                  {rows.map((m, i) =>
                    m % 30 === 0 && !(nowVisible && Math.abs(i * ROW - nowTop!) < 14) ? (
                      <span
                        key={m}
                        className={`absolute right-2.5 font-mono text-[13px] tabular-nums ${m % 60 === 0 ? "text-ink-soft" : "text-ink-faint"} ${i === 0 ? "translate-y-1" : "-translate-y-1/2"}`}
                        style={{ top: i * ROW }}
                      >
                        {formatHm(m)}
                      </span>
                    ) : null,
                  )}
                  {nowVisible && nowMin !== null && (
                    <span className="absolute right-1.5 z-10 -translate-y-1/2 rounded-full bg-[#C0392B] px-1.5 py-0.5 font-mono text-[13px] font-medium text-white tabular-nums" style={{ top: nowTop! }}>
                      {formatHm(nowMin)}
                    </span>
                  )}
                </div>
              </div>

              {/* Columns */}
              {p.columns.map((col) => {
                const appts = colAppts(col);
                const showNow = nowVisible && col.date === today;
                return (
                  <div key={col.key} className="relative border-l border-hairline" style={{ height: gridH }}>
                    {rows.map((m) => {
                      const from = ubAt(col.date, formatHm(m)).getTime();
                      const to = from + p.slotMinutes * 60_000;
                      const off = !within(col.working, from, to) || overlaps(col.timeOff, from, to);
                      const line = m % 60 === 0 ? "border-t border-hairline" : m % 30 === 0 ? "border-t border-dashed border-hairline/70" : "";
                      const style = { top: (m - p.axis.startMin) * PX_PER_MIN, height: ROW };
                      if (off) {
                        return <div key={m} aria-hidden className={`absolute inset-x-0 bg-[#F4F3F0] ${line}`} style={style} onDragOver={(e) => e.preventDefault()} onDrop={drop(col, m)} />;
                      }
                      return (
                        <button
                          key={m}
                          type="button"
                          disabled={!p.perms.canWrite}
                          aria-label={c.emptyCell(col.label, formatHm(m))}
                          className={`absolute inset-x-0 ${line} transition-colors duration-100 hover:bg-[#F6F1E9] focus-visible:bg-[#F6F1E9] focus-visible:outline-none disabled:cursor-default disabled:hover:bg-transparent`}
                          style={style}
                          onClick={() =>
                            setDialog(byRoom(col) ? { date: col.date, time: formatHm(m), roomId: col.roomId ?? null } : { date: col.date, staffId: col.staffId, time: formatHm(m) })
                          }
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={drop(col, m)}
                        />
                      );
                    })}

                    {appts.map((a) => (
                      <ApptCard
                        key={a.id}
                        a={a}
                        byRoom={byRoom(col)}
                        top={top(a.startsAt)}
                        h={height(a.startsAt, a.endsAt)}
                        bufferH={height(a.endsAt, a.blockedUntil) - a.extraMin * PX_PER_MIN}
                        extraH={a.extraMin * PX_PER_MIN}
                        draggable={p.perms.canWrite && (a.status === "BOOKED" || a.status === "CONFIRMED")}
                        onOpen={() => setPanelId(a.id)}
                        onDragStart={() => setDragId(a.id)}
                        onDragEnd={() => setDragId(null)}
                      />
                    ))}

                    {showNow && (
                      <div aria-hidden className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-[#C0392B]" style={{ top: nowTop! }}>
                        <span className="absolute -left-[5px] -top-[6px] size-2.5 rounded-full bg-[#C0392B]" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sticky totals */}
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2 border-t border-hairline bg-canvas/70 px-5 py-3.5 text-[15px]">
            <p className="flex items-baseline gap-2">
              <span className="text-ink-soft">{p.view === "week" ? c.footer.week : c.footer.day}</span>
              <span className="text-[20px] font-semibold tabular-nums text-ink">{formatMNT(stats.total)}</span>
            </p>
            <p className="ml-auto flex cursor-help items-baseline gap-2" title={c.footer.paidHint}>
              <span className="text-ink-soft underline decoration-dotted decoration-ink-faint underline-offset-4">{c.footer.paid}</span>
              <span className="sr-only">({c.footer.paidHint})</span>
              <span className="font-semibold tabular-nums text-ok">{formatMNT(stats.paid)}</span>
            </p>
            <p className="flex items-baseline gap-2">
              <span className="text-ink-soft">{c.footer.remaining}</span>
              <span className={`font-semibold tabular-nums ${stats.remaining > 0 ? "text-err" : "text-ink"}`}>{formatMNT(stats.remaining)}</span>
            </p>
          </div>
        </div>
      )}
      <p className="mt-2 text-[13px] text-ink-faint">{c.shortcuts}</p>

      <AppointmentDialog
        open={dialog !== null}
        init={dialog}
        services={p.services}
        canCancel={p.perms.canStatus}
        onClose={() => setDialog(null)}
      />
      <FreeSlotSearch
        open={freeOpen}
        onClose={() => setFreeOpen(false)}
        services={p.services}
        staff={p.staff}
        onPick={(x) => {
          setFreeOpen(false);
          setDialog({ date: x.date, serviceId: x.serviceId, staffId: x.staffId, time: x.time });
        }}
      />
      {panelId && (
        <AppointmentPanel
          key={panelId}
          id={panelId}
          perms={p.perms}
          onClose={() => setPanelId(null)}
          onEdit={(init) => {
            setPanelId(null);
            setDialog(init);
          }}
        />
      )}
    </div>
  );
}

/** Pastel card in the staff member's colour; status shown with a small mark, not a colour change */
function ApptCard({ a, byRoom, top, h, bufferH, extraH = 0, draggable, onOpen, onDragStart, onDragEnd }: {
  a: CalAppt;
  /** In a room column the second line names the staff member instead of the room */
  byRoom?: boolean;
  top: number;
  h: number;
  bufferH: number;
  /** "+ Нэмэлт цаг" — drawn after the buffer in its own (champagne) stripes */
  extraH?: number;
  draggable: boolean;
  onOpen: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  // Онлайн, батлахыг хүлээж буй — шар тасархай хүрээ, "?" тэмдэг
  const pending = a.status === "PENDING";
  const color = pending ? { bg: "#FFF6E0", bar: "#B7791F" } : pastelFor(a.staffId);
  const short = h < 60;
  const done = a.status === "DONE";
  const noShow = a.status === "NO_SHOW";
  const mark =
    pending ? <span className="text-[12px] font-bold" aria-hidden>?</span> :
    a.status === "CONFIRMED" ? <Check className="size-3.5" strokeWidth={2.5} aria-hidden /> :
    a.status === "ARRIVED" ? <span className="size-2 rounded-full bg-ok" aria-hidden /> :
    a.status === "IN_PROGRESS" ? <span className="size-2 rounded-full bg-[#C08A2E]" aria-hidden /> : null;
  return (
    <div className={`absolute z-10 ${noShow ? "left-1.5 right-1/3" : "inset-x-1.5"}`} style={{ top: top + 2, height: h + bufferH + extraH - 4 }}>
      <button
        type="button"
        draggable={draggable}
        onDragStart={(e) => {
          onDragStart();
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragEnd={onDragEnd}
        onClick={onOpen}
        title={t.admin.apptStatus[a.status]}
        className={`relative flex w-full flex-col items-stretch justify-start overflow-hidden rounded-xl ${short ? "py-1" : "py-1.5"} pl-3 pr-2.5 text-left text-ink shadow-[0_1px_2px_rgba(28,34,48,0.06)] transition-[filter] duration-150 hover:brightness-[0.97] ${
          done ? "opacity-55" : ""
        } ${pending ? "border-2 border-dashed border-[#B7791F]/70" : ""} ${noShow ? "border border-dashed border-err/50 bg-[repeating-linear-gradient(135deg,transparent_0,transparent_6px,rgba(140,53,48,0.07)_6px,rgba(140,53,48,0.07)_12px)]" : ""} ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
        style={{ height: Math.max(h - 4, 22), background: noShow ? undefined : color.bg, boxShadow: `inset 3px 0 0 ${color.bar}` }}
      >
        <span className="flex items-center gap-1.5 font-mono text-[13px] leading-4 tabular-nums" style={{ color: color.bar }}>
          {formatTime(new Date(a.startsAt))}–{formatTime(new Date(a.endsAt))}
        </span>
        <span className={`block truncate text-[14px] font-semibold leading-5 ${a.status === "CANCELLED" ? "line-through" : ""}`}>{a.customer.name}</span>
        {!short && (
          <span className="block truncate text-[13px] leading-[18px] text-ink-soft">
            {a.service.name}
            {byRoom ? ` · ${a.staff.name}` : a.room ? ` · ${a.room.name}` : ""}
          </span>
        )}
        <span className="sr-only">, {t.admin.apptStatus[a.status]}</span>
        {mark && <span className="absolute right-2 top-2 grid place-items-center" style={{ color: color.bar }}>{mark}</span>}
        {!short && h >= 72 && a.price > 0 && (
          <span className="absolute bottom-1.5 right-2.5 text-[13px] font-medium tabular-nums text-ink">{formatMNT(a.price)}</span>
        )}
      </button>
      {bufferH > 0 && (
        <div
          aria-label={c.buffer}
          title={c.buffer}
          className="mx-1 rounded-b-lg bg-[repeating-linear-gradient(135deg,transparent_0,transparent_3px,rgba(28,34,48,0.07)_3px,rgba(28,34,48,0.07)_5px)]"
          style={{ height: Math.max(0, bufferH) }}
        />
      )}
      {extraH > 0 && (
        <div
          aria-label={c.extraLabel(a.extraMin)}
          title={c.extraLabel(a.extraMin)}
          className="mx-1 rounded-b-lg border border-t-0 border-dashed border-champagne/60 bg-[repeating-linear-gradient(135deg,transparent_0,transparent_4px,rgba(184,155,114,0.28)_4px,rgba(184,155,114,0.28)_7px)]"
          style={{ height: Math.max(0, extraH) }}
        />
      )}
    </div>
  );
}
