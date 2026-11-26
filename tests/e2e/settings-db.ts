import pg from "pg";
import { E2E_DATABASE_URL } from "./env";

/** PROMPT 20: кассын ээлж анхдагчаар унтраалттай — хуучин (ээлжтэй) урсгалыг шалгах E2E-д асааж/унтраана */
export async function setCashShifts(on: boolean) {
  const c = new pg.Client(E2E_DATABASE_URL);
  await c.connect();
  try {
    await c.query(
      `INSERT INTO "SiteSetting" ("id", "key", "value", "updatedAt") VALUES (md5(random()::text), 'pos', jsonb_build_object('cashShiftsEnabled', $1::boolean), now())
       ON CONFLICT ("key") DO UPDATE SET "value" = "SiteSetting"."value" || jsonb_build_object('cashShiftsEnabled', $1::boolean), "updatedAt" = now()`,
      [on],
    );
  } finally {
    await c.end();
  }
}
