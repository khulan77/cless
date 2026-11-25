/**
 * STAFF (гоо сайханч) — "Миний самбар" зөвхөн харах (PROMPT 12 A8). Server action бүрийн шаарддаг
 * эрхийг кодоос уншиж, STAFF-д нээлттэй action нь зөвхөн доорх жагсаалтад байгааг шалгана:
 * тэмдэглэл, айлчлалын зураг, өөрийн бүртгэл (нууц үг). Шинэ action нэмэхэд автоматаар шалгагдана.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { can, type Permission } from "@/server/auth/permissions";

const DIR = join(process.cwd(), "src/server/actions");
/** STAFF-д санаатайгаар нээлттэй эрхүүд */
const STAFF_WRITE_ALLOWED: Permission[] = ["customer-note:write", "visit-photo:write", "visit-photo:read", "schedule:own", "me:read"];

/** Бүх STAFF-д нээлттэй action. Шинээр нэмэх бол энд шалтгаантай нь бичнэ. */
const STAFF_ACTIONS = [
  "appointments.ts#apptDetail", // өөрийн цагийг унших (утас/имэйлгүй)
  "notes.ts#noteCreate",
  "notes.ts#noteUpdate",
  "notes.ts#noteDelete",
  "visit-photos.ts#visitPhotoUpload", // A9
  "visit-photos.ts#visitPhotoDelete", // A9
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
        return { id: `${f}#${m[1]}`, perms, signedIn: /requireSignedIn\(|requireUser\(/.test(body) };
      });
    });
}

describe("STAFF cannot run write actions (A8 — read-only dashboard)", () => {
  const all = actions();
  it("finds the actions", () => expect(all.length).toBeGreaterThan(50));

  it.each(all.filter((a) => a.perms.length > 0).map((a) => [a.id, a] as const))("%s", (_id, a) => {
    const staffMay = a.perms.some((p) => can("STAFF", p));
    if (staffMay) expect(a.perms.filter((p) => can("STAFF", p)).every((p) => STAFF_WRITE_ALLOWED.includes(p)), `${a.id}: ${a.perms.join(", ")}`).toBe(true);
  });

  it("exactly these actions are open to STAFF — notes, visit photos and reading their own appointment", () => {
    const open = all.filter((a) => a.perms.some((p) => can("STAFF", p))).map((a) => a.id).sort();
    expect(open).toEqual(STAFF_ACTIONS.filter((id) => all.some((a) => a.id === id)).sort());
  });
});
