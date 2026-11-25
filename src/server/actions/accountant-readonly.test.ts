/**
 * ACCOUNTANT (нягтлан) — менежерийн хэсгийг зөвхөн харна (PROMPT 14 §1). Server action бүрийн шаарддаг
 * эрхийг кодоос уншиж, ACCOUNTANT-д нээлттэй action нь зөвхөн:
 *   - цалин, ирц харах, амралтын өдөр, "Нягтланд илгээх" (өөрийн хэсэг — бичих эрхтэй), эсвэл
 *   - доорх жагсаалтад шалтгаантай бичсэн УНШИХ action
 * гэдгийг шалгана. Шинэ action нэмэхэд автоматаар шалгагдана.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { can, type Permission } from "@/server/auth/permissions";

const DIR = join(process.cwd(), "src/server/actions");

/** Нягтлангийн өөрийн хэсэг — эдгээрээр хамгаалагдсан action бүрэн нээлттэй */
const ACCOUNTANT_DOMAIN: Permission[] = ["payroll:read", "payroll:write", "payroll:settings", "attendance:read", "holiday:write", "report:send"];

/** Менежерийн хэсгээс зөвхөн УНШИХ action-ууд (өгөгдөл өөрчлөхгүй) */
const READ_ACTIONS = [
  "appointments.ts#apptSlots", // календарийн сул цаг харах
  "appointments.ts#apptFreeSearch",
  "appointments.ts#apptDetail",
  "pos.ts#posSearchCustomers", // үйлчлүүлэгч хайх (жагсаалт)
  "pos.ts#findCustomerByPhoneAction",
];

function actions() {
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".ts") && !f.includes(".test.") && f !== "result.ts")
    .flatMap((f) => {
      const src = readFileSync(join(DIR, f), "utf8");
      if (!/^["']use server["']/m.test(src)) return [];
      const hits = [...src.matchAll(/export\s+async\s+function\s+(\w+)\s*\(/g)];
      return hits.map((m, i) => {
        const body = src.slice(m.index!, hits[i + 1]?.index ?? src.length);
        const perms = [...body.matchAll(/require(?:Any)?Permission\(([^)]*)\)/g)].flatMap((x) => [...x[1]!.matchAll(/"([a-z:-]+)"/g)].map((y) => y[1] as Permission));
        return { id: `${f}#${m[1]}`, perms };
      });
    });
}

describe("ACCOUNTANT is read-only outside payroll (PROMPT 14 §1)", () => {
  const all = actions();
  const open = all.filter((a) => a.perms.some((p) => can("ACCOUNTANT", p)));

  it("finds the actions", () => expect(all.length).toBeGreaterThan(50));

  it.each(open.map((a) => [a.id, a] as const))("%s", (id, a) => {
    const viaDomain = a.perms.some((p) => can("ACCOUNTANT", p) && ACCOUNTANT_DOMAIN.includes(p));
    expect(viaDomain || READ_ACTIONS.includes(id), `${id} (${a.perms.join(", ")}) — нягтланд нээлттэй бичих action`).toBe(true);
  });

  it("no write permission of the manager area is granted", () => {
    const writes = ["appointment:write", "appointment:status", "customer:write", "visit:write", "pos:use", "sale:create", "sale:refund", "sale:void-paid", "sale:seller", "shift:own", "shift:all", "stock:write", "product:write", "service:write", "price:write", "settings:write", "user:write", "staff-schedule:write", "room:write", "attendance:write", "inquiry:manage"] as const;
    for (const p of writes) expect(can("ACCOUNTANT", p), p).toBe(false);
  });

  it("never sees visit photos (health data)", () => {
    expect(can("ACCOUNTANT", "visit-photo:read")).toBe(false);
    expect(can("ACCOUNTANT", "visit-photo:write")).toBe(false);
  });

  it("the read allowlist has no stale entries", () => {
    for (const id of READ_ACTIONS) expect(all.some((a) => a.id === id), id).toBe(true);
  });
});
