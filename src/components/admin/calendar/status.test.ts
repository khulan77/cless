import { describe, expect, it } from "vitest";
import { t } from "@/i18n";
import { saleLabel } from "./status";

const st = t.admin.saleStatus;

describe("saleLabel", () => {
  it("draft without a number shows the status once", () => {
    expect(saleLabel(null, "DRAFT")).toBe(st.DRAFT);
  });
  it("numbered sale shows number and status", () => {
    expect(saleLabel("CL-20261201-0001", "PAID")).toBe(`CL-20261201-0001 · ${st.PAID}`);
    expect(saleLabel("CL-20261201-0002", "DRAFT")).toBe(`CL-20261201-0002 · ${st.DRAFT}`); // unlocked draft keeps its number
  });
});
