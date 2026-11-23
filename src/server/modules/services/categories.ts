import { db } from "@/server/db";

/** Already used category names (admin form suggestions) */
export async function serviceCategories(): Promise<string[]> {
  const rows = await db.service.findMany({ where: { category: { not: null } }, distinct: ["category"], select: { category: true }, orderBy: { category: "asc" } });
  return rows.map((r) => r.category!).filter(Boolean);
}
