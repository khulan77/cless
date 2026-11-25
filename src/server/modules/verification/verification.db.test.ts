/** Нэг удаагийн код: хязгаар, оролдлого, хугацаа, нэг удаа ашиглах (локал горим — WeSend түлхүүргүй) */
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { resetDb } from "../../../../tests/db-helpers";
import { checkCode, LIMITS, startCode } from "./service";

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "cless-verify-"));
  process.env.EMAIL_FILE_DIR = dir;
  delete process.env.WESEND_API_KEY;
});
afterAll(async () => {
  delete process.env.EMAIL_FILE_DIR;
  await rm(dir, { recursive: true, force: true });
});
beforeEach(() => resetDb().then(() => db.verification.deleteMany()));

const start = (to = "99112233", ip = "1.1.1.1", now?: Date) => startCode({ purpose: "CUSTOMER_LOGIN", to, ip }, now);

describe("нэг удаагийн код", () => {
  it("код зөв → APPROVED, дахин ашиглахгүй; утас/код DB-д нээлттэй хадгалагдахгүй", async () => {
    const s = await start();
    expect(s.mask).toBe("99****33");
    const row = await db.verification.findUniqueOrThrow({ where: { id: s.id } });
    expect(JSON.stringify(row)).not.toContain("99112233");
    expect(JSON.stringify(row)).not.toContain(s.devCode!);
    await expect(checkCode({ id: s.id, code: s.devCode!, purpose: "CUSTOMER_LOGIN", to: "99112233" })).resolves.toBeTruthy();
    await expect(checkCode({ id: s.id, code: s.devCode!, purpose: "CUSTOMER_LOGIN" })).rejects.toThrow(/хүчингүй/);
  });

  it("өөр утас, өөр зорилгоор ашиглахгүй", async () => {
    const s = await start();
    await expect(checkCode({ id: s.id, code: s.devCode!, purpose: "CUSTOMER_LOGIN", to: "88112233" })).rejects.toThrow(/хүчингүй/);
    await expect(checkCode({ id: s.id, code: s.devCode!, purpose: "STAFF_INVITE" })).rejects.toThrow(/хүчингүй/);
  });

  it("5 буруу оролдлогын дараа хүчингүй; хугацаа дууссан", async () => {
    const s = await start();
    const wrong = s.devCode === "000000" ? "111111" : "000000";
    for (let i = 0; i < 4; i++) await expect(checkCode({ id: s.id, code: wrong, purpose: "CUSTOMER_LOGIN" })).rejects.toThrow(/оролдлого үлдлээ/);
    await expect(checkCode({ id: s.id, code: wrong, purpose: "CUSTOMER_LOGIN" })).rejects.toThrow(/Хэт олон удаа/);
    await expect(checkCode({ id: s.id, code: s.devCode!, purpose: "CUSTOMER_LOGIN" })).rejects.toThrow();

    const t = new Date(Date.now() - 10 * 60_000);
    const old = await start("88112233", "2.2.2.2", t);
    await expect(checkCode({ id: old.id, code: old.devCode!, purpose: "CUSTOMER_LOGIN" })).rejects.toThrow(/хугацаа дууссан/);
  });

  it("хязгаар: утсанд 1 минутад 1, 1 цагт 5; IP-д 1 цагт 20", async () => {
    await start();
    await expect(start()).rejects.toThrow(/1 минутын дараа/);
    // 1 цагийн цонх: өмнөх 4-ийг цагаар хуучруулна
    await db.verification.updateMany({ data: { createdAt: new Date(Date.now() - 5 * 60_000) } });
    for (let i = 0; i < LIMITS.perTargetHour - 1; i++) {
      await start();
      await db.verification.updateMany({ data: { createdAt: new Date(Date.now() - 5 * 60_000) } });
    }
    await expect(start()).rejects.toThrow(/1 цагт хэт олон/);

    await db.verification.deleteMany();
    for (let i = 0; i < LIMITS.perIpHour; i++) await start(`9${String(1000000 + i)}`, "3.3.3.3");
    await expect(start("95550000", "3.3.3.3")).rejects.toThrow(/Хэт олон хүсэлт/);
  });
});
