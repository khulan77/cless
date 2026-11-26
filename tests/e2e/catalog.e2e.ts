import pg from "pg";
import { expect, test, type Page } from "@playwright/test";
import { E2E_DATABASE_URL, seedPassword } from "./env";

/**
 * PROMPT 17: клиент бүтээгдэхүүнээ өөрөө оруулна — нэр, ангилал, үнэ, баркод, зураг, тайлбар → сайтад шууд;
 * upload-ын буруу формат/хэмжээ → ойлгомжтой мессеж; олноор архивлах/устгах; хоосон ангилал → "удахгүй".
 */
test.describe.configure({ mode: "serial" });

const NAME = "E2E Шинэ Тоник";
const SLUG = "e2e-shine-tonik";

async function login(page: Page) {
  await page.goto("/admin/login");
  await page.fill("#email", "admin@example.mn");
  await page.fill("#password", seedPassword());
  await page.click("form button[type=submit]");
  await page.waitForURL(/\/admin$/);
}

// 1×1 PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");

test("admin adds a product (collections, price, barcode, image, description) → it shows on the site", async ({ page }) => {
  await login(page);
  await page.goto("/admin/products/new");
  await page.locator("#name").fill(NAME);
  await page.locator("#slug").fill(SLUG);
  await page.getByLabel("Барааны код").first().fill("E2E-TONIK-1");
  await page.getByLabel("Баркод").first().fill("8650000000017");
  await page.getByLabel("Хэмжээ").first().fill("100 мл");
  await page.getByLabel("Үнэ", { exact: true }).first().fill("95000");

  const file = page.locator('input[type="file"]').first();
  // Буруу формат, хэт том файл — серверт илгээхээс өмнө ойлгомжтой мессеж
  await file.setInputFiles({ name: "anim.gif", mimeType: "image/gif", buffer: Buffer.from("GIF89a") });
  await expect(page.getByText("зөвхөн JPG, PNG, WEBP, AVIF").first()).toBeVisible();
  await file.setInputFiles({ name: "huge.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(4 * 1024 * 1024 + 10) });
  await expect(page.getByText(/4MB-аас ихгүй/).first()).toBeVisible();
  await file.setInputFiles({ name: "tonik.png", mimeType: "image/png", buffer: PNG });
  await expect(page.locator('img[src*="uploads"], img[src*="storage"]').first()).toBeAttached();

  // Ангилал (олон сонголт)
  await page.getByRole("checkbox", { name: "Нүүрний арчилгаа", exact: true }).check();
  await page.getByRole("checkbox", { name: "Цэвэрлэгч ба сүү", exact: true }).check();
  await page.getByRole("checkbox", { name: "Дэлгүүрт нийтлэх" }).check();
  await page.getByRole("tab", { name: "Агуулга" }).click();
  await page.locator("#description").fill("Арьсыг тэнцвэржүүлэх E2E тоник.");
  await page.getByRole("button", { name: "Хадгалах" }).click();
  await page.waitForURL(/\/admin\/products\/c[a-z0-9]+$/);

  await page.goto(`/products/${SLUG}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(NAME);
  await page.goto("/collections/cleansers-milks");
  await expect(page.getByRole("link", { name: new RegExp(NAME) }).first()).toBeVisible();
});

test("bulk: archive hides it from the site, delete removes it (no history)", async ({ page }) => {
  await login(page);
  await page.goto(`/admin/products?q=${encodeURIComponent(NAME)}`);
  await page.getByRole("checkbox", { name: `${NAME} сонгох` }).check();
  await expect(page.getByText("1 сонгосон")).toBeVisible();
  await page.getByRole("button", { name: "Архивлах" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Архивлах" }).click();
  await expect(page.getByText("1 бүтээгдэхүүн архивлагдлаа").first()).toBeVisible();
  // Streaming (PPR) — notFound нь контентоор ирнэ
  await page.goto(`/products/${SLUG}`);
  await expect(page.getByRole("heading", { name: "Хуудас олдсонгүй" })).toBeVisible();

  await page.goto(`/admin/products?q=${encodeURIComponent(NAME)}`);
  await page.getByRole("checkbox", { name: "Бүгдийг сонгох" }).check();
  await page.getByRole("button", { name: "Устгах" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Устгах" }).click();
  await expect(page.getByText("1 бүтээгдэхүүн устгалаа.").first()).toBeVisible();
  await expect(page.getByText("Бүтээгдэхүүн олдсонгүй")).toBeVisible();
});

test("a collection with no products shows a calm empty state (not 404)", async ({ page }) => {
  const c = new pg.Client(E2E_DATABASE_URL);
  await c.connect();
  try {
    await c.query(`INSERT INTO "Collection" ("id", "slug", "name", "kind", "updatedAt") VALUES ('e2e_empty_col', 'e2e-empty', 'E2E Хоосон', 'CATEGORY', now()) ON CONFLICT DO NOTHING`);
  } finally {
    await c.end();
  }
  const res = await page.goto("/collections/e2e-empty");
  expect(res?.status()).toBe(200);
  await expect(page.getByText("Энэ ангиллын бүтээгдэхүүн удахгүй нэмэгдэнэ.")).toBeVisible();
});
