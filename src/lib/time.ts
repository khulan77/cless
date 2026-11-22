/**
 * Цагийн бүсийн ЦОРЫН ГАНЦ газар. DB-д UTC; бизнесийн өдөр, ажлын цаг, харуулах
 * бүх зүйл Asia/Ulaanbaatar (UTC+8, зуны цаггүй). Бусад газар offset давтахгүй.
 *
 * Нэр томьёо:
 *   dateKey — УБ-ийн огноо "YYYY-MM-DD"
 *   hm      — УБ-ийн цаг "HH:MM" ("24:00" = өдрийн төгсгөл)
 */
import { t } from "@/i18n";

export const UB_TIME_ZONE = "Asia/Ulaanbaatar";
const UB_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const HM = /^([01]\d|2[0-4]):([0-5]\d)$/;

/** УБ цагаар "YYYY-MM-DD" */
export function ubDateKey(at: Date = new Date()): string {
  return new Date(at.getTime() + UB_OFFSET_MS).toISOString().slice(0, 10);
}

export function isDateKey(v: string): boolean {
  return DATE_KEY.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
}

/** УБ-ийн огнооны 00:00-ийн UTC мөч */
export function ubDayStart(dateKey: string): Date {
  if (!isDateKey(dateKey)) throw new Error(`Буруу огноо: ${dateKey}`);
  return new Date(Date.parse(`${dateKey}T00:00:00Z`) - UB_OFFSET_MS);
}

/** УБ цагаар тухайн өдрийн [00:00, дараагийн 00:00) UTC-ээр */
export function ubDayRange(at: Date | string = new Date()): { start: Date; end: Date } {
  const start = ubDayStart(typeof at === "string" ? at : ubDateKey(at));
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

/** УБ-ийн гариг: 0 = Ням … 6 = Бямба */
export function ubWeekday(at: Date | string): number {
  const key = typeof at === "string" ? at : ubDateKey(at);
  return new Date(`${key}T00:00:00Z`).getUTCDay();
}

export function addDays(dateKey: string, days: number): string {
  return new Date(Date.parse(`${dateKey}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** "HH:MM" → өдрийн эхнээс хойших минут ("24:00" = 1440) */
export function parseHm(hm: string): number {
  const m = HM.exec(hm);
  if (!m) throw new Error(`Буруу цаг: ${hm}`);
  const minutes = Number(m[1]) * 60 + Number(m[2]);
  if (minutes > 24 * 60) throw new Error(`Буруу цаг: ${hm}`);
  return minutes;
}

export function isHm(v: string): boolean {
  try {
    parseHm(v);
    return true;
  } catch {
    return false;
  }
}

/** минут → "HH:MM" */
export function formatHm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** УБ-ийн огноо + "HH:MM" → UTC мөч */
export function ubAt(dateKey: string, hm: string): Date {
  return new Date(ubDayStart(dateKey).getTime() + parseHm(hm) * 60_000);
}

/** UTC мөч → УБ-ийн өдрийн эхнээс хойших минут */
export function ubMinuteOfDay(at: Date): number {
  return Math.floor(((at.getTime() + UB_OFFSET_MS) % DAY_MS) / 60_000);
}

/** "14:30" (24 цаг, УБ) */
export function formatTime(at: Date): string {
  return formatHm(ubMinuteOfDay(at));
}

/** "11/26 (Лхагва)" */
export function formatDateLabel(at: Date | string): string {
  const key = typeof at === "string" ? at : ubDateKey(at);
  return `${key.slice(5, 7)}/${key.slice(8, 10)} (${t.time.weekdays[ubWeekday(key)]})`;
}

/** "11/26 (Лхагва) 14:30–15:30" */
export function formatRange(startsAt: Date, endsAt: Date): string {
  return `${formatDateLabel(startsAt)} ${formatTime(startsAt)}–${formatTime(endsAt)}`;
}

/** Огноо + цаг, жагсаалт/лог-д: "2026-11-26 14:30" */
export function formatDateTime(at: Date): string {
  return `${ubDateKey(at)} ${formatTime(at)}`;
}

export function addMinutes(at: Date, minutes: number): Date {
  return new Date(at.getTime() + minutes * 60_000);
}
