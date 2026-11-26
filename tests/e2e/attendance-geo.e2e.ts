import { expect, test, type Browser, type Page } from "@playwright/test";
import { seedPassword } from "./env";

/**
 * PROMPT 19: админ салоны цэгийг тохируулна → гоо сайханч утаснаас «Ирлээ» (салон дотор) → «Явлаа»;
 * салоноос хол бол татгалзана; менежер өдрийн ирцийг харна.
 */
test.describe.configure({ mode: "serial" });

const SALON = { latitude: 47.9184, longitude: 106.9177 };
const NEAR = { latitude: SALON.latitude + 30 / 111_195, longitude: SALON.longitude, accuracy: 15 };
const FAR = { latitude: SALON.latitude + 400 / 111_195, longitude: SALON.longitude, accuracy: 15 };

async function login(page: Page, email: string) {
  await page.goto("/admin/login");
  await page.fill("#email", email);
  await page.fill("#password", seedPassword());
  await page.click("form button[type=submit]");
  await page.waitForURL((u) => !u.pathname.endsWith("/login"));
}

async function phone(browser: Browser, geo: { latitude: number; longitude: number; accuracy: number }) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, geolocation: geo, permissions: ["geolocation"] });
  return { ctx, page: await ctx.newPage() };
}

test("admin sets the salon location (current position) and radius", async ({ browser }) => {
  const { ctx, page } = await phone(browser, { ...SALON, accuracy: 10 });
  await login(page, "admin@example.mn");
  await page.goto("/admin/settings/attendance");
  await page.getByRole("button", { name: "Одоогийн байршлаа ашиглах" }).click();
  await expect(page.getByLabel("Өргөрөг (latitude)")).toHaveValue(SALON.latitude.toFixed(6));
  await page.getByRole("button", { name: "Хадгалах" }).click();
  await expect(page.getByText("Байршил хадгалагдлаа.").first()).toBeVisible();
  await ctx.close();
});

test("staff: far away → refused; inside → «Ирлээ» → «Явлаа»", async ({ browser }) => {
  const far = await phone(browser, FAR);
  await login(far.page, "staff1@example.mn");
  await expect(far.page).toHaveURL(/\/admin\/schedule/);
  await expect(far.page.getByText("Өнөөдөр ирээгүй")).toBeVisible();
  await far.page.getByRole("button", { name: "Ойлголоо" }).click();
  await far.page.getByRole("button", { name: "Ирлээ" }).click();
  await expect(far.page.getByText(/~400 м зайтай/).first()).toBeVisible();
  await far.ctx.close();

  const near = await phone(browser, NEAR);
  await login(near.page, "staff1@example.mn");
  await near.page.getByRole("button", { name: "Ойлголоо" }).click();
  await near.page.getByRole("button", { name: "Ирлээ" }).click();
  await expect(near.page.getByText(/-аас ажиллаж байна/)).toBeVisible();
  // 1 минутад давхар дарахаас хамгаална
  await near.page.getByRole("button", { name: "Явлаа" }).click();
  await expect(near.page.getByText("1 минутын дараа").first()).toBeVisible();
  await near.ctx.close();
});

test("manager sees who is at work today", async ({ page }) => {
  await login(page, "manager@example.mn");
  await expect(page.getByText("Өнөөдөр ажил дээр:")).toBeVisible();
  await page.goto("/admin/attendance?view=day");
  const row = page.getByRole("row", { name: /Гоо сайханч Сараа/ });
  await expect(row.getByText("Ажиллаж байна")).toBeVisible();
});

test("cron route requires CRON_SECRET", async ({ request }) => {
  expect((await request.get("/api/cron/attendance")).status()).toBe(401);
  expect((await request.get("/api/cron/attendance", { headers: { authorization: "Bearer wrong-secret-0000000000" } })).status()).toBe(401);
});

test("tick route requires CRON_SECRET", async ({ request }) => {
  expect((await request.post("/api/cron/tick")).status()).toBe(401);
  expect((await request.post("/api/cron/tick", { headers: { authorization: "Bearer wrong-secret-0000000000" } })).status()).toBe(401);
});
