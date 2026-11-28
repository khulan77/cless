import { describe, expect, it } from "vitest";
import { qpaySettingsSchema } from "@/server/modules/settings/schema";
import { qpayAccountConfigured, qpayAccountEnv } from "./index";
import { defaultQPayAccount, qpayAccountViews, resolveQPayAccount } from "./accounts";

const COMMON = { QPAY_BASE_URL: "https://merchant-sandbox.qpay.mn", QPAY_CALLBACK_SECRET: "s".repeat(32) };

describe("QPay данс — ENV", () => {
  it("хуучин нэг дансны QPAY_* → A; B тохируулаагүй", () => {
    const env = { ...COMMON, QPAY_USERNAME: "u", QPAY_PASSWORD: "p", QPAY_INVOICE_CODE: "C" } as unknown as NodeJS.ProcessEnv;
    expect(qpayAccountEnv("A", env)).toEqual({ username: "u", password: "p", invoiceCode: "C", invoiceReceiverCode: undefined });
    expect(qpayAccountEnv("B", env)).toBeNull();
    expect(qpayAccountConfigured("A", env)).toBe(true);
    expect(qpayAccountConfigured("B", env)).toBe(false);
  });
  it("QPAY_A_* нь хуучнаас давуу; QPAY_B_* — B", () => {
    const env = { ...COMMON, QPAY_USERNAME: "old", QPAY_PASSWORD: "p", QPAY_INVOICE_CODE: "C", QPAY_A_USERNAME: "a", QPAY_A_PASSWORD: "ap", QPAY_A_INVOICE_CODE: "AC", QPAY_B_USERNAME: "b", QPAY_B_PASSWORD: "bp", QPAY_B_INVOICE_CODE: "BC" } as unknown as NodeJS.ProcessEnv;
    expect(qpayAccountEnv("A", env)?.username).toBe("a");
    expect(qpayAccountEnv("B", env)).toMatchObject({ username: "b", invoiceCode: "BC" });
  });
  it("нийтлэг BASE_URL / CALLBACK_SECRET байхгүй бол тохируулаагүй", () => {
    expect(qpayAccountConfigured("A", { QPAY_A_USERNAME: "a", QPAY_A_PASSWORD: "p", QPAY_A_INVOICE_CODE: "C" } as unknown as NodeJS.ProcessEnv)).toBe(false);
  });
});

describe("QPay данс — сонголт", () => {
  const settings = qpaySettingsSchema.parse({ accounts: { A: { label: "Компанийн данс", enabled: true }, B: { label: "Захирлын данс", enabled: true } }, defaultAccount: "B" });
  it("B түлхүүргүй → «Тохируулаагүй», сонгох боломжгүй; анхдагч A руу буцна", () => {
    const views = qpayAccountViews(settings, "api", (a) => a === "A");
    expect(views.find((v) => v.key === "B")).toMatchObject({ configured: false, selectable: false });
    expect(resolveQPayAccount(views, "B", "B")).toBeNull();
    expect(defaultQPayAccount(views, "B")).toBe("A");
  });
  it("A гар горимд түлхүүргүй ч сонгогдоно (терминал); API горимд үгүй", () => {
    expect(qpayAccountViews(settings, "manual", () => false).find((v) => v.key === "A")!.selectable).toBe(true);
    expect(qpayAccountViews(settings, "api", () => false).find((v) => v.key === "A")!.selectable).toBe(false);
  });
  it("хоёулаа бэлэн — анхдагч тохиргооны данс, сонгосныг хүндэтгэнэ", () => {
    const views = qpayAccountViews(settings, "api", () => true);
    expect(resolveQPayAccount(views, "B", null)).toBe("B");
    expect(resolveQPayAccount(views, "B", "A")).toBe("A");
  });
  it("хуучин тохиргоо ({ mode }) — A идэвхтэй, B идэвхгүй, анхдагч A", () => {
    expect(qpaySettingsSchema.parse({ mode: "api" })).toMatchObject({ accounts: { A: { enabled: true }, B: { enabled: false } }, defaultAccount: "A" });
  });
});
