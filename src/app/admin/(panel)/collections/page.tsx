import Image from "next/image";
import Link from "next/link";
import { Badge, PageHeader, Table, btnClass, tdClass, thClass } from "@/components/admin/ui";
import type { CollectionKind } from "@/generated/prisma/enums";
import { COLLECTION_KIND_LABELS, NAV_GROUPS } from "@/lib/validation/collection";
import { db } from "@/server/db";
import { requirePagePermission } from "@/server/auth/session";

export const metadata = { title: "Ангилал" };
// Нэвтэрсэн хэрэглэгчийн динамик хуудас — request бүрт render (Cache Components validation-аас гаргана)
export const instant = false;

export default async function CollectionsPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  await requirePagePermission("product:write");
  const { kind: rawKind } = await searchParams;
  const kind: CollectionKind = rawKind === "CONCERN" ? "CONCERN" : "CATEGORY";

  // Тоо цөөн (<100) тул pagination шаардлагагүй
  const collections = await db.collection.findMany({
    where: { kind },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: true } } },
  });

  return (
    <>
      <PageHeader
        title="Ангилал"
        description="Бүтээгдэхүүний ангилал ба арьсны асуудал (протокол)"
        actions={<Link href={`/admin/collections/new?kind=${kind}`} className={btnClass("primary")}>+ Шинэ</Link>}
      />
      <div className="mb-4 inline-flex rounded-md border border-line bg-white p-0.5" role="tablist">
        {(["CATEGORY", "CONCERN"] as const).map((k) => (
          <Link
            key={k}
            href={`/admin/collections?kind=${k}`}
            role="tab"
            aria-selected={k === kind}
            className={`rounded px-3 py-1.5 text-[13px] ${k === kind ? "bg-navy text-white" : "text-navy/70 hover:bg-navy/5"}`}
          >
            {COLLECTION_KIND_LABELS[k]}
          </Link>
        ))}
      </div>
      <Table>
        <thead>
          <tr>
            <th className={`${thClass} w-14`}><span className="sr-only">Зураг</span></th>
            <th className={thClass}>Нэр</th>
            <th className={thClass}>Цэсний бүлэг</th>
            <th className={`${thClass} text-right`}>Бүтээгдэхүүн</th>
            <th className={`${thClass} text-right`}>Эрэмбэ</th>
            <th className={thClass}>Нүүр хуудас</th>
          </tr>
        </thead>
        <tbody>
          {collections.map((c) => (
            <tr key={c.id} className="hover:bg-navy/[0.02]">
              <td className={tdClass}>
                <div className="relative size-10 overflow-hidden rounded bg-card">
                  {c.image && <Image src={c.image} alt="" fill sizes="40px" unoptimized={c.image.endsWith(".svg")} className="object-cover" />}
                </div>
              </td>
              <td className={tdClass}>
                <Link href={`/admin/collections/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                <p className="font-mono text-[11px] text-navy/45">{c.slug}</p>
              </td>
              <td className={tdClass}>{c.navGroup ? NAV_GROUPS[c.navGroup as keyof typeof NAV_GROUPS] ?? c.navGroup : "—"}</td>
              <td className={`${tdClass} text-right tabular-nums`}>{c._count.products}</td>
              <td className={`${tdClass} text-right tabular-nums`}>{c.sortOrder}</td>
              <td className={tdClass}>{c.showOnHome ? <Badge tone="green">Харагдана</Badge> : <Badge>Үгүй</Badge>}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
