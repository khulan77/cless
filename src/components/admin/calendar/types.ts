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
};

/** One calendar column: a staff member on a date (day view) or a date for one staff member (week view) */
export type CalColumn = {
  key: string;
  label: string;
  sublabel?: string;
  date: string;
  staffId: string;
  working: { start: string; end: string }[];
  timeOff: { start: string; end: string; reason: string }[];
};

export type CalPerms = { canWrite: boolean; canStatus: boolean; canDoneManual: boolean; canPos: boolean };
