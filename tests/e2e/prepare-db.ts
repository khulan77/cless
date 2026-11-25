/**
 * Run by Playwright's webServer command BEFORE `next start`: fresh local DB + seed.
 * (globalSetup runs after the web server starts, which is too late for a schema reset.)
 */
import { spawnSync } from "node:child_process";
import pg from "pg";
import { resetLocalDb } from "../reset-local-db";
import { E2E_DATABASE_URL, e2eEnv } from "./env";

await resetLocalDb(E2E_DATABASE_URL);
const seed = spawnSync("bun", ["prisma/seed.ts"], { env: { ...e2eEnv(), NODE_ENV: "development" }, encoding: "utf8" });
if (seed.status !== 0) {
  console.error(`Seed амжилтгүй:\n${seed.stdout}\n${seed.stderr}`);
  process.exit(1);
}
// Цагийн тест ӨНӨӨДӨР (УБ) захиалж "Ирсэн — POS нээх" хийнэ (зөвхөн цагийн өдөр зөвшөөрөгдөнө).
// Хэзээ ч (Ням, орой) ажиллахын тулд E2E DB-д: салбар ба гоо сайханчид 7 хоног 00:00–24:00,
// seed-ийн цагуудыг устгана (тестийн цагтай давхцахгүй).
const c = new pg.Client(E2E_DATABASE_URL);
await c.connect();
const allDay = Object.fromEntries(["0", "1", "2", "3", "4", "5", "6"].map((d) => [d, [{ start: "00:00", end: "24:00" }]]));
await c.query(
  `INSERT INTO "SiteSetting" ("id", "key", "value", "updatedAt") VALUES ('e2e_booking', 'booking', $1::jsonb, now())
   ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value"`,
  [JSON.stringify({ hours: allDay, slotMinutes: 15, minLeadMinutes: 0 })],
);
// PROMPT 15 §5: айлчлалын тайланг автоматаар илгээх (анхдагч унтраатай) — POS тест имэйлийг шалгадаг
await c.query(
  `INSERT INTO "SiteSetting" ("id", "key", "value", "updatedAt") VALUES ('e2e_notify', 'notify', '{"autoVisitEmail": true}'::jsonb, now())
   ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value"`,
);
await c.query(`DELETE FROM "StaffSchedule"`);
await c.query(
  `INSERT INTO "StaffSchedule" ("id", "staffId", "weekday", "startTime", "endTime")
   SELECT 'e2e_' || u."id" || '_' || d, u."id", d, '00:00', '24:00' FROM "User" u CROSS JOIN generate_series(0, 6) d WHERE u."role" = 'STAFF'`,
);
await c.query(`DELETE FROM "Appointment"`);
// Үлдэгдэл → сайтын кэш тест: нэг бүтээгдэхүүнд яг 1 ширхэг (movement-тэй нийцтэй)
await c.query(
  `WITH v AS (SELECT "id", "stock" FROM "Variant" WHERE "sku" = 'BR-SERUM-BIOFIXINE-30ML')
   INSERT INTO "StockMovement" ("id", "branchId", "variantId", "type", "qty", "note")
   SELECT 'e2e_last_unit', 'branch_cl', v."id", 'ADJUSTMENT', 1 - v."stock", 'E2E: сүүлийн 1 ширхэг' FROM v WHERE v."stock" <> 1`,
);
await c.query(`UPDATE "Variant" SET "stock" = 1, "reserved" = 0 WHERE "sku" = 'BR-SERUM-BIOFIXINE-30ML'`);
await c.end();
console.log("[e2e] DB бэлэн:", new URL(E2E_DATABASE_URL).pathname.slice(1));
