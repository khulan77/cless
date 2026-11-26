/**
 * Ирлээ/Явлаа үйл явдлаас ажлын сесс, цаг (PROMPT 19) — цэвэр тооцоо.
 * CHECK_IN → дараагийн CHECK_OUT хүртэл нэг сесс. Давхар CHECK_IN (явлаа дараагүй) — өмнөхийг үл тоож шинээр эхэлнэ.
 * Өдрийн цаг = сессүүдийн нийлбэр, 0.25 цагаар бөөрөнхийлнө.
 */
export type Ev = { type: "CHECK_IN" | "CHECK_OUT"; at: Date };
export type Session = { in: Date; out: Date | null };

export function sessionsOf(events: Ev[]): Session[] {
  const sorted = [...events].sort((a, b) => a.at.getTime() - b.at.getTime());
  const out: Session[] = [];
  let open: Session | null = null;
  for (const e of sorted) {
    if (e.type === "CHECK_IN") {
      if (open) out.push(open); // явлаа дараагүй — нээлттэй хэвээр (out: null)
      open = { in: e.at, out: null };
    } else if (open) {
      open.out = e.at;
      out.push(open);
      open = null;
    }
  }
  if (open) out.push(open);
  return out;
}

/** Дууссан сессүүдийн минут (нээлттэйг `now` хүртэл тоолох бол now өгнө) */
export function workedMinutes(sessions: Session[], now?: Date): number {
  return sessions.reduce((s, x) => {
    const end = x.out ?? now;
    return end ? s + Math.max(0, (end.getTime() - x.in.getTime()) / 60_000) : s;
  }, 0);
}

export const roundQuarter = (hours: number) => Math.round(hours * 4) / 4;

/** WorkDay.hours — зөвхөн дууссан сессүүд, 0.25 цагаар */
export const hoursOfDay = (events: Ev[]) => roundQuarter(workedMinutes(sessionsOf(events)) / 60);
