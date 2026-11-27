/**
 * Хуваарь vs бодит ирц (PROMPT 27 §5) — цэвэр тооцоо.
 *  - Хуваарьтай өдөр «Ирлээ» дараагүй (чөлөөгүй) → «Тасалсан» (өнгөрсөн өдөр, эсвэл өнөөдөр хуваарь дууссан).
 *  - Хоцролт = эхний «Ирлээ» − хуваарийн эхлэх цаг (минут, 0-ээс бага бол 0).
 *  - Чөлөө / амралттай өдөр — «Чөлөөтэй», тасалсанд тооцохгүй.
 */
export type DayState = "ON_TIME" | "LATE" | "ABSENT" | "LEAVE" | "NOT_YET" | "OFF" | "EXTRA";

export type DayEval = { state: DayState; lateMin: number };

export function evaluateDay(p: {
  /** Хуваарийн эхлэх / дуусах (UTC Date) — хуваарьгүй бол null */
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  firstIn: Date | null;
  onLeave: boolean;
  now: Date;
}): DayEval {
  const { scheduledStart, scheduledEnd, firstIn, onLeave, now } = p;
  if (!scheduledStart || !scheduledEnd) return { state: firstIn ? "EXTRA" : "OFF", lateMin: 0 };
  if (onLeave && !firstIn) return { state: "LEAVE", lateMin: 0 };
  if (!firstIn) return { state: now >= scheduledEnd ? "ABSENT" : "NOT_YET", lateMin: 0 };
  const lateMin = Math.max(0, Math.floor((firstIn.getTime() - scheduledStart.getTime()) / 60_000));
  return { state: lateMin > 0 ? "LATE" : "ON_TIME", lateMin };
}

export const DAY_STATE_LABEL: Record<DayState, string> = {
  ON_TIME: "Цагтаа",
  LATE: "Хоцорсон",
  ABSENT: "Тасалсан",
  LEAVE: "Чөлөөтэй",
  NOT_YET: "Ирээгүй байна",
  OFF: "Амралт",
  EXTRA: "Хуваарьгүй ирсэн",
};
