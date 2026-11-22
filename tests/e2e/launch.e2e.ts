import { expect, test, type Browser, type Page } from "@playwright/test";
import pg from "pg";
import { E2E_DATABASE_URL, seedPassword } from "./env";

/**
 * Launch hardening:
 *  - ADMIN creates a user with a temporary password → first login forces a password change
 *  - 5 wrong passwords → the 6th attempt is locked even with the right password
 *  - a FAILED outbox job is visible in ADMIN → Систем and can be retried
 *
 * Login lockout counts by IP too, so the brute-force test uses its own X-Forwarded-For
 * address — otherwise it would lock 127.0.0.1 for every other spec.
 */
test.describe.configure({ mode: "serial" });

const TEMP_EMAIL = "e2e.temp@cless.test";
const TEMP_PASSWORD = "temporary-pass-1";
const NEW_PASSWORD = "my-own-password-2";

async function newPage(browser: Browser, ip: string): Promise<Page> {
  const ctx = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": ip } });
  return ctx.newPage();
}

async function login(page: Page, email: string, password: string) {
  await page.goto("/admin/login");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click("form button[type=submit]");
}

test("temporary password must be changed on first login", async ({ browser }) => {
  const admin = await newPage(browser, "198.51.100.10");
  await login(admin, "admin@example.mn", seedPassword());
  await admin.waitForURL((u) => !u.pathname.endsWith("/login"));
  await admin.goto("/admin/users/new");
  await admin.fill("#name", "E2E Түр хэрэглэгч");
  await admin.fill("#email", TEMP_EMAIL);
  await admin.selectOption("#role", "MANAGER");
  await admin.fill("#password", "short-pw");
  await admin.getByRole("button", { name: "Хэрэглэгч нэмэх" }).click();
  await expect(admin.getByText("Нууц үг дор хаяж 10 тэмдэгт.")).toBeVisible();
  await admin.fill("#password", TEMP_PASSWORD);
  await admin.getByRole("button", { name: "Хэрэглэгч нэмэх" }).click();
  await admin.waitForURL(/\/admin\/users\/(?!new)/);

  const user = await newPage(browser, "198.51.100.11");
  await login(user, TEMP_EMAIL, TEMP_PASSWORD);
  await expect(user.getByRole("heading", { name: "Нууц үгээ солино уу" })).toBeVisible();
  // Other pages are not reachable until the password is changed
  await user.goto("/admin/pos");
  await expect(user.getByRole("heading", { name: "Нууц үгээ солино уу" })).toBeVisible();
  await user.fill("#pw-current", TEMP_PASSWORD);
  await user.fill("#pw-next", NEW_PASSWORD);
  await user.fill("#pw-confirm", NEW_PASSWORD);
  await user.getByRole("button", { name: "Нууц үг солих" }).click();
  await user.waitForURL(/\/admin\/login\?changed=1/);
  await expect(user.getByText("Нууц үг солигдлоо")).toBeVisible();
  await login(user, TEMP_EMAIL, NEW_PASSWORD);
  await user.waitForURL(/\/admin$/);
  await expect(user.getByRole("heading", { name: "Нууц үгээ солино уу" })).toHaveCount(0);
});

test("6th login attempt is locked after 5 wrong passwords (generic error)", async ({ browser }) => {
  const page = await newPage(browser, "203.0.113.77");
  for (let i = 0; i < 5; i++) {
    await login(page, TEMP_EMAIL, `wrong-password-${i}`);
    await expect(page.getByText("Имэйл эсвэл нууц үг буруу байна.")).toBeVisible();
  }
  // Correct password, but locked
  await login(page, TEMP_EMAIL, NEW_PASSWORD);
  await expect(page.getByText("Хэт олон удаа буруу оролдлоо. 15 минутын дараа дахин оролдоно уу.")).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("a failed outbox job can be retried from ADMIN → Систем", async ({ browser }) => {
  const c = new pg.Client(E2E_DATABASE_URL);
  await c.connect();
  await c.query(
    `INSERT INTO "OutboxJob" ("id","type","payload","status","attempts","lastError","updatedAt")
     VALUES ('e2e_failed_job','EMAIL','{}'::jsonb,'FAILED',5,'Resend: 403 domain not verified', now())`,
  );
  const admin = await newPage(browser, "198.51.100.12");
  await login(admin, "admin@example.mn", seedPassword());
  await admin.waitForURL((u) => !u.pathname.endsWith("/login"));
  await admin.goto("/admin");
  await expect(admin.getByRole("alert").filter({ hasText: "имэйл" })).toContainText("илгээгдэж чадсангүй");
  await admin.goto("/admin/system");
  const row = admin.locator("tr", { hasText: "Resend: 403 domain not verified" });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Дахин оролдох" }).click();
  await expect(admin.locator("tr", { hasText: "Resend: 403 domain not verified" })).toHaveCount(0);
  const { rows } = await c.query(`SELECT "status", "attempts" FROM "OutboxJob" WHERE "id" = 'e2e_failed_job'`);
  // The worker may already have picked it up again
  expect(["PENDING", "PROCESSING", "FAILED", "DONE"]).toContain(rows[0].status);
  expect(rows[0].attempts).toBeLessThanOrEqual(1);
  await c.end();
});
