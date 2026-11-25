import Image from "next/image";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge, PageHeader, SegmentedTabs, Table, btnClass, tdClass, thClass } from "@/components/admin/ui";
import type { CollectionKind } from "@/generated/prisma/enums";
import { COLLECTION_KIND_LABELS } from "@/lib/validation/collection";
import { listCollectionOptions } from "@/server/queries/admin";
import { db } from "@/server/db";
import { requirePageOrView } from "@/server/auth/session";

export const metadata = { title: "Ангилал" };
// Нэвтэрсэн хэрэглэгчийн динамик хуудас — request бүрт render (Cache Components validation-аас гаргана)
export const instant = false;

export default async function CollectionsPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { readOnly } = await requirePageOrView("product:write");
  const { kind: rawKind } = await searchParams;
  const kind: CollectionKind = rawKind === "CONCERN" ? "CONCERN" : "CATEGORY";

  // Тоо цөөн (<100) тул pagination шаардлагагүй
  const [rows, tree] = await Promise.all([
    db.collection.findMany({
      where: { kind },
      include: { _count: { select: { products: true, tiles: true } } },
    }),
    listCollectionOptions(),
  ]);
  const byId = new Map(rows.map((r) => [r.id, r]));
  // Модны дарааллаар
  const collections = tree.filter((o) => byId.has(o.id)).map((o) => ({ ...byId.get(o.id)!, depth: o.depth }));

  return (
    <>
      <PageHeader
        eyebrow="Дэлгүүр"
        title="Ангилал"
        description="Дэлгүүрийн цэс: бүтээгдэхүүний ангилал ба арьсны асуудлаар сонгох протокол"
        actions={
          readOnly ? null : (
            <Link href={`/admin/collections/new?kind=${kind}`} className={btnClass("primary")}>
              <Plus className="size-[18px]" strokeWidth={2} /> Ангилал нэмэх
            </Link>
          )
        }
      />
      <SegmentedTabs
        className="mb-6"
        label="Ангиллын төрөл"
        value={kind}
        items={(["CATEGORY", "CONCERN"] as const).map((k) => ({ value: k, label: COLLECTION_KIND_LABELS[k], href: `/admin/collections?kind=${k}` }))}
      />
      <Table>
        <thead>
          <tr>
            <th className={`${thClass} w-14`}><span className="sr-only">Зураг</span></th>
            <th className={thClass}>Нэр</th>
            <th className={thClass}>Цэс</th>
            <th className={`${thClass} text-right`}>Бүтээгдэхүүн</th>
            <th className={`${thClass} text-right`}>Эрэмбэ</th>
            <th className={thClass}>Нүүр хуудас</th>
          </tr>
        </thead>
        <tbody>
          {collections.map((c) => (
            <tr key={c.id} className="hover:bg-canvas">
              <td className={tdClass}>
                <div className="relative size-12 overflow-hidden rounded-xl bg-canvas">
                  {c.tileImage && <Image src={c.tileImage} alt="" fill sizes="48px" unoptimized={c.tileImage.endsWith(".svg")} className="object-cover" />}
                </div>
              </td>
              <td className={tdClass}>
                <span style={{ paddingLeft: c.depth * 20 }} className="inline-block">
                  {c.depth > 0 && <span className="mr-1 text-navy/30">└</span>}
                  <Link href={`/admin/collections/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                </span>
                <p className="font-mono text-[13px] text-ink-faint">{c.slug}</p>
              </td>
              <td className={tdClass}>{c.showInMenu ? <Badge tone="green">Цэсэнд</Badge> : <Badge>Нуугдсан</Badge>}{c._count.tiles > 0 && <span className="ml-1.5"><Badge>{`${c._count.tiles} tile`}</Badge></span>}</td>
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
