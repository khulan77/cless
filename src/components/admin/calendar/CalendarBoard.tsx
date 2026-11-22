"use client";

import { ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button, Select, inputClass } from "@/components/admin/ui";
import { t } from "@/i18n";
import { addDays, formatHm, formatTime, ubAt, ubDateKey, ubMinuteOfDay } from "@/lib/time";
import { apptMove } from "@/server/actions/appointments";
import { AppointmentDialog, type ApptDialogInit } from "./AppointmentDialog";
import { AppointmentPanel } from "./AppointmentPanel";
import { FreeSlotSearch } from "./FreeSlotSearch";
import { cardClass } from "./status";
import type { CalAppt, CalColumn, CalPerms, CalService } from "./types";

const c = t.admin.calendar;
/** Height of one slot row in px */
const ROW = 22;

type Props = {
  view: "day" | "week";
  date: string;
  weekStaffId: string | null;
  columns: CalColumn[];
  appointments: CalAppt[];
  axis: { startMin: number; endMin: number };
  slotMinutes: number;
  services: CalService[];
  staff: { id: string; name: string }[];
  cancelReasons: string[];
  perms: CalPerms;
};

const within = (list: { start: string; end: string }[], from: number, to: number) =>
  list.some((i) => Date.parse(i.start) <= from && Date.parse(i.end) >= to);
const overlaps = (list: { start: string; end: string }[], from: number, to: number) =>
  list.some((i) => Date.parse(i.start) < to && Date.parse(i.end) > from);

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
    (next: { date?: string; view?: "day" | "week"; staff?: string | null }) => {
      const sp = new URLSearchParams();
      sp.set("date", next.date ?? p.date);
      const view = next.view ?? p.view;
      if (view === "week") {
        sp.set("view", "week");
        const staff = next.staff === undefined ? p.weekStaffId : next.staff;
        if (staff) sp.set("staff", staff);
      }
      router.push(`/admin/calendar?${sp.toString()}`);
    },
    [p.date, p.view, p.weekStaffId, router],
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
  const top = (iso: string) => ((ubMinuteOfDay(new Date(iso)) - p.axis.startMin) / p.slotMinutes) * ROW;
  const height = (from: string, to: string) => ((Date.parse(to) - Date.parse(from)) / 60_000 / p.slotMinutes) * ROW;

  const move = async (appt: CalAppt, col: CalColumn, minute: number) => {
    const startsAt = ubAt(col.date, formatHm(minute)).toISOString();
    if (startsAt === appt.startsAt && col.staffId === appt.staffId) return;
    const res = await apptMove({ id: appt.id, version: appt.version, startsAt, staffId: col.staffId, roomId: appt.roomId });
    if (!res.ok) toast.error(`${c.moveFailed} ${res.error}`);
    else if (res.message) toast.success(res.message);
    router.refresh();
  };

  return (
    <div>
      {/* ── Toolbar ── */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-md border border-line bg-white">
          <button type="button" className="px-2 py-2" aria-label={p.view === "week" ? c.prevWeek : c.prevDay} onClick={() => go({ date: addDays(p.date, -step) })}>
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" className="border-x border-line px-3 py-1.5 text-[13px]" onClick={() => go({ date: ubDateKey() })}>
            {c.today}
          </button>
          <button type="button" className="px-2 py-2" aria-label={p.view === "week" ? c.nextWeek : c.nextDay} onClick={() => go({ date: addDays(p.date, step) })}>
            <ChevronRight className="size-4" />
          </button>
        </div>
        <input type="date" aria-label={c.date} value={p.date} onChange={(e) => e.target.value && go({ date: e.target.value })} className={`${inputClass} w-40`} />
        <div role="tablist" aria-label={c.view} className="flex rounded-md bg-navy/[0.05] p-0.5">
          {(["day", "week"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={p.view === v}
              onClick={() => go({ view: v, staff: v === "week" ? (p.weekStaffId ?? p.staff[0]?.id ?? null) : null })}
              className={`h-8 rounded px-3 text-[13px] ${p.view === v ? "bg-white font-medium shadow-sm" : "text-navy/60"}`}
            >
              {v === "day" ? c.dayView : c.weekView}
            </button>
          ))}
        </div>
        {p.view === "week" && (
          <div className="w-52">
            <Select aria-label={c.staff} value={p.weekStaffId ?? ""} onChange={(e) => go({ staff: e.target.value })}>
              {p.staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" onClick={() => setFreeOpen(true)}>
            <Search className="size-4" /> {c.findFree}
          </Button>
          {p.perms.canWrite && (
            <Button onClick={() => setDialog({ date: p.date })}>
              <Plus className="size-4" /> {c.newAppt}
            </Button>
          )}
        </div>
      </div>
      <p className="-mt-2 mb-3 text-[12px] text-navy/45">{c.shortcuts}</p>

      {p.columns.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-6 py-10 text-center text-[14px] text-navy/60">{c.noStaff}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-white">
          <div className="grid min-w-[720px]" style={{ gridTemplateColumns: `56px repeat(${p.columns.length}, minmax(150px, 1fr))` }}>
            {/* Header */}
            <div className="sticky top-0 z-20 border-b border-line bg-white" />
            {p.columns.map((col) => (
              <div key={col.key} className={`sticky top-0 z-20 border-b border-l border-line bg-white px-2 py-2 text-center ${col.date === today && p.view === "week" ? "bg-navy/[0.04]" : ""}`}>
                <p className="truncate text-[13px] font-medium">{col.label}</p>
                {col.sublabel && <p className="text-[11px] text-navy/50">{col.sublabel}</p>}
              </div>
            ))}

            {/* Time axis */}
            <div className="relative" style={{ height: rows.length * ROW }}>
              {rows.map((m, i) =>
                m % 60 === 0 ? (
                  <span key={m} className={`absolute right-1.5 text-[11px] tabular-nums text-navy/45 ${i === 0 ? "translate-y-0.5" : "-translate-y-1/2"}`} style={{ top: i * ROW }}>
                    {formatHm(m)}
                  </span>
                ) : null,
              )}
            </div>

            {/* Columns */}
            {p.columns.map((col) => {
              const appts = p.appointments.filter((a) => a.staffId === col.staffId && ubDateKey(new Date(a.startsAt)) === col.date);
              const nowTop = nowMs !== null && col.date === today ? ((ubMinuteOfDay(new Date(nowMs)) - p.axis.startMin) / p.slotMinutes) * ROW : null;
              return (
                <div key={col.key} className="relative border-l border-line" style={{ height: rows.length * ROW }}>
                  {rows.map((m) => {
                    const from = ubAt(col.date, formatHm(m)).getTime();
                    const to = from + p.slotMinutes * 60_000;
                    const off = !within(col.working, from, to) || overlaps(col.timeOff, from, to);
                    const cls = `absolute inset-x-0 border-t ${m % 60 === 0 ? "border-line" : "border-line/40"}`;
                    const style = { top: ((m - p.axis.startMin) / p.slotMinutes) * ROW, height: ROW };
                    if (off) {
                      return (
                        <div
                          key={m}
                          aria-hidden
                          className={`${cls} bg-[repeating-linear-gradient(135deg,#f4f4f2_0,#f4f4f2_5px,#ebebe8_5px,#ebebe8_10px)]`}
                          style={style}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            const a = p.appointments.find((x) => x.id === dragId);
                            if (a) void move(a, col, m);
                            setDragId(null);
                          }}
                        />
                      );
                    }
                    return (
                      <button
                        key={m}
                        type="button"
                        disabled={!p.perms.canWrite}
                        aria-label={c.emptyCell(col.label, formatHm(m))}
                        className={`${cls} hover:bg-navy/[0.04] focus-visible:bg-navy/[0.06] focus-visible:outline-none disabled:cursor-default disabled:hover:bg-transparent`}
                        style={style}
                        onClick={() => setDialog({ date: col.date, staffId: col.staffId, time: formatHm(m) })}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const a = p.appointments.find((x) => x.id === dragId);
                          if (a) void move(a, col, m);
                          setDragId(null);
                        }}
                      />
                    );
                  })}

                  {appts.map((a) => {
                    const draggable = p.perms.canWrite && (a.status === "BOOKED" || a.status === "CONFIRMED");
                    const bufferH = height(a.endsAt, a.blockedUntil);
                    return (
                      <div
                        key={a.id}
                        className={`absolute z-10 ${a.status === "NO_SHOW" ? "left-1 right-1/3 opacity-80" : "inset-x-1"}`}
                        style={{ top: top(a.startsAt) + 1, height: height(a.startsAt, a.blockedUntil) - 2 }}
                      >
                        <button
                          type="button"
                          draggable={draggable}
                          onDragStart={(e) => {
                            setDragId(a.id);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onDragEnd={() => setDragId(null)}
                          onClick={() => setPanelId(a.id)}
                          className={`flex w-full flex-col items-stretch justify-start overflow-hidden rounded-md border px-1.5 py-0.5 text-left text-[12px] leading-tight shadow-sm ${cardClass[a.status]} ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
                          style={{ height: Math.max(height(a.startsAt, a.endsAt) - 2, 18) }}
                        >
                          <span className="block tabular-nums opacity-80">
                            {formatTime(new Date(a.startsAt))}–{formatTime(new Date(a.endsAt))}
                          </span>
                          <span className="block truncate font-medium">{a.customer.name}</span>
                          <span className="block truncate opacity-80">
                            {a.service.name}
                            {a.room ? ` · ${a.room.name}` : ""}
                          </span>
                        </button>
                        {bufferH > 0 && (
                          <div
                            aria-label={c.buffer}
                            title={c.buffer}
                            className="rounded-b-md bg-[repeating-linear-gradient(135deg,transparent_0,transparent_3px,rgba(15,23,42,0.12)_3px,rgba(15,23,42,0.12)_5px)]"
                            style={{ height: bufferH }}
                          />
                        )}
                      </div>
                    );
                  })}

                  {nowTop !== null && nowTop >= 0 && nowTop <= rows.length * ROW && (
                    <div aria-hidden className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-red-500" style={{ top: nowTop }}>
                      <span className="absolute -left-1 -top-[5px] size-2 rounded-full bg-red-500" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <AppointmentDialog open={dialog !== null} init={dialog} services={p.services} onClose={() => setDialog(null)} />
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
          cancelReasons={p.cancelReasons}
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
