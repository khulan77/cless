/** Serializable calendar data passed from the server page to client components (dates as ISO strings) */
import type { ApptStatus } from "@/generated/prisma/enums";

export type CalService = {
  id: string;
  name: string;
  durationMin: number;
  bufferMin: number;
  requiresRoom: boolean;
  price: number;
  priceFrom: boolean;
  category: string | null;
};

export type CalAppt = {
  id: string;
  staffId: string;
  roomId: string | null;
  startsAt: string;
  endsAt: string;
  blockedUntil: string;
  /** "+ Нэмэлт цаг" (minutes) — the last part of [endsAt, blockedUntil) */
  extraMin: number;
  status: ApptStatus;
  source: string;
  note: string | null;
  version: number;
  /** Price at booking time and amount paid through POS (read-only stats) */
  price: number;
  paid: number;
  customer: { id: string; name: string; phone?: string; email?: string | null };
  service: { id: string; name: string; durationMin: number; bufferMin: number };
  room: { id: string; name: string } | null;
  staff: { name: string };
};

/**
 * One calendar column: a staff member on a date (day view), a date for one staff member (week view),
 * or a room on a date (day view "by room" — `roomId` set; null = appointments without a room)
 */
export type CalColumn = {
  key: string;
  label: string;
  sublabel?: string;
  date: string;
  staffId: string;
  roomId?: string | null;
  working: { start: string; end: string }[];
  timeOff: { start: string; end: string; reason: string }[];
};

export type CalPerms = { canWrite: boolean; canStatus: boolean; canDoneManual: boolean; canPos: boolean; canInvite?: boolean; canSchedule?: boolean };
