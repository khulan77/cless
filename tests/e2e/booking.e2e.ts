import { expect, test, type Locator, type Page } from "@playwright/test";
import { addDays, formatHm, ubDateKey, ubMinuteOfDay } from "../../src/lib/time";
import { seedPassword } from "./env";

/**
 * Booking flow on the seeded E2E DB:
 * new appointment today → the overlapping time is not offered → tomorrow's appointment cannot be opened in POS →
 * "Ирсэн — POS нээх" today → arrived card is locked (note only) → pay cash → DONE → STAFF sees only their own schedule.
 */
test.describe.configure({ mode: "serial" });

async function login(page: Page, email: string) {
  await page.goto("/admin/login");
  await page.fill("#email", email);
  await page.fill("#password", seedPassword());
  await page.click("form button[type=submit]");
  await page.waitForURL(/\/admin(\/schedule)?$/);
}

async function waitAction(page: Page, click: () => Promise<void>) {
  const res = page.waitForResponse((r) => r.request().method() === "POST" && Boolean(r.request().headers()["next-action"]));
  await click();
  return res;
}

async function typeMoney(input: Locator, digits: string) {
  await input.click();
  await input.press("ControlOrMeta+a");
  await input.press("Backspace");
  await input.pressSequentially(digits, { delay: 10 });
}

const TODAY = ubDateKey();
const TOMORROW = addDays(TODAY, 1);
/** Next 15-minute slot at least 30 min from now (UB). The E2E DB is open 00:00–24:00 every day. */
const T = Math.ceil((ubMinuteOfDay(new Date()) + 30) / 15) * 15;
const hm = (m: number) => formatHm(m);
// T..T+60 service + 10 min buffer; the check below also needs T+75 (+70) to fit before midnight
const TOO_LATE = T + 75 + 70 > 24 * 60;

test("calendar → overlap refused → same-day POS → paid → DONE", async ({ page }) => {
  test.skip(TOO_LATE, "UB time is too close to midnight for a same-day booking");
  page.on("dialog", (d) => {
    throw new Error(`Unexpected browser dialog: ${d.message()}`);
  });
  await login(page, "manager@example.mn");

  // Cash payments need an open shift
  await page.goto("/admin/shifts");
  await typeMoney(page.locator("#sh-open"), "0");
  await waitAction(page, () => page.getByRole("button", { name: "Касс нээх" }).click());
  await expect(page.getByText("Нээлттэй ээлж")).toBeVisible();

  // ── 1. New appointment today from an empty cell (Сараа, T) ──
  await page.goto(`/admin/calendar?date=${TODAY}`);
  await expect(page.getByText("Гоо сайханч Сараа").first()).toBeVisible();
  await page.getByRole("button", { name: `Гоо сайханч Сараа, ${hm(T)} — шинэ цаг` }).click();
  const dlg = page.locator("dialog[open]");
  await expect(dlg.locator("h2").first()).toHaveText("Цаг захиалах");
  await dlg.getByPlaceholder("Утас эсвэл нэрээр хайх…").fill("99110002");
  await dlg.getByRole("button", { name: /Туршилт Болор/ }).click();
  await dlg.getByRole("radio", { name: /^Нүүрний эмчилгээ — Чийгшүүлэх/ }).click();
  await expect(dlg.getByRole("option", { name: hm(T), selected: true })).toBeVisible();
  await waitAction(page, () => dlg.getByRole("button", { name: "Хадгалах" }).click());
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  const card = page.getByRole("button", { name: new RegExp(`${hm(T)}–${hm(T + 60)}\\s*Туршилт Болор`) });
  await expect(card).toBeVisible();

  // ── 2. Overlap: T+30 and T+60 (inside the 10-min buffer) are not offered for Сараа ──
  await page.getByRole("button", { name: "Цаг захиалах", exact: true }).click();
  const dlg2 = page.locator("dialog[open]");
  await dlg2.getByRole("radio", { name: /^Нүүрний эмчилгээ — Чийгшүүлэх/ }).click();
  await dlg2.locator("#ad-date").fill(TODAY);
  await expect(dlg2.locator("#ad-staff option", { hasText: "Гоо сайханч Сараа" })).toHaveCount(1);
  await dlg2.locator("#ad-staff").selectOption({ label: "Гоо сайханч Сараа" });
  const chips = dlg2.getByRole("listbox");
  await expect(chips.getByRole("option", { name: hm(T + 75) })).toBeVisible();
  await expect(chips.getByRole("option", { name: hm(T + 30) })).toHaveCount(0);
  await expect(chips.getByRole("option", { name: hm(T + 60) })).toHaveCount(0);
  await dlg2.getByRole("button", { name: "Болих" }).click();

  // ── 3. Tomorrow's appointment: "Ирсэн — POS нээх" is disabled (only on the appointment day) ──
  await page.goto(`/admin/calendar?date=${TOMORROW}`);
  await page.getByRole("button", { name: "Гоо сайханч Номин, 10:00 — шинэ цаг" }).click();
  const dlg3 = page.locator("dialog[open]");
  await dlg3.getByPlaceholder("Утас эсвэл нэрээр хайх…").fill("99110003");
  await dlg3.getByRole("button", { name: /Туршилт Номин/ }).click();
  await dlg3.getByRole("radio", { name: /^Арьсны оношлогоо ба зөвлөгөө/ }).click();
  await expect(dlg3.getByRole("option", { name: "10:00", selected: true })).toBeVisible();
  await waitAction(page, () => dlg3.getByRole("button", { name: "Хадгалах" }).click());
  await page.getByRole("button", { name: /10:00–10:30\s*Туршилт Номин/ }).click();
  const future = page.getByRole("dialog", { name: "Дэлгэрэнгүй" });
  await expect(future.getByRole("button", { name: "Ирсэн — POS нээх" })).toBeDisabled();
  await expect(future).toContainText("Зөвхөн цагийн өдөр");
  await expect(future.getByRole("button", { name: "Гараар дуусгах" })).toHaveCount(0); // manager + BOOKED
  await page.keyboard.press("Escape");

  // ── 4. Today: "Ирсэн — POS нээх" → draft prefilled ──
  await page.goto(`/admin/calendar?date=${TODAY}`);
  await card.click();
  const panel = page.getByRole("dialog", { name: "Дэлгэрэнгүй" });
  await expect(panel).toContainText("Туршилт Болор");
  await expect(panel).toContainText("99110002"); // MANAGER sees the phone
  await panel.getByRole("button", { name: "Ирсэн — POS нээх" }).click();
  await page.waitForURL(/\/admin\/pos\?sale=/);
  const posUrl = page.url();
  const cart = page.locator("section", { hasText: "Сагс" }).last();
  await expect(cart).toContainText("Нүүрний эмчилгээ — Чийгшүүлэх");
  await expect(cart.getByLabel("Ажилтан").locator("option:checked")).toHaveText("Гоо сайханч Сараа");
  await expect(page.getByRole("link", { name: "Туршилт Болор" })).toBeVisible();

  // ── 5. Arrived: card is not draggable, no "Засах", only the note; sale label shown once ──
  await page.goto(`/admin/calendar?date=${TODAY}`);
  await expect(card).toHaveAttribute("draggable", "false");
  await card.click();
  await expect(panel).toContainText("Ирсэн");
  await expect(panel.getByRole("button", { name: "Засах" })).toHaveCount(0);
  await expect(panel).toContainText("Ирсэн цагийн цаг, ажилтныг POS-оос засна");
  await panel.getByLabel("Тэмдэглэл").fill("Арьс мэдрэг");
  await waitAction(page, () => panel.getByRole("button", { name: "Тэмдэглэл хадгалах" }).click());
  await expect(panel.getByRole("link", { name: "Хадгалсан (төлөгдөөгүй)", exact: true })).toBeVisible();
  await expect(panel).not.toContainText("Хадгалсан (төлөгдөөгүй) · Хадгалсан (төлөгдөөгүй)");
  await panel.getByRole("button", { name: "POS-д үргэлжлүүлэх" }).click();
  await page.waitForURL(posUrl);

  // ── 6. Pay cash ──
  await waitAction(page, () => page.click("#pos-checkout"));
  const pay = page.locator("dialog[open]");
  await expect(pay.locator("h2").first()).toContainText(/CL-\d{8}-\d{4}/);
  await pay.getByRole("tab", { name: "Бэлэн" }).click();
  await typeMoney(pay.locator("#pay-tendered"), "250000");
  await waitAction(page, () => pay.getByRole("button", { name: "Төлбөр бүртгэх" }).click());
  await expect(pay).toContainText("Төлбөр бүрэн төлөгдлөө");

  // ── 7. Appointment is DONE; sale shows "number · status" ──
  await page.goto(`/admin/calendar?date=${TODAY}`);
  await card.click();
  await expect(panel).toContainText("Дууссан");
  await expect(panel.getByRole("link", { name: /^CL-\d{8}-\d{4} · Төлсөн$/ })).toBeVisible();

  // Close the shift so the next spec can open its own (0 + 250,000)
  await page.goto("/admin/shifts");
  await typeMoney(page.locator("#sh-counted"), "250000");
  await page.getByRole("button", { name: "Касс хаах" }).click();
  await waitAction(page, () => page.locator("dialog[open]").getByRole("button", { name: "Касс хаах" }).click());
  await page.waitForURL(/\/admin\/shifts\/[^/]+$/);
});

test("STAFF sees only their own appointments, without contact details", async ({ page }) => {
  test.skip(TOO_LATE, "depends on the booking test");
  await login(page, "staff1@example.mn"); // Гоо сайханч Сараа
  await page.goto("/admin/schedule");
  const main = page.locator("main");
  await expect(main).toContainText("Туршилт Болор");
  await expect(main).toContainText("Нүүрний эмчилгээ — Чийгшүүлэх");
  await expect(main).not.toContainText("99110002");
  // Календарь (бүх ажилтны цаг) STAFF-д хаалттай. PPR-ийн streaming-ээс болж HTTP статус 200 байж
  // болох тул хуудасны агуулгаар шалгана (forbidden() → 403 хуудас).
  await page.goto("/admin/calendar");
  await expect(page.getByRole("heading", { name: "Эрх хүрэлцэхгүй байна" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Гоо сайханч Номин");
});

test("another STAFF member does not see Сараа's appointment", async ({ page }) => {
  await login(page, "staff2@example.mn"); // Гоо сайханч Номин (fresh browser context)
  await page.goto("/admin/schedule");
  const main = page.locator("main");
  await expect(main).toContainText("Миний хуваарь");
  await expect(main).not.toContainText("Нүүрний эмчилгээ — Чийгшүүлэх · "); // no other staff's cards
  await expect(main).not.toContainText("10:00–11:00");
});
