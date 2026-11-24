/** Цаг захиалгын оролтын schema (цэвэр) */
import { z } from "zod";
import { isDateKey, isHm } from "@/lib/time";
import { EXTRA_MINUTES } from "./extra-minutes";

const id = z.string().min(1).max(64);
const dateKey = z.string().refine(isDateKey, "Огноо буруу байна.");
const instant = z.coerce.date({ error: "Цагаа сонгоно уу." });

export const APPT_SOURCES = ["PHONE", "INSTAGRAM", "FACEBOOK", "WALK_IN", "OTHER"] as const;

export { EXTRA_MINUTES };
const extraMin = z
  .number()
  .int()
  .refine((n) => (EXTRA_MINUTES as readonly number[]).includes(n), "Нэмэлт цаг 0, 10, 15 эсвэл 30 минут.");

export const apptInputSchema = z.object({
  customerId: id,
  serviceId: id,
  staffId: id,
  roomId: id.nullish(),
  startsAt: instant,
  extraMin: extraMin.default(0),
  source: z.enum(APPT_SOURCES).default("PHONE"),
  note: z.string().trim().max(1000).nullish(),
});
export type ApptInput = z.input<typeof apptInputSchema>;

export const apptUpdateSchema = apptInputSchema.extend({
  id,
  /** Not sent → the appointment keeps its current extra time */
  extraMin: extraMin.optional(),
  /** Optimistic lock — өөр хүн зэрэг засвал татгалзана */
  version: z.number().int().min(0),
});
export type ApptUpdateInput = z.input<typeof apptUpdateSchema>;

/** Календарь дээр чирж зөөх */
export const apptMoveSchema = z.object({ id, version: z.number().int().min(0), startsAt: instant, staffId: id, roomId: id.nullish() });
export type ApptMoveInput = z.input<typeof apptMoveSchema>;

export const apptStatusSchema = z.object({
  id,
  action: z.enum(["confirm", "arrive", "start", "complete", "cancel", "noShow"]),
  reason: z.string().trim().max(300).nullish(),
});
export type ApptStatusInput = z.input<typeof apptStatusSchema>;

export const slotQuerySchema = z.object({
  serviceId: id,
  date: dateKey,
  staffId: id.nullish(),
  roomId: id.nullish(),
  /** Засварлаж буй цагийг завгүйд тооцохгүй */
  excludeId: id.nullish(),
  /** Нэмэлт цагийг багтаах сул цаг */
  extraMin: extraMin.default(0),
});

/** Календарийн дэлгэрэнгүйгээс нэмэлт цаг солих */
export const apptExtraSchema = z.object({ id, extraMin });
export type ApptExtraInput = z.input<typeof apptExtraSchema>;
export type SlotQuery = z.input<typeof slotQuerySchema>;

export const freeSearchSchema = z.object({
  serviceId: id,
  staffId: id.nullish(),
  from: dateKey,
  days: z.number().int().min(1).max(14).default(7),
});

const hm = z.string().refine(isHm, "Цаг ЦЦ:ММ хэлбэртэй.");
export const scheduleSchema = z.object({
  staffId: id,
  intervals: z
    .array(z.object({ weekday: z.number().int().min(0).max(6), startTime: hm, endTime: hm }))
    .max(50)
    .superRefine((list, ctx) => {
      list.forEach((i, n) => {
        if (i.startTime >= i.endTime) ctx.addIssue({ code: "custom", path: [n, "endTime"], message: "Дуусах цаг эхлэхээс хойш байх ёстой." });
      });
      for (let a = 0; a < list.length; a++)
        for (let b = a + 1; b < list.length; b++) {
          const x = list[a]!;
          const y = list[b]!;
          if (x.weekday === y.weekday && x.startTime < y.endTime && y.startTime < x.endTime) {
            ctx.addIssue({ code: "custom", path: [b, "startTime"], message: "Нэг өдрийн интервалууд давхцаж байна." });
          }
        }
    }),
});

export const timeOffSchema = z
  .object({
    staffId: id,
    from: dateKey,
    to: dateKey,
    /** Хоосон бол бүтэн өдөр */
    fromTime: hm.nullish(),
    toTime: hm.nullish(),
    reason: z.enum(["VACATION", "SICK", "TRAINING", "OTHER"]),
    note: z.string().trim().max(500).nullish(),
  })
  .refine((v) => v.from <= v.to, { path: ["to"], message: "Дуусах огноо эхлэхээс өмнө байна." });

export const roomSchema = z.object({
  id: id.nullish(),
  name: z.string().trim().min(1, "Нэр оруулна уу.").max(80),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

export const bookingHoursSchema = z.object({
  hours: z.partialRecord(z.enum(["0", "1", "2", "3", "4", "5", "6"]), z.array(z.object({ start: hm, end: hm })).max(6)),
  slotMinutes: z.number().int(),
  minLeadMinutes: z.number().int().min(0).max(1440),
});
