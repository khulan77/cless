import "server-only";

/**
 * generateStaticParams for DB-backed [slug] routes.
 *
 * Cache Components needs at least one param per dynamic route (an empty array is a build error —
 * node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-static-params.md
 * "With Cache Components"). So:
 *   - DB has rows      → those slugs (up to `limit`; the rest render on first visit, then cached)
 *   - DB empty / down  → one placeholder slug that the page turns into notFound() before any query,
 *                        and a build warning — the build does not fail because of these routes
 */
export const PLACEHOLDER_SLUG = "__placeholder__";

export const isPlaceholderSlug = (slug: string) => slug === PLACEHOLDER_SLUG;

export async function staticSlugParams(route: string, load: () => Promise<string[]>, limit = 200): Promise<{ slug: string }[]> {
  let slugs: string[] = [];
  try {
    slugs = await load();
  } catch (e) {
    const code = (e as { code?: string })?.code ?? (e as Error)?.name ?? "error";
    console.warn(`[build] ${route}: could not list slugs from the database (${code}) — pages will render on first visit.`);
  }
  if (slugs.length === 0) return [{ slug: PLACEHOLDER_SLUG }];
  return slugs.slice(0, limit).map((slug) => ({ slug }));
}
