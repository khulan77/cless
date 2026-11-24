import { expect, test, type Browser, type Page } from "@playwright/test";
import pg from "pg";
import { E2E_DATABASE_URL, seedPassword } from "./env";
import { contactWindow, inquiryReply } from "../../src/lib/hours";

/**
 * Storefront launch (CATALOG mode):
 *  - no cart anywhere; /cart → catalog; header "Цаг захиалах" sheet (Esc closes)
 *  - no seed contacts (example.mn, +976 0000 0000) and no dev placeholder images in the production build
 *  - "Салонд захиалах" request → admin Хүсэлтүүд + dashboard card + outbox e-mail job
 */
test.describe.configure({ mode: "serial" });

const PAGES = ["/", "/collections", "/products/serum-biofixine", "/services", "/services/skin-diagnosis", "/salon", "/contact", "/search?q=lotion"];

async function shopper(browser: Browser, ip: string): Promise<Page> {
  const ctx = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": ip } });
  return ctx.newPage();
}

test("CATALOG: no cart, add-to-cart or account; /cart redirects to the catalog", async ({ browser }) => {
  const page = await shopper(browser, "198.51.100.40");
  for (const path of ["/", "/collections", "/products/serum-biofixine"]) {
    await page.goto(path);
    await expect(page.locator('a[href="/cart"]')).toHaveCount(0);
    await expect(page.locator('a[href="/account"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Сагсанд нэмэх/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /сагсанд нэмэх/ })).toHaveCount(0);
  }
  await page.goto("/cart");
  await expect(page).toHaveURL(/\/collections$/);
  await page.goto("/account");
  await expect(page).toHaveURL(/\/$/);
});

test("header 'Цаг захиалах' opens the booking sheet; Esc closes it and focus returns", async ({ browser }) => {
  const page = await shopper(browser, "198.51.100.41");
  await page.goto("/services");
  const trigger = page.getByRole("banner").getByRole("button", { name: "Цаг захиалах" });
  await trigger.click();
  const sheet = page.getByRole("dialog", { name: "Цаг захиалах" });
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText("Ажлын цаг");
  await expect(sheet).not.toContainText(/онлайн/i);
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("no seed contacts and no dev placeholder images on public pages", async ({ browser }) => {
  const page = await shopper(browser, "198.51.100.42");
  for (const path of PAGES) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBeLessThan(400);
    const html = await page.content();
    expect(html, path).not.toContain("example.mn");
    expect(html, path).not.toContain("0000 0000");
    expect(html, path).not.toContain("/placeholders/");
    expect(html, path).not.toMatch(/HERO IMAGE|\d{3,4}×\d{3,4}/);
  }
  // Hours come from the branch hours (E2E: every day 00:00–24:00 → one merged line)
  await page.goto("/salon");
  await expect(page.locator("footer")).toContainText("Даваа–Ням 00:00–24:00");
});

test("services: from the Service table, grouped by category, with a detail page", async ({ browser }) => {
  const page = await shopper(browser, "198.51.100.43");
  await page.goto("/services");
  await expect(page.getByRole("heading", { level: 2, name: "Оношлогоо" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Нүүрний эмчилгээ" })).toBeVisible();
  await expect(page.getByText("60 мин").first()).toBeVisible();
  await page.getByRole("link", { name: "Арьсны оношлогоо ба зөвлөгөө" }).click();
  await expect(page).toHaveURL(/\/services\/skin-diagnosis$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Арьсны оношлогоо ба зөвлөгөө");
  await expect(page.getByText("Хэнд тохиромжтой")).toBeVisible();
});

test("'Салонд захиалах' request reaches admin and the outbox", async ({ browser }) => {
  const page = await shopper(browser, "198.51.100.44");
  await page.goto("/products/lotion-p50");
  await page.getByRole("button", { name: "Салонд захиалах" }).first().click();
  const sheet = page.getByRole("dialog", { name: "Салонд захиалах" });
  await expect(sheet).toBeVisible();
  await sheet.getByLabel("Нэр").fill("E2E Хүсэлт");
  await sheet.getByLabel("Утасны дугаар").fill("1234");
  await sheet.getByRole("button", { name: "Хүсэлт илгээх" }).click();
  await expect(sheet).toContainText("8 оронтой утасны дугаар");
  await sheet.getByLabel("Утасны дугаар").fill("9911 4455");
  await sheet.getByRole("button", { name: "Хүсэлт илгээх" }).click();
  // The reply depends on the server's clock: with the E2E hours (00:00–24:00) it is "within 1 hour",
  // except in the last 30 minutes of the day (UB) — "tomorrow". Expect what the same rule gives now,
  // so the test passes at any time of day.
  const allDay = Object.fromEntries(["0", "1", "2", "3", "4", "5", "6"].map((d) => [d, [{ start: "00:00", end: "24:00" }]]));
  await expect(sheet.getByRole("status")).toHaveText(inquiryReply(contactWindow(allDay, new Date())));

  const c = new pg.Client(E2E_DATABASE_URL);
  await c.connect();
  const { rows } = await c.query(`SELECT i."id", i."phone", j."type" FROM "ProductInquiry" i JOIN "OutboxJob" j ON j."payload"->>'inquiryId' = i."id" WHERE i."name" = 'E2E Хүсэлт'`);
  await c.end();
  expect(rows).toEqual([expect.objectContaining({ phone: "99114455", type: "INQUIRY_EMAIL" })]);

  const admin = await shopper(browser, "198.51.100.45");
  await admin.goto("/admin/login");
  await admin.fill("#email", "manager@example.mn");
  await admin.fill("#password", seedPassword());
  await admin.click("form button[type=submit]");
  await admin.waitForURL((u) => !u.pathname.endsWith("/login"));
  await admin.goto("/admin");
  await expect(admin.getByText("Шинэ хүсэлт (1)")).toBeVisible();
  await admin.goto("/admin/inquiries");
  const row = admin.getByTestId("inquiry-row").filter({ hasText: "E2E Хүсэлт" });
  await expect(row).toContainText("LOTION P50");
  await expect(row.getByRole("link", { name: /99114455/ })).toHaveAttribute("href", "tel:99114455");
  await row.getByLabel("Төлөв").selectOption("CONTACTED");
  await expect(admin.getByText("Төлөв шинэчлэгдлээ.")).toBeVisible();
  await admin.goto("/admin");
  await expect(admin.getByText("Шинэ хүсэлт (0)")).toBeVisible();
});
