import "server-only";
import { db } from "@/server/db";

export type CollectionOption = {
  id: string;
  name: string;
  slug: string;
  kind: "CATEGORY" | "CONCERN";
  parentId: string | null;
  depth: number;
};

/** Ангиллууд модны дарааллаар (эцэг → хүүхдүүд), гүнтэй нь */
export async function listCollectionOptions(): Promise<CollectionOption[]> {
  const rows = await db.collection.findMany({
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, kind: true, parentId: true },
  });
  const children = new Map<string | null, typeof rows>();
  for (const r of rows) children.set(r.parentId, [...(children.get(r.parentId) ?? []), r]);
  const out: CollectionOption[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const r of children.get(parentId) ?? []) {
      out.push({ ...r, depth });
      if (depth < 3) walk(r.id, depth + 1);
    }
  };
  walk(null, 0);
  // Эцэг нь устсан/холбоосгүй үлдсэн мөрүүд
  for (const r of rows) if (!out.some((o) => o.id === r.id)) out.push({ ...r, depth: 0 });
  return out;
}
