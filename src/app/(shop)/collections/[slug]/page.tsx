import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CollectionBanner } from "@/components/collection/CollectionBanner";
import { CollectionLoader, LoadedCells, LoadMoreBar } from "@/components/collection/CollectionLoader";
import { CollectionToolbar } from "@/components/collection/CollectionToolbar";
import { GridTile } from "@/components/collection/GridTile";
import { ProductCard } from "@/components/product/ProductCard";
import { PillLink } from "@/components/ui/Button";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Container } from "@/components/ui/Container";
import { t } from "@/i18n";
import { mergeCells } from "@/lib/grid-cells";
import { absoluteUrl } from "@/lib/site-url";
import { COLLECTION_PAGE_SIZE } from "@/lib/catalog-constants";
import { collectionHref, getAllCollectionSlugs, getCollectionPage, type CollectionPageData } from "@/server/queries/catalog";
import { getSetting } from "@/server/queries/settings";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };

export async function generateStaticParams() {
  return (await getAllCollectionSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [c, brand] = await Promise.all([getCollectionPage(slug), getSetting("brand")]);
  if (!c) return { title: t.notFound.title };
  const site = brand?.siteName ?? "";
  return {
    title: { absolute: t.seo.collectionTitle(c.heading, site) },
    description: c.intro ?? c.seoText?.slice(0, 160) ?? undefined,
    alternates: { canonical: absoluteUrl(collectionHref(c.slug)) },
    openGraph: {
      siteName: site,
      locale: "mn_MN",
      url: absoluteUrl(collectionHref(c.slug)),
      title: c.heading,
      description: c.intro ?? undefined,
      images: c.bannerImage ? [absoluteUrl(c.bannerImage)] : undefined,
    },
  };
}

export default function CollectionPage(props: Props) {
  return (
    <Suspense fallback={<div className="min-h-svh" />}>
      <CollectionView {...props} />
    </Suspense>
  );
}

async function CollectionView({ params, searchParams }: Props) {
  const { slug } = await params;
  const c = await getCollectionPage(slug);
  if (!c) notFound();

  const current = { slug: c.slug, name: c.name, href: collectionHref(c.slug) };
  const total = c.products.length;

  return (
    <>
      <CollectionBanner heading={c.heading} intro={c.intro} image={c.bannerImage} />
      <Container>
        <Breadcrumbs items={c.breadcrumb} current={current} className="pt-4" />
        <CollectionToolbar current={current} siblings={c.siblings} parent={c.parent} subcategories={c.children} total={total} />

        {total === 0 ? (
          <div className="flex flex-col items-center gap-6 py-24 text-center">
            <p className="text-muted">{t.collection.empty}</p>
            <PillLink href="/collections">{t.common.viewAllProducts}</PillLink>
          </div>
        ) : (
          <section aria-labelledby="collection-products" className="pt-6">
            {/* h1 → h3 (картын нэр) үсрэхгүйн тулд */}
            <h2 id="collection-products" className="sr-only">{t.collection.productsHeading(c.name)}</h2>
            {/* Page 1 is part of the static shell; ?page=n streams in the first n pages */}
            <Suspense fallback={<CollectionGrid c={c} pages={1} />}>
              <GridFromSearch c={c} searchParams={searchParams} />
            </Suspense>
          </section>
        )}

        {c.seoText && (
          <section className="mx-auto max-w-[720px] py-20 text-center md:py-24">
            <h2 className="text-section mb-5 text-[21px]">{c.name}</h2>
            <p className="text-[14px] leading-relaxed text-muted">{c.seoText}</p>
          </section>
        )}
      </Container>
    </>
  );
}

async function GridFromSearch({ c, searchParams }: { c: CollectionPageData; searchParams: Props["searchParams"] }) {
  const { page } = await searchParams;
  const maxPages = Math.max(1, Math.ceil(c.products.length / COLLECTION_PAGE_SIZE));
  const n = Number(page);
  return <CollectionGrid c={c} pages={Number.isInteger(n) && n > 1 ? Math.min(n, maxPages) : 1} />;
}

function CollectionGrid({ c, pages }: { c: CollectionPageData; pages: number }) {
  const initialCount = Math.min(pages * COLLECTION_PAGE_SIZE, c.products.length);
  const stepped = c.kind === "CONCERN";
  const cells = mergeCells(initialCount, c.tiles, initialCount >= c.products.length);
  return (
    <CollectionLoader
      slug={c.slug}
      total={c.products.length}
      initialCount={initialCount}
      pageSize={COLLECTION_PAGE_SIZE}
      tiles={c.tiles}
      stepped={stepped}
    >
      <ul className="grid grid-cols-2 gap-[2px] md:grid-cols-3 lg:grid-cols-4">
        {cells.map((cell) =>
          cell.type === "tile" ? (
            <li key={`tile-${cell.tile.id}`}>
              <GridTile tile={cell.tile} />
            </li>
          ) : (
            <li key={c.products[cell.index]!.id}>
              <ProductCard
                product={c.products[cell.index]!}
                step={stepped ? cell.index + 1 : undefined}
                priority={cell.index < 2}
              />
            </li>
          ),
        )}
        <LoadedCells />
      </ul>
      <LoadMoreBar />
    </CollectionLoader>
  );
}
