/**
 * Салбарын ажлын цаг (booking settings: weekday → интервалууд) → сайтад харуулах мөрүүд.
 * Ижил цагтай дараалсан өдрүүдийг нэгтгэнэ: "Даваа–Бямба 10:00–20:00", "Ням амарна".
 * Цэвэр функц (footer, салоны хуудас, sheet, имэйл, JSON-LD хамтдаа ашиглана).
 */
import { t } from "@/i18n";
import { addDays, parseHm, ubDateKey, ubMinuteOfDay, ubWeekday } from "@/lib/time";

export type WeekHours = Partial<Record<"0" | "1" | "2" | "3" | "4" | "5" | "6", { start: string; end: string }[]>>;

/** Даваа эхэлсэн дараалал */
const ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

const key = (list: { start: string; end: string }[] | undefined) =>
  (list ?? []).map((i) => `${i.start}–${i.end}`).join(", ");

export function hoursToLines(hours: WeekHours): string[] {
  const groups: { from: number; to: number; value: string }[] = [];
  for (const d of ORDER) {
    const value = key(hours[String(d) as "0"]);
    const last = groups[groups.length - 1];
    if (last && last.value === value) last.to = d;
    else groups.push({ from: d, to: d, value });
  }
  const name = (d: number) => t.time.weekdays[d]!;
  return groups.map((g) => {
    const days = g.from === g.to ? name(g.from) : `${name(g.from)}–${name(g.to)}`;
    return g.value ? `${days} ${g.value}` : `${days} ${t.salon.closed}`;
  });
}

/** schema.org openingHoursSpecification (JSON-LD) */
export function openingHoursSpec(hours: WeekHours) {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return Object.entries(hours).flatMap(([d, list]) =>
    (list ?? []).map((i) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: days[Number(d)], opens: i.start, closes: i.end === "24:00" ? "23:59" : i.end })),
  );
}

/**
 * When can the salon call back? "open" — now within hours (reply within 1 hour);
 * otherwise the next day it opens (0 = later today, 1 = tomorrow, …) and its weekday.
 * An open slot with less than 30 minutes left counts as closed.
 */
export type ContactWindow = { kind: "open" } | { kind: "later"; daysAhead: number; weekday: number };

export function contactWindow(hours: WeekHours, now: Date): ContactWindow {
  const today = ubDateKey(now);
  const minute = ubMinuteOfDay(now);
  const list = (dateKey: string) => hours[String(ubWeekday(dateKey)) as "0"] ?? [];
  if (list(today).some((i) => minute >= parseHm(i.start) && minute <= parseHm(i.end) - 30)) return { kind: "open" };
  if (list(today).some((i) => parseHm(i.start) > minute)) return { kind: "later", daysAhead: 0, weekday: ubWeekday(today) };
  for (let d = 1; d <= 7; d++) {
    const key = addDays(today, d);
    if (list(key).length > 0) return { kind: "later", daysAhead: d, weekday: ubWeekday(key) };
  }
  return { kind: "later", daysAhead: 1, weekday: ubWeekday(addDays(today, 1)) };
}

/** Success message shown after an inquiry */
export function inquiryReply(w: ContactWindow): string {
  if (w.kind === "open") return t.inquiry.doneOpen;
  const day = w.daysAhead === 0 ? t.inquiry.today : w.daysAhead === 1 ? t.inquiry.tomorrow : t.inquiry.onWeekday(t.time.weekdays[w.weekday]!);
  return t.inquiry.doneClosed(day);
}
