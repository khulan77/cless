import { userInfo } from "node:os";

/** DB тестийн холболт — ЗӨВХӨН локал (brew postgresql@16 → cless_test) */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? `postgresql://${userInfo().username}@127.0.0.1:5432/cless_test`;
