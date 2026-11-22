/**
 * Бизнесийн өдөр, тайлан, кассын ээлж — Asia/Ulaanbaatar (UTC+8, зуны цаггүй).
 * DB-д UTC хадгална.
 */
const UB_OFFSET_MS = 8 * 60 * 60 * 1000;

/** УБ цагаар "YYYY-MM-DD" */
export function ubDateKey(at: Date = new Date()): string {
  return new Date(at.getTime() + UB_OFFSET_MS).toISOString().slice(0, 10);
}

/** УБ цагаар тухайн өдрийн 00:00-ийн UTC мөч ба дараагийн өдрийнх */
export function ubDayRange(at: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(`${ubDateKey(at)}T00:00:00+08:00`);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}
