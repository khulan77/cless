import { describe, expect, it } from "vitest";
import { checkBuildEnv, checkDbUrl } from "./db-url-check";

const GOOD = "postgresql://user:p%40ss@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true";
const msg = (v: string | undefined) => checkDbUrl("DATABASE_URL", v).map((p) => p.message);

describe("checkDbUrl", () => {
  it("accepts a valid URL", () => expect(msg(GOOD)).toEqual([]));
  it("missing", () => expect(msg(undefined)).toEqual(["DATABASE_URL is not set"]));
  it("quotes", () => {
    expect(msg(`"${GOOD}"`)[0]).toMatch(/starts with a quote character/);
    expect(msg(`${GOOD}'`)[0]).toMatch(/ends with a quote character/);
  });
  it("whitespace and newline", () => {
    expect(msg(` ${GOOD}`)[0]).toMatch(/starts with whitespace/);
    expect(msg(`${GOOD}\n`)[0]).toMatch(/ends with whitespace/);
  });
  it("NAME= prefix", () => expect(msg(`DATABASE_URL=${GOOD}`)[0]).toMatch(/NAME=" prefix/));
  it("wrong scheme", () => expect(msg("mysql://u:p@h/db")[0]).toMatch(/must start with postgresql/));
  it('host "base"', () => expect(msg("postgresql://base/postgres")[0]).toMatch(/host "base"/));
  it("no database", () => expect(msg("postgresql://u:p@host:5432")[0]).toMatch(/no database name/));
  it("never echoes the value", () => {
    for (const v of [`"${GOOD}"`, `DATABASE_URL=${GOOD}`, ` ${GOOD}`]) expect(msg(v).join(" ")).not.toContain("p%40ss");
  });
});

describe("checkBuildEnv", () => {
  it("Vercel requires DIRECT_URL", () => {
    expect(checkBuildEnv({ VERCEL: "1", DATABASE_URL: GOOD }).errors.map((e) => e.message)).toEqual(["DIRECT_URL is not set"]);
  });
  it("elsewhere a missing DIRECT_URL only warns (Docker build)", () => {
    const r = checkBuildEnv({ DATABASE_URL: GOOD });
    expect(r.errors).toEqual([]);
    expect(r.warnings.join(" ")).toMatch(/DIRECT_URL is not set/);
  });
  it("a set but broken DIRECT_URL fails everywhere", () => {
    expect(checkBuildEnv({ DATABASE_URL: GOOD, DIRECT_URL: `"${GOOD}"` }).errors[0].message).toMatch(/DIRECT_URL starts with a quote/);
  });
  it("warns about the session pooler on Vercel", () => {
    const r = checkBuildEnv({ VERCEL: "1", DATABASE_URL: GOOD.replace(":6543", ":5432").replace("?pgbouncer=true", ""), DIRECT_URL: GOOD });
    expect(r.warnings.join(" ")).toMatch(/transaction pooler/);
  });
});
