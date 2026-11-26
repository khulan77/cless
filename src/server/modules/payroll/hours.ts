/**
 * Ажилласан цаг (PROMPT 18 §3) — цэвэр тооцоо. Норм: 7 хоногт 40 цаг (өдөрт 8).
 *  - Өдрийн цаг: менежерийн оруулсан WorkDay.hours, эс бөгөөс төлвөөр (ажилласан 8, хагас өдөр 4, бусад 0).
 *  - 7 хоног: Даваа–Ням (жилийн заагаар гарсан 7 хоног нэг бүлэг — Даваа гарагийн огноогоор).
 *  - Илүү цаг = 7 хоног бүрийн (тухайн үеийн өдрүүдээр) 40-өөс давсан цагийн нийлбэр.
 *  - Нормын цаг = үеийн төлөвлөсөн ажлын өдөр × 8.
 * TODO(нягтлан): илүү цагийн хөлс (1.5× г.м.) — одоохондоо ЗӨВХӨН харуулна, цалинд оруулахгүй.
 */
import { weekdayOf, type WorkStatus } from "./calc";

export const WEEKLY_NORM = 40;
export const DAILY_NORM = 8;

export const DEFAULT_HOURS: Record<WorkStatus, number> = { WORKED: 8, HALF_DAY: 4, PAID_LEAVE: 0, UNPAID_LEAVE: 0, SICK: 0, ABSENT: 0, OFF: 0 };

export const hoursOf = (status: WorkStatus, hours: number | null | undefined) => (hours ?? DEFAULT_HOURS[status]);

const addDaysUtc = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** 7 хоногийн түлхүүр — тухайн 7 хоногийн Даваа гараг (weekdayOf: 0 = Ням … 6 = Бямба) */
export function weekKey(day: string): string {
  const wd = weekdayOf(day);
  return addDaysUtc(day, wd === 0 ? -6 : 1 - wd);
}

export type DayHours = { date: string; hours: number };
export type WeekHours = { week: string; from: string; to: string; hours: number; overtime: number };

export function weeklyHours(days: DayHours[]): WeekHours[] {
  const m = new Map<string, WeekHours>();
  for (const d of [...days].sort((a, b) => a.date.localeCompare(b.date))) {
    const k = weekKey(d.date);
    const w = m.get(k) ?? { week: k, from: d.date, to: d.date, hours: 0, overtime: 0 };
    w.to = d.date;
    w.hours += d.hours;
    m.set(k, w);
  }
  return [...m.values()].map((w) => ({ ...w, hours: round1(w.hours), overtime: round1(Math.max(0, w.hours - WEEKLY_NORM)) }));
}

export function periodHours(days: (DayHours & { planned: boolean })[]) {
  const weeks = weeklyHours(days);
  return {
    worked: round1(days.reduce((s, d) => s + d.hours, 0)),
    norm: days.filter((d) => d.planned).length * DAILY_NORM,
    overtime: round1(weeks.reduce((s, w) => s + w.overtime, 0)),
    weeks,
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
