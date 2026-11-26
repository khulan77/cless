/**
 * Нэг "tick" (PROMPT 22) — worker-ийн бүх loop-ийн нэг давталт. Vercel дээр worker байхгүй тул гаднаас
 * минут тутам (Supabase pg_cron + pg_net, cron-job.org) POST /api/cron/tick дуудна.
 *  - Давхар ажиллахаас: transaction түвшний pg_try_advisory_xact_lock — авч чадаагүй бол алгасна.
 *    VPS-ийн worker-тэй зөрчилдөхгүй (outbox нь FOR UPDATE SKIP LOCKED).
 *  - Дараалал: хуучирсан мэдэгдлийг алгасах → outbox (25 ажил / 8 сек) → QPay шалгах → удаан түгжээ тайлах →
 *    (10 мин тутам) хуучин ноорог устгах → ирцийн AUTO_CLOSE → heartbeat (health, самбар).
 */
import { db } from "@/server/db";
import { autoCloseOpenSessions } from "@/server/modules/attendance/service";
import { requestStorefrontRevalidate } from "@/server/modules/cache/storefront";
import { beat } from "@/server/modules/outbox/heartbeat";
import { processOutbox } from "@/server/modules/outbox/worker";
import { pollProcessingQPayPayments } from "@/server/modules/payments/service";
import { purgeStaleDrafts } from "@/server/modules/sales/drafts";
import { unlockStaleSales } from "@/server/modules/sales/service";
import { getPosSettings } from "@/server/modules/settings/pos-settings";
import { skipStaleNotifications } from "./stale";

export const LOCK_KEY = 72_270_221; // "cless-tick"

export type TickResult =
  | { skipped: true; reason: "locked" }
  | { skipped: false; staleSkipped: number; outbox: number; qpayPaid: number; unlocked: number; drafts: number | null; attendanceClosed: number; ms: number };

/** Алхам бүрийн алдааг тусгаарлана — нэг нь унасан ч бусад нь ажиллана */
async function step<T>(name: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.error("[tick]", { step: name, message: e instanceof Error ? e.message : String(e) });
    return fallback;
  }
}

export async function runTick(now = new Date()): Promise<TickResult> {
  const started = Date.now();
  return db.$transaction(
    async (tx) => {
      const [{ ok }] = await tx.$queryRaw<{ ok: boolean }[]>`SELECT pg_try_advisory_xact_lock(${LOCK_KEY}) AS ok`;
      if (!ok) return { skipped: true as const, reason: "locked" as const };
      // Lock-ийг энэ transaction барьж байх хугацаанд ажлыг үндсэн холболтуудаар гүйцэтгэнэ
      const staleSkipped = await step("stale", () => skipStaleNotifications(now), 0);
      const outbox = await step("outbox", () => processOutbox({ maxJobs: 25, budgetMs: 8000 }), 0);
      const qpay = await step("qpay", () => pollProcessingQPayPayments(), { paid: 0 } as { paid: number });
      if (qpay.paid > 0) await step("revalidate", () => requestStorefrontRevalidate("qpay-paid"), undefined);
      const unlocked = await step("stale-sales", async () => unlockStaleSales((await getPosSettings()).staleLockMinutes), [] as string[]);
      if (unlocked.length > 0) await step("revalidate", () => requestStorefrontRevalidate("stale-unlock"), undefined);
      const drafts = now.getUTCMinutes() % 10 === 0 ? await step("drafts", () => purgeStaleDrafts(24), 0) : null;
      const attendanceClosed = await step("attendance", () => autoCloseOpenSessions(now), 0);
      const ms = Date.now() - started;
      await step("heartbeat", () => beat({ source: "cron", outbox, ms }), undefined);
      return { skipped: false as const, staleSkipped, outbox, qpayPaid: qpay.paid, unlocked: unlocked.length, drafts: typeof drafts === "number" ? drafts : null, attendanceClosed, ms };
    },
    { maxWait: 5_000, timeout: 55_000 },
  );
}
