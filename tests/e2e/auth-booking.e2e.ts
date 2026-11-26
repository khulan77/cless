import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { E2E_EMAIL_DIR, seedPassword } from "./env";

/**
 * PROMPT 15 (WeSend түлхүүргүй — локал код `.emails/verify-*.txt`-аас):
 *  1) Үйлчлүүлэгч утсаар нэвтэрч онлайн цаг захиална → ресепшн батална → үйлчлүүлэгч цуцална
 *  2) Ажилтныг урих → код → нууц үг → утсаар нэвтрэх
 *  3) Нууц үг сэргээх
 */
test.describe.configure({ mode: "serial" });

const CUSTOMER_PHONE = "99887700";
const STAFF_PHONE = "88776600";
const NEW_PASSWORD = "Cless-E2E-pass-1";

/** Хамгийн сүүлийн код (тухайн хүлээн авагч, зорилгоор) */
async function latestCode(to: string, purpose: string, since = 0): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const files = (await readdir(E2E_EMAIL_DIR).catch(() => [] as string[])).filter((f) => f.startsWith("verify-"));
    const hits: { m: number; code: string }[] = [];
    for (const f of files) {
      const p = join(E2E_EMAIL_DIR, f);
      const txt = await readFile(p, "utf8");
      const m = (await stat(p)).mtimeMs;
      if (m >= since && txt.includes(`to: ${to}`) && txt.includes(`purpose: ${purpose}`)) hits.push({ m, code: /code: (\d+)/.exec(txt)![1]! });
    }
    if (hits.length) return hits.sort((a, b) => b.m - a.m)[0]!.code;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`code not found for ${purpose}`);
}

async function adminLogin(page: Page, identifier = "admin@example.mn", password = seedPassword()) {
  await page.goto("/admin/login");
  await page.fill("#email", identifier);
  await page.fill("#password", password);
  await page.click("form button[type=submit]");
  await page.waitForURL((u) => !u.pathname.endsWith("/login"));
}

test("customer logs in by phone and books online → reception approves → customer cancels", async ({ page, browser }) => {
  // Админ онлайн захиалгыг асаана (анхдагч: ресепшн батална)
  await adminLogin(page);
  await page.goto("/admin/settings/online-booking");
  await page.getByLabel("Онлайн захиалга асаах").check();
  await page.getByRole("button", { name: "Хадгалах" }).click();
  await expect(page.getByText("Хадгалагдлаа.")).toBeVisible();

  const ctx = await browser.newContext();
  const c = await ctx.newPage();
  await c.goto("/booking");
  await c.locator("main button").filter({ hasText: "мин ·" }).first().click();
  await c.getByRole("button", { name: /Хэн ч болно/ }).click();
  // 3 хоногийн дараа — 24 цагийн цуцлах эрхэд багтана
  await c.getByRole("option").nth(3).click();
  const slot = c.locator("main .grid button").filter({ hasText: /^\d{2}:\d{2}$/ }).first();
  await slot.click();
  // Сонгосон огноо (хураангуйгаас) — жагсаалт өнөөдрөөс эсвэл маргаашаас эхэлж болно (оройн цагт)
  const picked = /\d{4}-\d{2}-\d{2}/.exec((await c.getByText(/\d{4}-\d{2}-\d{2} · \d{2}:\d{2}/).first().textContent()) ?? "")![0];

  // Нэвтрэх: утас → код → нэр + зөвшөөрөл
  await c.getByLabel("Утасны дугаар").fill(CUSTOMER_PHONE);
  await c.getByRole("button", { name: "Код авах", exact: true }).click();
  await c.getByLabel("6 оронтой код").fill(await latestCode(CUSTOMER_PHONE, "CUSTOMER_LOGIN"));
  await c.getByRole("button", { name: "Үргэлжлүүлэх", exact: true }).click();
  await expect(c.getByText("Алхам 3/3")).toBeVisible();
  await c.getByLabel("Овог нэр").fill("Онлайн Тест");
  await c.getByText("Цаг захиалах, үйлчилгээ үзүүлэхэд").click();
  await c.locator("main").getByRole("button", { name: "Бүртгүүлэх" }).click();
  await c.getByRole("button", { name: "Захиалгын хүсэлт илгээх" }).click();
  await expect(c.getByText("Захиалгын хүсэлт хүлээн авлаа")).toBeVisible();

  // Ресепшн: Үйлчлүүлэгчид — "Онлайн" шошго; календарьт PENDING → Батлах
  await page.goto("/admin/customers?origin=online");
  await expect(page.getByText("Онлайн Тест")).toBeVisible();
  await c.goto("/account");
  const when = (await c.locator("main li p.text-body").first().textContent()) ?? "";
  await expect(c.getByText("Батлахыг хүлээж буй")).toBeVisible();
  await page.goto(`/admin/calendar?date=${picked}`);
  await page.getByRole("button", { name: /Онлайн Тест/ }).first().click();
  await expect(page.getByText("Онлайн захиалга — батлахыг хүлээж байна")).toBeVisible();
  await page.getByRole("button", { name: "Батлах", exact: true }).click();
  await expect(page.getByRole("button", { name: "Батлах", exact: true })).toHaveCount(0);

  // Үйлчлүүлэгч: баталгаажсан → цуцлах (24 цагаас өмнө)
  await c.reload();
  await expect(c.getByText("Баталгаажсан")).toBeVisible();
  expect(when.length).toBeGreaterThan(0);
  await c.getByRole("button", { name: "Цуцлах", exact: true }).click();
  await c.getByRole("button", { name: "Тийм, цуцлах" }).click();
  await expect(c.getByText("Ирэх цаг алга.")).toBeVisible();
  await ctx.close();

  // Бусад E2E (storefront) онлайн захиалга унтраалттай гэж хүлээдэг — буцааж унтраана
  await page.goto("/admin/settings/online-booking");
  await page.getByLabel("Онлайн захиалга асаах").uncheck();
  await page.getByRole("button", { name: "Хадгалах" }).click();
  await expect(page.getByText("Хадгалагдлаа.")).toBeVisible();
});

test("Нэвтрэх / Бүртгүүлэх: new phone → code → profile → /account; same phone again → code → straight to /account", async ({ browser }) => {
  test.setTimeout(240_000); // 1 минутын кодын хязгаарыг хүлээнэ
  const phone = "99887711";
  const ctx = await browser.newContext();
  const c = await ctx.newPage();
  await c.goto("/login?next=/account");
  await expect(c.getByRole("heading", { name: "Нэвтрэх / Бүртгүүлэх" })).toBeVisible();
  await expect(c.getByText("Алхам 1/3")).toBeVisible();
  await c.getByLabel("Утасны дугаар").fill("+976 9988-7711");
  await c.getByRole("button", { name: "Код авах", exact: true }).click();
  await expect(c.getByText("Алхам 2/3")).toBeVisible();
  await expect(c.getByText("99****11")).toBeVisible();
  await expect(c.getByText(/Дахин илгээх \(\d+ сек\)/)).toBeVisible();
  await c.getByLabel("6 оронтой код").fill(await latestCode(phone, "CUSTOMER_LOGIN"));
  await c.getByRole("button", { name: "Үргэлжлүүлэх", exact: true }).click();
  await expect(c.getByText("Алхам 3/3")).toBeVisible();
  await c.getByLabel("Овог нэр").fill("Шинэ Бүртгэл");
  await c.getByLabel("Имэйл (заавал биш)").fill("shine@example.mn");
  await c.getByText("Цаг захиалах, үйлчилгээ үзүүлэхэд").click();
  await c.locator("main").getByRole("button", { name: "Бүртгүүлэх" }).click();
  await c.waitForURL(/\/account$/);
  await ctx.close();

  // Дахин нэвтрэх — профайлын алхамгүй (1 минутын хязгаар — шинэ context, хүлээлттэй)
  const ctx2 = await browser.newContext();
  const c2 = await ctx2.newPage();
  await c2.waitForTimeout(61_000);
  await c2.goto("/login");
  await c2.getByLabel("Утасны дугаар").fill(phone);
  const since = Date.now() - 1000;
  await c2.getByRole("button", { name: "Код авах", exact: true }).click();
  await expect(c2.getByText("Алхам 2/3")).toBeVisible();
  await c2.getByLabel("6 оронтой код").fill(await latestCode(phone, "CUSTOMER_LOGIN", since));
  await c2.getByRole("button", { name: "Үргэлжлүүлэх", exact: true }).click();
  await c2.waitForURL(/\/account$/);
  await expect(c2.getByText("Алхам 3/3")).toHaveCount(0);
  await ctx2.close();
});

test("admin invites a staff member → code → own password → logs in with phone", async ({ page, browser }) => {
  await adminLogin(page);
  await page.goto("/admin/users/new");
  await page.getByLabel("Нэр", { exact: true }).fill("Урилгын Ажилтан");
  await page.getByLabel("Утас (заавал)").fill(STAFF_PHONE);
  await page.getByRole("button", { name: "Урих" }).click();
  await page.waitForURL(/\/admin\/users\/c/);
  await expect(page.getByText("Урьсан", { exact: true })).toBeVisible();

  const ctx = await browser.newContext();
  const s = await ctx.newPage();
  await s.goto("/admin/activate");
  await s.getByLabel("Утас эсвэл имэйл").fill(STAFF_PHONE);
  await s.getByRole("button", { name: "Код авах", exact: true }).click();
  await s.getByLabel("Код").fill(await latestCode(STAFF_PHONE, "STAFF_INVITE"));
  await s.getByLabel("Шинэ нууц үг").fill(NEW_PASSWORD);
  await s.getByLabel("Нууц үг давтах").fill(NEW_PASSWORD);
  await s.getByRole("button", { name: "Бүртгэл идэвхжүүлэх" }).click();
  await expect(s.getByText("Бүртгэл идэвхжлээ.").first()).toBeVisible();

  await adminLogin(s, STAFF_PHONE, NEW_PASSWORD);
  await expect(s).toHaveURL(/\/admin\/schedule/);
  await ctx.close();
});

test("forgot password: rate limit, code → new password; the old one stops working", async ({ browser }) => {
  const ctx = await browser.newContext();
  const s = await ctx.newPage();
  await s.goto("/admin/forgot");
  await s.getByLabel("Утас эсвэл имэйл").fill(STAFF_PHONE);
  // Идэвхжүүлэх код саяхан очсон — нэг дугаарт 1 минутад 1 код (хязгаар)
  await s.getByRole("button", { name: "Код авах", exact: true }).click();
  await expect(s.getByText("1 минутын дараа").first()).toBeVisible();
  await s.waitForTimeout(61_000);
  await s.getByRole("button", { name: "Код авах", exact: true }).click();
  await s.getByLabel("Код").fill(await latestCode(STAFF_PHONE, "STAFF_RESET"));
  await s.getByLabel("Шинэ нууц үг").fill(`${NEW_PASSWORD}-2`);
  await s.getByLabel("Нууц үг давтах").fill(`${NEW_PASSWORD}-2`);
  await s.getByRole("button", { name: "Нууц үг солих" }).click();
  await expect(s.getByText("Нууц үг солигдлоо.").first()).toBeVisible();

  await s.goto("/admin/login");
  await s.fill("#email", STAFF_PHONE);
  await s.fill("#password", NEW_PASSWORD);
  await s.click("form button[type=submit]");
  await expect(s.getByText("нууц үг буруу")).toBeVisible();
  await s.fill("#password", `${NEW_PASSWORD}-2`);
  await s.click("form button[type=submit]");
  await s.waitForURL(/\/admin\/schedule/);
  await ctx.close();
});
