import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductCard } from "@/components/product/ProductCard";
import { Container } from "@/components/ui/Container";
import { getAllCollectionSlugs, getCollectionPage } from "@/server/queries/catalog";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await getAllCollectionSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await getCollectionPage((await params).slug);
  return { title: c?.name ?? "Ангилал", description: c?.description ?? undefined };
}

export default function CollectionPage({ params }: Props) {
  return (
    <Suspense fallback={<Container className="min-h-[60vh] py-16" />}>
      <CollectionView params={params} />
    </Suspense>
  );
}

async function CollectionView({ params }: Props) {
  const { slug } = await params;
  const collection = await getCollectionPage(slug);
  if (!collection) notFound();

  return (
    <Container as="section" className="py-12 md:py-16">
      <nav aria-label="Замын мөр" className="text-micro mb-6 text-muted">
        <Link href="/" className="hover:underline">Нүүр</Link> / <Link href="/collections" className="hover:underline">Ангилал</Link>
      </nav>
      <header className="mb-10 text-center">
        <h1 className="text-section">{collection.name}</h1>
        {collection.description && <p className="mx-auto mt-3 max-w-[56ch] text-muted">{collection.description}</p>}
      </header>
      {collection.products.length === 0 ? (
        <p className="py-16 text-center text-muted">Энэ ангилалд бүтээгдэхүүн удахгүй нэмэгдэнэ.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
          {collection.products.map((p) => (
            <li key={p.slug}>
              <ProductCard product={p} />
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
