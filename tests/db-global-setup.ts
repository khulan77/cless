import { resetLocalDb } from "./reset-local-db";
import { TEST_DATABASE_URL } from "./test-db-url";

/** Тестийн DB-г цэвэрлээд бүх migration-ийг дарааллаар нь ажиллуулна. */
export default async function setup() {
  await resetLocalDb(TEST_DATABASE_URL);
}
