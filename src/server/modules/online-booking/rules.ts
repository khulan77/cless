/** Онлайн захиалгын дүрэм — цэвэр функц (PROMPT 15 §4) */
export const MAX_FUTURE_BOOKINGS = 3;
export const NO_SHOW_LIMIT = 2;

export type WindowProblem = "TOO_SOON" | "TOO_FAR" | null;

export function bookingWindowProblem(startsAt: Date, now: Date, s: { minLeadHours: number; maxDaysAhead: number }): WindowProblem {
  if (startsAt.getTime() < now.getTime() + s.minLeadHours * 3_600_000) return "TOO_SOON";
  if (startsAt.getTime() > now.getTime() + s.maxDaysAhead * 86_400_000) return "TOO_FAR";
  return null;
}

/** Үйлчлүүлэгч өөрөө цуцлах эрх: эхлэхээс cancelHours-ийн өмнө хүртэл */
export function canCustomerCancel(startsAt: Date, now: Date, cancelHours: number): boolean {
  return startsAt.getTime() - now.getTime() >= cancelHours * 3_600_000;
}

export const tooManyFuture = (futureCount: number) => futureCount >= MAX_FUTURE_BOOKINGS;
export const blockedByNoShows = (noShowCount: number) => noShowCount >= NO_SHOW_LIMIT;

export const RULE_MESSAGES = {
  disabled: "Онлайн захиалга одоогоор хаалттай байна. Утсаар холбогдоно уу.",
  TOO_SOON: (h: number) => `Хамгийн багадаа ${h} цагийн өмнө захиална уу.`,
  TOO_FAR: (d: number) => `${d} хоногоос хойших цагийг одоогоор захиалах боломжгүй.`,
  tooMany: `Нэг дор хамгийн ихдээ ${MAX_FUTURE_BOOKINGS} ирээдүйн захиалга байна. Өмнөх цагаа өнгөрүүлсний дараа дахин захиална уу.`,
  blocked: "Өмнө нь товлосон цагтаа ирээгүй тул онлайн захиалга түр хаагдсан байна. Салонтой утсаар холбогдоно уу.",
  serviceNotAllowed: "Энэ үйлчилгээг онлайнаар захиалах боломжгүй. Утсаар холбогдоно уу.",
  firstVisit: (name: string) => `Анх удаа ирж байгаа бол эхлээд «${name}» оношлогоог захиална уу.`,
  cancelLate: (h: number) => `Цаг эхлэхээс ${h} цагийн өмнө хүртэл л цуцална. Салонтой утсаар холбогдоно уу.`,
  notFound: "Цаг олдсонгүй.",
  slotTaken: "Энэ цаг дөнгөж сая өөр захиалгаар дүүрлээ. Өөр цаг сонгоно уу.",
};
