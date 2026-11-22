/**
 * Background worker: `bun run worker`
 * Vercel serverless дээр ажиллахгүй — тусдаа урт хугацааны процесс (VPS, Railway, Fly г.м.) хэрэгтэй.
 *  - Outbox (имэйл, QPay invoice цуцлах): 5 секунд тутам
 *  - QPay PROCESSING төлбөр шалгах: 1 минут тутам (callback алдагдсан ч гацахгүй)
 *  - Удаан түгжигдсэн борлуулалтыг тайлах: 1 минут тутам (тохиргоо: pos.staleLockMinutes)
 *  - 24 цагаас хуучирсан POS ноорог устгах: 10 минут тутам
 *  - Heartbeat (хянах самбар): 30 секунд тутам
 */
import { beat } from "@/server/modules/outbox/heartbeat";
import { processOutbox } from "@/server/modules/outbox/worker";
import { purgeStaleDrafts } from "@/server/modules/sales/drafts";
import { pollProcessingQPayPayments } from "@/server/modules/payments/service";
import { unlockStaleSales } from "@/server/modules/sales/service";
import { getPosSettings } from "@/server/modules/settings/pos-settings";

const OUTBOX_MS = 5_000;
const MINUTE_MS = 60_000;

let stopping = false;
const log = (msg: string, extra?: unknown) => console.log(`[worker ${new Date().toISOString()}] ${msg}`, extra ?? "");

async function loop(name: string, everyMs: number, fn: () => Promise<unknown>) {
  while (!stopping) {
    try {
      const r = await fn();
      if (typeof r === "number" && r > 0) log(`${name}: ${r}`);
      if (Array.isArray(r) && r.length > 0) log(`${name}: ${r.length}`);
    } catch (e) {
      log(`${name} алдаа`, e instanceof Error ? e.message : e);
    }
    await new Promise((res) => setTimeout(res, everyMs));
  }
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    log(`${sig} — зогсож байна`);
    stopping = true;
    setTimeout(() => process.exit(0), OUTBOX_MS + 1000).unref();
  });
}

log("эхэллээ");
void Promise.all([
  loop("outbox", OUTBOX_MS, () => processOutbox()),
  loop("qpay-poll", MINUTE_MS, () => pollProcessingQPayPayments()),
  loop("stale-sales", MINUTE_MS, async () => unlockStaleSales((await getPosSettings()).staleLockMinutes)),
  loop("stale-drafts", 10 * MINUTE_MS, () => purgeStaleDrafts(24)),
  loop("heartbeat", 30_000, () => beat({ pid: process.pid }).then(() => 0)),
]).then(() => process.exit(0));
