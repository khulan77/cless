/**
 * Pre-build check of DATABASE_URL / DIRECT_URL (package.json "prebuild").
 *   bun scripts/check-db-url.ts
 * Prints what is wrong without ever printing the values; exit 1 on errors. See src/lib/db-url-check.ts.
 */
import { checkBuildEnv } from "../src/lib/db-url-check";

const { errors, warnings } = checkBuildEnv(process.env);
for (const w of warnings) console.warn(`⚠ ${w}`);
if (errors.length) {
  console.error("✖ Database environment is invalid:");
  for (const e of errors) console.error(`  - ${e.message}`);
  console.error("Fix it in the hosting dashboard (Vercel → Settings → Environment Variables) and redeploy.");
  process.exit(1);
}
console.log("✓ DATABASE_URL / DIRECT_URL look valid");
