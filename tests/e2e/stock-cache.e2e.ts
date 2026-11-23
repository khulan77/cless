import { expect, test, type Page } from "@playwright/test";
import { seedPassword } from "./env";

/**
 * Stock → storefront cache: selling the last unit in POS makes the product page show
 * "Дууссан — ирэх үед мэдэгдэнэ" right away; a refund with restock makes it available again.
 * (CATALOG mode: no cart — the stock label under the price changes.)
 */
const PRODUCT = "/products/serum-biofixine";
const SKU = "BR-SERUM-BIOFIXINE-30ML";

async function waitAction(page: Page, click: () => Promise<void>) {
  const res = page.waitForResponse((r) => r.request().method() === "POST" && Boolean(r.request().headers()["next-action"]));
  await click();
  return res;
}

test("last unit sold in POS → product page sold out; refund → available again", async ({ page, browser }) => {
  // Shopper (no session)
  const shopper = await (await browser.newContext()).newPage();
  const stock = shopper.getByTestId("stock-label");
  await shopper.goto(PRODUCT);
  await expect(stock).toHaveText("Цөөн үлдсэн"); // the last unit
  await expect(shopper.getByRole("button", { name: "Салонд захиалах", exact: true }).first()).toBeVisible();

  // ADMIN sells the last unit by card (no cash shift needed)
  await page.goto("/admin/login");
  await page.fill("#email", "admin@example.mn");
  await page.fill("#password", seedPassword());
  await page.click("form button[type=submit]");
  await page.waitForURL((u) => !u.pathname.endsWith("/login"));
  await page.goto("/admin/pos?new=1");
  const search = page.getByLabel("Каталог хайх");
  await search.fill(SKU);
  await search.press("Enter");
  await expect(page.locator("section", { hasText: "Сагс" }).last()).toContainText("SÉRUM BIOFIXINE");
  await waitAction(page, () => page.click("#pos-checkout"));
  const pay = page.locator("dialog[open]");
  await pay.getByRole("tab", { name: "Карт" }).click();
  await pay.locator("#pay-approval").fill("E2E-001");
  await waitAction(page, () => pay.getByRole("button", { name: "Төлбөр бүртгэх" }).click());
  await expect(pay).toContainText("Төлбөр бүрэн төлөгдлөө");
  const saleHref = await pay.getByRole("link", { name: "Дэлгэрэнгүй" }).getAttribute("href");

  // Storefront: sold out immediately (no waiting for the cache to expire)
  await shopper.reload();
  await expect(stock).toHaveText("Дууссан — ирэх үед мэдэгдэнэ");

  // Refund with restock → available again
  await page.goto(saleHref!);
  await page.getByRole("button", { name: "Буцаалт" }).click();
  const refund = page.locator("dialog[open]");
  await refund.getByLabel(/SÉRUM BIOFIXINE/).fill("1");
  await refund.locator("#rf-reason").fill("E2E буцаалт");
  await refund.locator("#rf-method").selectOption("CARD");
  await waitAction(page, () => refund.getByRole("button", { name: "Буцаалт хийх" }).click());
  await expect(page.locator("dialog[open]")).toHaveCount(0);

  await shopper.reload();
  await expect(stock).toHaveText("Цөөн үлдсэн");
});
