import { expect, test, type Page } from "@playwright/test";
import { makeXlsx, product, variant } from "../../src/server/modules/import/test-helpers";
import { seedPassword } from "./env";

/**
 * Storefront E2E (seed DB, `bun run build` → `bun run test:e2e`). 375px ба 1440px хоёр viewport.
 *
 * Seed-ийн хамгийн том ангилалд 8 бараа (хуудас 24) — "Цааш үзэх" харагдахгүй. Тиймээс эхний тест
 * админаар нэвтэрч Excel импортоор "serum" ангилалд 20 бараа нэмнэ (импорт → saveProduct → updateTag).
 *
 * Seed-ээс хамааралтай:
 *  - serum-colostrum: 30 мл 260,000₮ / 8 мл 90,000₮ (хоёулаа үлдэгдэлтэй)
 *  - creme-dermopurifiante: 50 мл үлдэгдэл 0 (дууссан), 15 мл 75,000₮
 *  - baume-levres: PROTOCOL холбоостой
 */

const IMPORTED = 20;
const SERUM_SEED = 7;
const SERUM_TOTAL = SERUM_SEED + IMPORTED;

test.describe.configure({ mode: "serial" });

async function login(page: Page) {
  await page.goto("/admin/login");
  await page.fill("#email", "admin@example.mn");
  await page.fill("#password", seedPassword());
  await page.click("form button[type=submit]");
  await page.waitForURL(/\/admin$/);
}

/** Хуудас хэвтээ чиглэлд гүйлгэгдэхгүй байх ёстой */
async function expectNoHorizontalScroll(page: Page) {
  const { scroll, width } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    width: window.innerWidth,
  }));
  expect(scroll, `scrollWidth ${scroll} > viewport ${width}`).toBeLessThanOrEqual(width);
}

const price = (page: Page) => page.locator('[aria-live="polite"]').filter({ hasText: "₮" }).first();

test("admin: нэвтрэх → бүтээгдэхүүний жагсаалт → Excel импорт (20 бараа)", async ({ page }) => {
  await login(page);
  await page.goto("/admin/products");
  await expect(page.getByRole("heading", { name: "Бүтээгдэхүүн", exact: true })).toBeVisible();
  await expect(page.locator('a[href^="/admin/products/c"]').first()).toBeVisible();

  await page.getByRole("link", { name: "Excel-ээс импорт" }).click();
  await expect(page).toHaveURL(/\/admin\/products\/import$/);

  const n = (i: number) => String(i).padStart(2, "0");
  const xlsx = await makeXlsx(
    Array.from({ length: IMPORTED }, (_, i) =>
      product(`e2e-serum-${n(i + 1)}`, { name: `E2E SERUM ${n(i + 1)}`, categories: "serum", isPublished: "тийм" }),
    ),
    Array.from({ length: IMPORTED }, (_, i) =>
      variant(`e2e-serum-${n(i + 1)}`, `E2E-SERUM-${n(i + 1)}`, { price: 100_000 + i * 1000, costPrice: 50_000, initialStock: 2 }),
    ),
  );
  await page.locator('input[type="file"]').setInputFiles({
    name: "e2e-products.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(xlsx),
  });
  await page.getByRole("button", { name: "Урьдчилан харах" }).click();
  const stat = (label: string) =>
    page.locator("dl > div").filter({ has: page.locator("dt").getByText(label, { exact: true }) }).locator("dd");
  await expect(stat("Шинэ")).toHaveText(String(IMPORTED));
  await expect(stat("Алдаатай")).toHaveText("0");

  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Импортлох", exact: true }).click();
  await expect(page.getByText(`${IMPORTED} шинэ, 0 шинэчлэгдсэн, 0 алдаа`).first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(`${IMPORTED} хувилбарт эхний үлдэгдэл бүртгэгдлээ`)).toBeVisible();
});

for (const vp of [
  { name: "375px", width: 375, height: 812, desktop: false },
  { name: "1440px", width: 1440, height: 900, desktop: true },
]) {
  test.describe(`storefront ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("нүүр хуудас ачаалагдана", async ({ page }) => {
      const res = await page.goto("/");
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("banner").getByRole("link", { name: /— нүүр хуудас$/ })).toBeVisible();
      await expect(page.locator("main, #main, [id=main-content]").first()).toBeVisible();
      await expectNoHorizontalScroll(page);
    });

    test("цэс нээгдэж, хаагдана (товч ба Esc)", async ({ page }) => {
      await page.goto("/");
      const trigger = page.getByRole("button", { name: "Цэс нээх" });
      const panel = page.getByRole("dialog", { name: "Үндсэн цэс" });
      await trigger.click();
      await expect(trigger).toHaveAttribute("aria-expanded", "true");
      await expect(panel).toBeVisible();
      await panel.getByRole("button", { name: "Цэс хаах" }).click();
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
      await expect(panel).toBeHidden();

      await trigger.click();
      await expect(panel).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(panel).toBeHidden();
    });

    test("header: ангиллын banner дээр тунгалаг, гүйлгэхэд/бусад хуудсанд цагаан", async ({ page }) => {
      const header = page.locator("header[data-header-shell]");
      const bg = () => header.evaluate((h) => getComputedStyle(h).backgroundColor);
      const TRANSPARENT = "rgba(0, 0, 0, 0)";
      const WHITE = "rgb(255, 255, 255)";

      // Home: transparent over the hero (as on biologique-recherche.com); a page without a banner: white
      await page.goto("/");
      await expect.poll(bg).toBe(TRANSPARENT);
      await page.goto("/services");
      await expect.poll(bg).toBe(WHITE);

      await page.goto("/collections/serum");
      await expect.poll(bg).toBe(TRANSPARENT);
      await page.mouse.wheel(0, 600);
      await expect.poll(bg).toBe(WHITE);
      await page.mouse.wheel(0, -2000);
      await expect.poll(bg).toBe(TRANSPARENT);

      // Client-side шилжилт: banner алга болмогц header цагаан
      await page.locator('a[href="/products/serum-colostrum"]').first().click();
      await expect(page).toHaveURL(/\/products\/serum-colostrum$/);
      await expect.poll(bg).toBe(WHITE);
    });

    test("ангилал руу орох → «Цааш үзэх»", async ({ page }) => {
      await page.goto("/collections");
      await page.locator('a[href="/collections/serum"]').first().click();
      await expect(page).toHaveURL(/\/collections\/serum$/);
      await expect(page.getByText(`24 / ${SERUM_TOTAL} бүтээгдэхүүн үзсэн`)).toBeVisible();
      await page.getByRole("button", { name: "Цааш үзэх" }).click();
      await expect(page.getByText(`${SERUM_TOTAL} / ${SERUM_TOTAL} бүтээгдэхүүн үзсэн`)).toBeVisible();
      await expect(page.getByRole("button", { name: "Цааш үзэх" })).toHaveCount(0);
      await expect(page.locator('a[href="/products/e2e-serum-20"]').first()).toBeAttached();
      await expectNoHorizontalScroll(page);
    });

    test("бараа нээх → хэмжээ солиход үнэ солигдоно", async ({ page }) => {
      await page.goto("/collections/serum");
      await page.locator('a[href="/products/serum-colostrum"]').first().click();
      await expect(page).toHaveURL(/\/products\/serum-colostrum$/);
      await expect(page.getByRole("heading", { level: 1 })).toContainText("COLOSTRUM");
      await expect(price(page)).toContainText("260,000₮");
      await page.getByRole("radiogroup", { name: "Хэмжээ" }).first().getByText("8 мл", { exact: true }).click();
      await expect(price(page)).toContainText("90,000₮");
      await expect(price(page)).toContainText("8 мл");
      await expectNoHorizontalScroll(page);
    });

    test("дууссан хэмжээ сонгогдохгүй", async ({ page }) => {
      await page.goto("/products/creme-dermopurifiante");
      const sizes = page.getByRole("radiogroup", { name: "Хэмжээ" }).first();
      const soldOut = sizes.getByRole("radio", { name: /50 мл/ });
      await expect(soldOut).toBeDisabled();
      await expect(sizes.getByRole("radio", { name: /15 мл/ })).toBeChecked();
      await sizes.getByText("50 мл", { exact: true }).click({ force: true });
      await expect(sizes.getByRole("radio", { name: /15 мл/ })).toBeChecked();
      await expect(price(page)).toContainText("75,000₮");
    });

    test("хурдан үзэх", async ({ page }) => {
      await page.goto("/collections/serum");
      const card = page.locator("article, li").filter({ has: page.locator('a[href="/products/serum-colostrum"]') }).first();
      const button = card.getByRole("button", { name: "SÉRUM COLOSTRUM — хурдан үзэх" });
      if (!vp.desktop) {
        // Утсанд хурдан үзэх товч нуугдсан (md:block) — карт шууд бараа руу орно
        await expect(button).toBeHidden();
        return;
      }
      await card.hover();
      await button.click();
      const dialog = page.getByRole("dialog", { name: "SÉRUM COLOSTRUM" });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText("260,000₮").first()).toBeVisible();
      await dialog.getByRole("button", { name: "Хаах" }).click();
      await expect(dialog).toBeHidden();
    });

    test("protocol drawer", async ({ page }) => {
      await page.goto("/products/baume-levres");
      const box = page.getByRole("region", { name: "Хамт хэрэглэх арчилгаа" });
      await box.scrollIntoViewIfNeeded();
      await box.getByRole("button", { name: "Бүх бүтээгдэхүүнийг үзэх" }).click();
      const drawer = page.getByRole("dialog", { name: "Хамт хэрэглэх арчилгаа" });
      await expect(drawer).toBeVisible();
      await expect(drawer.locator('a[href^="/products/"]').first()).toBeVisible();
      await drawer.getByRole("button", { name: "Хаах" }).first().click();
      await expect(drawer).toBeHidden();
    });

    test("404 хуудас", async ({ page }) => {
      const res = await page.goto("/baihgui-huudas-e2e");
      expect(res?.status()).toBe(404);
      await expect(page.getByRole("heading", { name: "Хуудас олдсонгүй" })).toBeVisible();
      await expectNoHorizontalScroll(page);

      // Байхгүй бараа: 404 UI + noindex. Статус нь 200 (Cache Components streaming — notFound() нь
      // header илгээсний дараа ажилладаг). Хайлтад орохгүй тул `noindex`-ийг шалгана.
      await page.goto("/products/baihgui-baraa-e2e");
      await expect(page.getByRole("heading", { name: "Хуудас олдсонгүй" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Нүүр хуудас руу" })).toBeVisible();
      const robots = await page.locator('meta[name="robots"]').evaluateAll((ms) => ms.map((m) => m.getAttribute("content") ?? ""));
      expect(robots.length).toBeGreaterThan(0);
      expect(robots.every((c) => c.includes("noindex")), robots.join(" | ")).toBe(true);
    });
  });
}
