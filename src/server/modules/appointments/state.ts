/**
 * Цагийн төлөвийн машин. Шилжилт бүр энэ функцээр — хориотойг алдаа болгоно.
 *
 *   BOOKED ─confirm─► CONFIRMED ─arrive─► ARRIVED ─start─► IN_PROGRESS ─complete─► DONE
 *     └──────────────arrive───────────────┘
 *   BOOKED/CONFIRMED ─cancel (шалтгаан)─► CANCELLED
 *   BOOKED/CONFIRMED ─noShow (эхлэх цагаас хойш)─► NO_SHOW
 *   complete (гараар): ADMIN, зөвхөн ARRIVED/IN_PROGRESS, эхлэх цагаас хойш, шалтгаантай.
 *     Sale PAID → DONE нь complete.ts-д (BOOKED/CONFIRMED-ээс ч) — энэ машинаар ороогүй.
 *   ARRIVED/IN_PROGRESS → CANCELLED хориотой (POS-оор шийднэ)
 */
import type { ApptStatus } from "@/generated/prisma/enums";

export type ApptAction = "confirm" | "arrive" | "start" | "complete" | "cancel" | "noShow";

export class ApptStateError extends Error {
  constructor(
    public from: ApptStatus,
    public action: ApptAction,
    message: string,
  ) {
    super(message);
    this.name = "ApptStateError";
  }
}

const TRANSITIONS: Record<ApptAction, { from: readonly ApptStatus[]; to: ApptStatus; message: string }> = {
  confirm: { from: ["BOOKED"], to: "CONFIRMED", message: "Зөвхөн шинэ цагийг баталгаажуулна." },
  arrive: { from: ["BOOKED", "CONFIRMED"], to: "ARRIVED", message: "Энэ цагийг 'Ирсэн' болгох боломжгүй." },
  start: { from: ["ARRIVED"], to: "IN_PROGRESS", message: "Эхлээд 'Ирсэн' болгоно уу." },
  complete: { from: ["ARRIVED", "IN_PROGRESS"], to: "DONE", message: "Зөвхөн ирсэн эсвэл үйлчилгээнд байгаа цагийг гараар дуусгана." },
  cancel: {
    from: ["BOOKED", "CONFIRMED"],
    to: "CANCELLED",
    message: "Ирсэн эсвэл эхэлсэн цагийг цуцлах боломжгүй — POS-оор шийднэ үү.",
  },
  noShow: { from: ["BOOKED", "CONFIRMED"], to: "NO_SHOW", message: "Энэ цагийг 'Ирээгүй' болгох боломжгүй." },
};

/** Идэвхтэй (давхцлын constraint-д тооцогдох) төлөвүүд */
export const ACTIVE_STATUSES: readonly ApptStatus[] = ["BOOKED", "CONFIRMED", "ARRIVED", "IN_PROGRESS", "DONE"];

/** Цаг/ажилтан/үйлчилгээг засах, зөөх боломжтой эсэх */
export function isEditable(status: ApptStatus): boolean {
  return status === "BOOKED" || status === "CONFIRMED";
}

export function canApply(from: ApptStatus, action: ApptAction): boolean {
  return TRANSITIONS[action].from.includes(from);
}

export function nextApptStatus(
  from: ApptStatus,
  action: ApptAction,
  ctx: { now?: Date; startsAt?: Date; reason?: string | null } = {},
): ApptStatus {
  const rule = TRANSITIONS[action];
  if (!rule.from.includes(from)) throw new ApptStateError(from, action, rule.message);
  if (action === "cancel" && !ctx.reason?.trim()) throw new ApptStateError(from, action, "Цуцлах шалтгааныг сонгоно уу.");
  if (action === "noShow" || action === "complete") {
    if (!ctx.now || !ctx.startsAt) throw new ApptStateError(from, action, "Цаг шаардлагатай.");
    if (ctx.now < ctx.startsAt) {
      throw new ApptStateError(from, action, action === "noShow" ? "Цаг эхлээгүй байхад 'Ирээгүй' болгох боломжгүй." : "Цаг эхлээгүй байхад дуусгах боломжгүй.");
    }
  }
  if (action === "complete" && !ctx.reason?.trim()) throw new ApptStateError(from, action, "Гараар дуусгах шалтгааныг бичнэ үү.");
  return rule.to;
}

/** UI: тухайн төлөвөөс хийж болох үйлдлүүд */
export function availableActions(from: ApptStatus): ApptAction[] {
  return (Object.keys(TRANSITIONS) as ApptAction[]).filter((a) => a !== "complete" && canApply(from, a));
}
