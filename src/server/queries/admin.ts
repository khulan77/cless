import "server-only";
import { db } from "@/server/db";

export function listCollectionOptions() {
  return db.collection.findMany({
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, kind: true },
  });
}
