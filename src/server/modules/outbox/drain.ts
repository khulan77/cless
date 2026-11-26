/**
 * Шууд илгээх (PROMPT 22): ажил enqueue хийсэн хүсэлтийн хариу буцсаны дараа Next.js `after()`-аар outbox-ийг
 * бага хэмжээгээр (5 ажил / 5 сек) боловсруулна — SMS/имэйл минут хүлээхгүй. Request-ийн гадна (worker, скрипт,
 * тест) `after` ажиллахгүй тул чимээгүй алгасна; тэр үед tick (минут тутам) эсвэл worker илгээнэ.
 * FOR UPDATE SKIP LOCKED тул нэг хүсэлтэд олон drain, tick, worker зэрэг ажилласан ч ажил давхардахгүй.
 * worker.ts ↔ service.ts ↔ drain.ts тойрог импорт — processOutbox-ийг зөвхөн дуудах үед ашиглана (ESM-д аюулгүй).
 */
import { processOutbox } from "./worker";

export function drainSoon() {
  void (async () => {
    try {
      const { after } = await import("next/server");
      after(async () => {
        await processOutbox({ maxJobs: 5, budgetMs: 5000 }).catch((e) => console.error("[outbox] after-drain failed", { message: e instanceof Error ? e.message : String(e) }));
      });
    } catch {
      // Request-ийн гадна — tick / worker илгээнэ
    }
  })();
}
