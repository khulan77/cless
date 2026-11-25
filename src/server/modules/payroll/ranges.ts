import { monthDays } from "./calc";

/** Сарын хагас: 1 = 1–splitDay, 2 = splitDay+1–сарын сүүл */
export function halfRange(month: string, half: 1 | 2, splitDay: number) {
  const d = monthDays(month);
  return half === 1 ? { from: d[0]!, to: d[splitDay - 1]! } : { from: d[splitDay]!, to: d.at(-1)! };
}

export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const dt = new Date(Date.UTC(y, m - 1 + delta, 1));
  return dt.toISOString().slice(0, 7);
}
