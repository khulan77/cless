import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { E2E_EMAIL_DIR, seedPassword } from "./env";

/**
 * Full POS flow on a fresh DB:
 * open shift → DRAFT cart (autosave) → reload → cart intact → split payment
 * (QPay manual + cash) → visit e-mail SENT → shift closed via the confirm dialog.
 *
 * Money inputs are typed key by key and the button is clicked with the mouse
 * right away (no Enter / no blur) — the case reported as "click does nothing".
 */

/** Type like a person (formatting "1,000" happens on every keystroke), then click immediately */
async function typeMoney(input: Locator, digits: string) {
  await input.click();
  await input.press("ControlOrMeta+a");
  await input.press("Backspace");
  await input.pressSequentially(digits, { delay: 15 });
}

// The second test opens a new shift, so it needs the first one to have closed its shift
test.describe.configure({ mode: "serial" });

/** Optional screenshots for visual review: E2E_SHOTS=<dir> */
async function shot(page: Page, name: string) {
  if (process.env.E2E_SHOTS) await page.screenshot({ path: join(process.env.E2E_SHOTS, `${name}.png`), fullPage: true });
}

async function waitAction(page: Page, click: () => Promise<void>) {
  const res = page.waitForResponse((r) => r.request().method() === "POST" && Boolean(r.request().headers()["next-action"]));
  await click();
  await res;
}

test("POS: shift → draft survives reload → split payment → e-mail SENT → close shift", async ({ page }) => {
  // No browser-native confirm/alert anywhere in the flow
  page.on("dialog", (d) => {
    throw new Error(`Unexpected browser dialog: ${d.type()} ${d.message()}`);
  });
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));

  await page.goto("/admin/login");
  await page.fill("#email", "manager@example.mn");
  await page.fill("#password", seedPassword());
  await page.click("form button[type=submit]");
  await page.waitForURL(/\/admin$/);

  // ── 1. Open shift (type → mouse click) ──
  await page.goto("/admin/shifts");
  await typeMoney(page.locator("#sh-open"), "50000");
  await waitAction(page, () => page.getByRole("button", { name: "Касс нээх" }).click());
  await expect(page.getByText("Нээлттэй ээлж")).toBeVisible();

  // Pay-out 5,000 (type → mouse click)
  await typeMoney(page.locator("#mv-amount"), "5000");
  await page.fill("#mv-note", "Ус худалдаж авсан");
  await waitAction(page, () => page.getByRole("button", { name: "Бүртгэх" }).click());
  await expect(page.locator("main")).toContainText("45,000₮");

  // ── 2. Build a cart: service + product (SKU / Enter), new customer, diagnosis ──
  await page.goto("/admin/pos");
  const search = page.getByLabel("Каталог хайх");
  await search.fill("Чийгшүүлэх");
  await page.getByRole("button", { name: /Нүүрний эмчилгээ — Чийгшүүлэх/ }).click();
  await page.getByLabel("Ажилтан").selectOption({ index: 1 });
  await search.fill("BR-LOTION-P50-150ML");
  await search.press("Enter");
  await expect(page.locator("section", { hasText: "Сагс" }).last()).toContainText("LOTION P50");

  await page.getByRole("button", { name: /Шинэ үйлчлүүлэгч/ }).click();
  await page.fill("#nc-name", "E2E Номин");
  await page.fill("#nc-phone", "8800 3344");
  await page.fill("#nc-email", "e2e-nomin@example.mn");
  await waitAction(page, () => page.locator("dialog[open]").getByRole("button", { name: "Хадгалах" }).click());
  await expect(page.getByText("88003344")).toBeVisible();

  await search.fill("LOTION P50");
  await page.getByRole("button", { name: /Зөвлөмжид нэмэх: LOTION P50$/ }).first().click();
  await page.selectOption("#pos-skin", "OILY");
  await page.getByRole("button", { name: "Пигментаци ба толбо" }).click();
  await page.getByRole("button", { name: "Батга ба арьсны согог" }).click();
  await page.fill("#pos-notes", "Тослог, T бүсэд толботой.");
  const instructions = page.getByLabel("Хэрэглэх заавар");
  await expect(instructions).not.toHaveValue(""); // howToUse prefilled
  await instructions.fill("Өглөө, орой хөвөн самбайгаар.");

  // Sale discount 20,000 typed, reason
  await typeMoney(page.getByRole("textbox", { name: "Нийт хөнгөлөлт" }), "20000");
  await page.getByPlaceholder("Хөнгөлөлтийн шалтгаан").fill("Анхны айлчлал");
  const totals = page.locator("dl", { hasText: "Төлөх" }).last();
  await expect(totals).toContainText("420,000₮"); // 250,000 + 190,000 − 20,000

  // ── 3. Autosave → reload → everything is still there ──
  await expect(page.getByLabel("Хадгалагдсан")).toBeVisible({ timeout: 10_000 });
  await expect(page).toHaveURL(/\/admin\/pos\?sale=/);
  await page.reload();
  await expect(page.locator("section", { hasText: "Сагс" }).last()).toContainText("Нүүрний эмчилгээ — Чийгшүүлэх");
  await expect(page.locator("section", { hasText: "Сагс" }).last()).toContainText("LOTION P50");
  await expect(page.getByRole("link", { name: "E2E Номин" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Нийт хөнгөлөлт" })).toHaveValue("20,000");
  await expect(page.locator("#pos-notes")).toHaveValue("Тослог, T бүсэд толботой.");
  await expect(page.getByRole("button", { name: "Пигментаци ба толбо" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Хэрэглэх заавар")).toHaveValue("Өглөө, орой хөвөн самбайгаар.");
  await expect(totals).toContainText("420,000₮");
  await shot(page, "1-pos-after-reload");

  // Leaving and coming back loads the latest draft
  await page.goto("/admin/sales");
  await page.goto("/admin/pos");
  await expect(page.getByRole("link", { name: "E2E Номин" })).toBeVisible();

  // ── 4. Checkout → QPay manual 300,000 + cash 120,000 (tendered 130,000) ──
  await waitAction(page, () => page.click("#pos-checkout"));
  const dlg = page.locator("dialog[open]");
  await expect(dlg.locator("h2").first()).toContainText(/CL-\d{8}-\d{4}/);
  await dlg.getByRole("tab", { name: "QPay" }).click();
  await typeMoney(dlg.locator("#pay-amount"), "300000");
  await dlg.locator("#pay-ref").fill("QP-E2E-0001");
  await waitAction(page, () => dlg.getByRole("button", { name: "Төлбөр бүртгэх" }).click());
  await expect(dlg).toContainText("120,000₮");

  await dlg.getByRole("tab", { name: "Бэлэн" }).click();
  await expect(dlg.locator("#pay-amount")).toHaveValue("120,000");
  await typeMoney(dlg.locator("#pay-tendered"), "130000");
  await expect(dlg).toContainText("Хариулт: 10,000₮");
  await waitAction(page, () => dlg.getByRole("button", { name: "Төлбөр бүртгэх" }).click());
  await expect(dlg).toContainText("Төлбөр бүрэн төлөгдлөө");
  await expect(dlg).toContainText("Хариулт: 10,000₮");

  // ── 5. E-mail: worker sends it, success screen shows SENT, file exists ──
  await expect(dlg).toContainText("e2e-nomin@example.mn руу илгээгдлээ ✓", { timeout: 45_000 });
  await shot(page, "2-paid-email-sent");
  // Other specs (booking) also write e-mails here — find this visit's e-mail by recipient
  const files = readdirSync(E2E_EMAIL_DIR)
    .filter((f) => f.endsWith(".html"))
    .map((f) => readFileSync(join(E2E_EMAIL_DIR, f), "utf8"))
    .filter((h) => h.includes("to: e2e-nomin@example.mn"));
  expect(files).toHaveLength(1);
  const html = files[0]!;
  expect(html).toContain("e2e-nomin@example.mn");
  expect(html).toContain("Пигментаци ба толбо");
  expect(html).toContain("Өглөө, орой хөвөн самбайгаар.");

  // ── 6. Sale detail shows the diagnosis ──
  await dlg.getByRole("link", { name: "Дэлгэрэнгүй" }).click();
  await expect(page.getByText("Айлчлал / оношлогоо")).toBeVisible();
  const main = page.locator("main");
  await expect(main).toContainText("Тослог");
  await expect(main).toContainText("Батга ба арьсны согог");
  await expect(main).toContainText("Тослог, T бүсэд толботой.");
  await expect(main).toContainText("Өглөө, орой хөвөн самбайгаар.");
  await expect(main).toContainText("Илгээсэн");
  await shot(page, "3-sale-detail-visit");

  // ── 7. Close shift: expected 50,000 − 5,000 + 120,000 = 165,000 (type → mouse click → dialog) ──
  await page.goto("/admin/shifts");
  await expect(page.locator("main")).toContainText("165,000₮");
  await typeMoney(page.locator("#sh-counted"), "165000");
  await page.getByRole("button", { name: "Касс хаах" }).click();
  const confirm = page.locator("dialog[open]");
  await expect(confirm.locator("h2")).toHaveText("Касс хаах уу?");
  await expect(confirm.getByTestId("close-diff")).toHaveText("0₮");
  await expect(confirm.locator("#sh-note")).toHaveCount(0); // difference 0 → no note needed
  await shot(page, "4-close-shift-dialog");
  await waitAction(page, () => confirm.getByRole("button", { name: "Касс хаах" }).click());
  await page.waitForURL(/\/admin\/shifts\/[^/]+$/);
  await expect(page.locator(".shift-report")).toContainText("Кассанд байх ёстой");

  expect(pageErrors).toEqual([]);
});

test("closing with a difference requires a note in the dialog", async ({ page }) => {
  await page.goto("/admin/login");
  await page.fill("#email", "manager@example.mn");
  await page.fill("#password", seedPassword());
  await page.click("form button[type=submit]");
  await page.waitForURL(/\/admin$/);

  await page.goto("/admin/shifts");
  await typeMoney(page.locator("#sh-open"), "10000");
  await waitAction(page, () => page.getByRole("button", { name: "Касс нээх" }).click());
  await typeMoney(page.locator("#sh-counted"), "9000");
  await page.getByRole("button", { name: "Касс хаах" }).click();
  const confirm = page.locator("dialog[open]");
  await expect(confirm.getByTestId("close-diff")).toHaveText("-1,000₮");
  const submit = confirm.getByRole("button", { name: "Касс хаах" });
  await expect(submit).toBeDisabled();
  await confirm.locator("#sh-note").fill("1,000 дутсан");
  await waitAction(page, () => submit.click());
  await page.waitForURL(/\/admin\/shifts\/[^/]+$/);
  await expect(page.locator(".shift-report")).toContainText("1,000 дутсан");
});

test("POS: typing a discount and clicking checkout right away uses the typed value", async ({ page }) => {
  await page.goto("/admin/login");
  await page.fill("#email", "manager@example.mn");
  await page.fill("#password", seedPassword());
  await page.click("form button[type=submit]");
  await page.waitForURL(/\/admin$/);

  await page.goto("/admin/pos?new=1");
  const search = page.getByLabel("Каталог хайх");
  await search.fill("BR-CREME-CORPS-200ML");
  await search.press("Enter");
  await expect(page.locator("section", { hasText: "Сагс" }).last()).toContainText("CRÈME CORPS");

  // Reason first (required), then the amount — and click checkout without blur / Enter
  await typeMoney(page.getByRole("textbox", { name: "Нийт хөнгөлөлт" }), "5000");
  await page.getByPlaceholder("Хөнгөлөлтийн шалтгаан").fill("Тест");
  await typeMoney(page.getByRole("textbox", { name: "Нийт хөнгөлөлт" }), "15000");
  await waitAction(page, () => page.click("#pos-checkout"));
  const dlg = page.locator("dialog[open]");
  await expect(dlg).toContainText("175,000₮"); // 190,000 − 15,000
});
