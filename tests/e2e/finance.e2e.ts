import { expect, test, type Page } from "@playwright/test";
import { seedPassword } from "./env";

/**
 * PROMPT 18: зардал (код заавал, НӨАТ) → санхүүгийн тайлан (P&L, НӨАТ) → бүх системийн XLSX.
 */
test.describe.configure({ mode: "serial" });

async function login(page: Page) {
  await page.goto("/admin/login");
  await page.fill("#email", "admin@example.mn");
  await page.fill("#password", seedPassword());
  await page.click("form button[type=submit]");
  await page.waitForURL(/\/admin$/);
}

test("expense: utility needs a code; VAT split; shows in P&L and VAT report; XLSX exports", async ({ page }) => {
  await login(page);
  await page.goto("/admin/expenses");
  await page.getByRole("button", { name: "Зардал бүртгэх" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Ангилал").selectOption({ label: "UTIL · Ашиглалтын төлбөр" });
  await dialog.getByLabel(/Дүн/).fill("110000");
  await dialog.getByText("НӨАТ-тэй (10%)").click();
  await expect(dialog.getByText("Цэвэр 100,000₮ · НӨАТ 10,000₮").or(dialog.getByText(/Цэвэр 100[ ,]000₮/))).toBeVisible();
  await dialog.getByLabel("Төлбөрийн код (заавал)").fill("UB-778899");
  await dialog.getByLabel("Нийлүүлэгч").fill("УБЦТС");
  await dialog.getByLabel("Төлсөн").selectOption("TRANSFER");
  await dialog.getByRole("button", { name: "Хадгалах" }).click();
  await expect(page.getByText("Зардал бүртгэгдлээ.").first()).toBeVisible();
  await expect(page.getByRole("cell", { name: "UB-778899" })).toBeVisible();

  // Дараагийн бүртгэлд сүүлийн код санал болгоно
  await page.getByRole("button", { name: "Зардал бүртгэх" }).click();
  await expect(page.getByRole("dialog").getByLabel("Төлбөрийн код (заавал)")).toHaveValue("UB-778899");
  await page.getByRole("dialog").getByRole("button", { name: "Болих" }).click();

  await page.goto("/admin/finance");
  await expect(page.getByRole("heading", { name: "Орлого-зарлагын тайлан" })).toBeVisible();
  await expect(page.getByRole("row", { name: /UTIL · Ашиглалтын төлбөр/ })).toBeVisible();
  await page.getByRole("link", { name: "НӨАТ" }).click();
  await expect(page.getByRole("heading", { name: "НӨАТ-ын тайлан" })).toBeVisible();

  const res = await page.request.get("/api/admin/finance/export.xlsx?period=month");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("spreadsheetml");
  const csv = await page.request.get("/api/admin/expenses/export?period=month&format=csv");
  expect(await csv.text()).toContain("UB-778899");
});

test("finance pages and exports require sign-in", async ({ browser }) => {
  const ctx = await browser.newContext();
  const res = await ctx.request.get("/api/admin/finance/export.xlsx");
  expect(res.status()).toBe(401);
  expect((await ctx.request.get("/api/finance/export/bogus.token")).status()).toBe(410);
  await ctx.close();
});
