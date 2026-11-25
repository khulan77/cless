import { describe, expect, it } from "vitest";
import { maskEmail, maskPhone, maskTarget } from "./mask";

describe("mask", () => {
  it("never shows the full phone or email", () => {
    expect(maskPhone("99112233")).toBe("99****33");
    expect(maskPhone("+976 9911-2233")).toBe("99****33");
    expect(maskEmail("anna@cless.mn")).toBe("a***@cless.mn");
    expect(maskTarget("anna@cless.mn")).not.toContain("anna");
    expect(maskTarget("99112233")).not.toContain("1122");
  });
});
