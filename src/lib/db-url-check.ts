/**
 * Shape check for DATABASE_URL / DIRECT_URL — run before `next build` (scripts/check-db-url.ts).
 *
 * A malformed value fails late and cryptically: node-postgres falls back to resolving it relative to
 * "postgres://base", so Prisma reports "Can't reach database server at base". Typical causes when
 * pasting into a hosting dashboard: surrounding quotes, spaces, or the "DATABASE_URL=" prefix.
 * Messages never include the value (it holds the password).
 */
export type DbUrlProblem = { name: string; message: string };

export function checkDbUrl(name: string, value: string | undefined): DbUrlProblem[] {
  const problem = (message: string): DbUrlProblem[] => [{ name, message: `${name} ${message}` }];
  if (value === undefined || value === "") return problem("is not set");

  if (/^["'`]/.test(value)) return problem("starts with a quote character — paste the URL without quotes");
  if (/["'`]$/.test(value)) return problem("ends with a quote character — paste the URL without quotes");
  if (/^\s/.test(value)) return problem("starts with whitespace");
  if (/\s$/.test(value)) return problem("ends with whitespace (often a trailing newline)");
  if (/^[A-Z][A-Z0-9_]*\s*=/.test(value)) return problem(`includes a "NAME=" prefix — the value must start with postgresql://`);
  if (/\s/.test(value)) return problem("contains whitespace");
  if (!/^postgres(ql)?:\/\//.test(value)) return problem("must start with postgresql:// or postgres://");

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return problem("is not a valid URL — special characters in the password (@ : / ? # %) must be percent-encoded");
  }
  if (!url.hostname) return problem("has no host");
  if (url.hostname === "base") return problem('has host "base" — the value is malformed (check quotes and the NAME= prefix)');
  if (!url.pathname || url.pathname === "/") return problem("has no database name (…/postgres)");
  return [];
}

/** Warnings that do not fail the build */
export function dbUrlWarnings(env: Record<string, string | undefined>): string[] {
  const out: string[] = [];
  const db = env.DATABASE_URL;
  if (env.VERCEL && db && checkDbUrl("DATABASE_URL", db).length === 0) {
    const url = new URL(db);
    if (url.hostname.endsWith(".pooler.supabase.com") && url.port !== "6543")
      out.push("DATABASE_URL uses the Supabase session pooler (5432). On Vercel prefer the transaction pooler: port 6543 with ?pgbouncer=true.");
  }
  return out;
}

/**
 * DATABASE_URL is always required. DIRECT_URL (migrations only) is required on Vercel; elsewhere a
 * missing one is only a warning — the Docker build passes DATABASE_URL alone.
 */
export function checkBuildEnv(env: Record<string, string | undefined>): { errors: DbUrlProblem[]; warnings: string[] } {
  const errors = [...checkDbUrl("DATABASE_URL", env.DATABASE_URL)];
  const warnings = dbUrlWarnings(env);
  const direct = checkDbUrl("DIRECT_URL", env.DIRECT_URL);
  if (env.DIRECT_URL !== undefined && env.DIRECT_URL !== "") errors.push(...direct);
  else if (env.VERCEL) errors.push(...direct);
  else warnings.push("DIRECT_URL is not set (only needed for prisma migrate).");
  return { errors, warnings };
}
