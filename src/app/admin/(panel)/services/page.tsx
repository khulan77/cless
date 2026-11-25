import { Plus, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { Badge, ButtonLink, EmptyState, ListRow, PageHeader, PillLink, SegmentedTabs, inputClass } from "@/components/admin/ui";
import { str } from "@/components/admin/Pagination";
import type { Prisma } from "@/generated/prisma/client";
import { t } from "@/i18n";
import { formatMNT } from "@/lib/money";
import { db } from "@/server/db";
import { requirePageOrView } from "@/server/auth/session";

export const metadata = { title: "Үйлчилгээ" };
// Нэвтэрсэн хэрэглэгчийн динамик хуудас — request бүрт render (Cache Components validation-аас гаргана)
export const instant = false;

const L = t.admin.servicesList;
const D = t.admin.calendar.dialog;
type Tab = "active" | "archived" | "all";

export default async function ServicesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { readOnly } = await requirePageOrView("service:write");
  const sp = await searchParams;
  const q = str(sp.q);
  const tab: Tab = sp.status === "archived" ? "archived" : sp.status === "all" ? "all" : "active";

  const where: Prisma.ServiceWhereInput = {
    ...(q && { name: { contains: q, mode: "insensitive" } }),
    ...(tab === "active" && { isActive: true }),
    ...(tab === "archived" && { isActive: false }),
  };
  const services = await db.service.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { consumables: true } } },
  });

  // Group by category (first appearance order; uncategorised last)
  const groups: { name: string | null; items: typeof services }[] = [];
  for (const s of services) {
    const name = s.category?.trim() || null;
    const g = groups.find((x) => x.name === name);
    if (g) g.items.push(s);
    else groups.push({ name, items: [s] });
  }
  groups.sort((a, b) => (a.name === null ? 1 : 0) - (b.name === null ? 1 : 0));
  const href = (status: Tab) => `/admin/services?${new URLSearchParams({ ...(status !== "active" && { status }), ...(q && { q }) }).toString()}`;

  return (
    <>
      <PageHeader
        eyebrow="СПА"
        title={L.title}
        description={L.description(groups.filter((g) => g.name).length, services.length)}
        actions={
          readOnly ? null : (
            <ButtonLink href="/admin/services/new">
              <Plus className="size-[18px]" strokeWidth={2} /> {L.add}
            </ButtonLink>
          )
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <SegmentedTabs
          label={L.title}
          value={tab}
          items={(["active", "archived", "all"] as const).map((v) => ({ value: v, label: L.tabs[v], href: href(v) }))}
        />
        <form action="/admin/services" className="relative ml-auto w-full max-w-xs">
          {tab !== "active" && <input type="hidden" name="status" value={tab} />}
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-ink-faint" strokeWidth={1.75} aria-hidden />
          <input name="q" defaultValue={q} placeholder={L.search} aria-label={L.search} className={`${inputClass} w-full pl-10`} />
        </form>
      </div>

      {services.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title={q ? L.noMatch : L.empty}
          action={
            !q && !readOnly && (
              <ButtonLink href="/admin/services/new">
                <Plus className="size-[18px]" strokeWidth={2} /> {L.add}
              </ButtonLink>
            )
          }
        />
      ) : (
        <div className="space-y-9">
          {groups.map((g) => (
            <section key={g.name ?? "other"} aria-label={g.name ?? L.other}>
              <header className="mb-3 flex items-center gap-3">
                <span aria-hidden className="size-2 rounded-full bg-champagne" />
                <h2 className="font-display text-[22px] font-semibold text-ink">{g.name ?? L.other}</h2>
                <span className="text-[14px] text-ink-soft tabular-nums">{g.items.length}</span>
                {!readOnly && <Link
                  href={`/admin/services/new${g.name ? `?category=${encodeURIComponent(g.name)}` : ""}`}
                  className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[14px] font-medium text-ink-soft hover:bg-ink/[0.05] hover:text-ink"
                >
                  <Plus className="size-4" strokeWidth={2} /> {L.addIn}
                </Link>}
              </header>
              <div className="space-y-2">
                {g.items.map((s) => (
                  <ListRow
                    key={s.id}
                    title={s.name}
                    letterSeed={s.category ?? s.name}
                    href={`/admin/services/${s.id}`}
                    tag={
                      <>
                        {!s.isActive && <Badge>{L.archived}</Badge>}
                        {s.isActive && !s.isPublic && <Badge tone="amber">{L.hidden}</Badge>}
                        {s.isActive && !s.bookable && <Badge tone="info">{L.notBookable}</Badge>}
                      </>
                    }
                    meta={
                      <>
                        {formatMNT(s.price)}
                        {s.priceFrom ? "+" : ""} · {D.duration(s.durationMin)}
                        {s._count.consumables > 0 && <> · {L.consumables(s._count.consumables)}</>}
                      </>
                    }
                    actions={readOnly ? null : <PillLink href={`/admin/services/${s.id}`}>{L.edit}</PillLink>}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
