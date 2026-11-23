import { describe, expect, it } from "vitest";
import { pgPoolConfig } from "./db-config";

describe("pgPoolConfig", () => {
  it("transaction pooler: strips Prisma-only params, no TimeZone option", () => {
    const c = pgPoolConfig("postgresql://u:p@x.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require", { VERCEL: "1" });
    expect(c.connectionString).toBe("postgresql://u:p@x.pooler.supabase.com:6543/postgres?sslmode=require");
    expect(c.options).toBeUndefined();
    expect(c.max).toBe(3);
  });
  it("local: keeps the UTC session option and pg's default pool size", () => {
    const c = pgPoolConfig("postgresql://u@localhost:5432/cless_local", {});
    expect(c.options).toBe("-c TimeZone=UTC");
    expect(c.max).toBe(10);
  });
  it("DB_POOL_MAX wins", () => {
    expect(pgPoolConfig("postgresql://u@h:5432/db", { VERCEL: "1", DB_POOL_MAX: "5" }).max).toBe(5);
    expect(pgPoolConfig("postgresql://u@h:5432/db", { DB_POOL_MAX: "nope" }).max).toBe(10);
  });
});
