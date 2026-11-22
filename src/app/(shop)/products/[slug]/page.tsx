import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductCard } from "@/components/product/ProductCard";
import { Container } from "@/components/ui/Container";
import { db } from "@/server/db";
import { getProductCard } from "@/server/queries/catalog";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const rows = await db.product.findMany({ where: { isPublished: true }, select: { slug: true } });
  return rows.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProductCard((await params).slug);
  return { title: p?.name ?? "Бүтээгдэхүүн" };
}

// TODO (дараагийн ээлж): бүрэн дэлгэрэнгүй хуудас — тайлбар, хэрэглэх заавар, найрлага, зургийн цомог
export default function ProductPage({ params }: Props) {
  return (
    <Suspense fallback={<Container className="min-h-[60vh] py-16" />}>
      <ProductView params={params} />
    </Suspense>
  );
}

async function ProductView({ params }: Props) {
  const { slug } = await params;
  const product = await getProductCard(slug);
  if (!product) notFound();
  return (
    <Container as="section" className="py-12 md:py-16">
      <h1 className="sr-only">{product.name}</h1>
      <div className="mx-auto max-w-[560px]">
        <ProductCard product={product} size="lg" priority />
        <p className="mt-6 text-center text-[14px] text-muted">Бүтээгдэхүүний дэлгэрэнгүй мэдээлэл удахгүй нэмэгдэнэ.</p>
      </div>
    </Container>
  );
}
