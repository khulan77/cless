import { describe, expect, it } from "vitest";
import { prodKeysIn } from "./prod-env-warning";

describe("prod түлхүүрийн анхааруулга", () => {
  it("зөвхөн жинхэнэ түлхүүрийн нэрийг илрүүлнэ", () => {
    expect(
      prodKeysIn({
        DATABASE_URL: "postgresql://u@localhost:5432/cless_local",
        DIRECT_URL: "postgresql://u:p@aws-1.pooler.supabase.com:5432/postgres",
        SUPABASE_URL: "https://x.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "",
        WESEND_API_KEY: "ws_test_abc",
        RESEND_API_KEY: "re_live",
      }),
    ).toEqual(["DIRECT_URL", "SUPABASE_URL", "RESEND_API_KEY"]);
    expect(prodKeysIn({ WESEND_API_KEY: "ws_live_x" })).toEqual(["WESEND_API_KEY"]);
  });
});
