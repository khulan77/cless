import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductCard } from "@/components/product/ProductCard";
import { ServiceCard } from "@/components/services/ServiceCard";
import { Container } from "@/components/ui/Container";
import { t } from "@/i18n";
import { searchStorefront } from "@/server/queries/catalog";

const S = t.pages.search;

export const metadata: Metadata = { title: S.title, robots: { index: false, follow: true } };

type Props = { searchParams: Promise<{ q?: string | string[] }> };

export default function SearchPage({ searchParams }: Props) {
  return (
    <Container as="section" className="py-12 md:py-16">
      <h1 className="text-section text-center">{S.title}</h1>
      <Suspense fallback={<SearchForm q="" />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}

function SearchForm({ q }: { q: string }) {
  return (
    <form action="/search" role="search" className="mx-auto mt-8 flex max-w-[560px] items-end gap-3">
      <label className="flex-1">
        <span className="sr-only">{S.label}</span>
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder={S.placeholder}
          minLength={2}
          maxLength={80}
          autoComplete="off"
          className="block h-12 w-full border-b border-navy/40 bg-transparent text-input focus:border-navy focus:outline-none"
        />
      </label>
      <button type="submit" className="h-12 shrink-0 rounded-full bg-navy px-6 text-button text-white hover:bg-navy/90">
        {S.submit}
      </button>
    </form>
  );
}

async function Results({ searchParams }: Props) {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  if (q.length < 2) {
    return (
      <>
        <SearchForm q={q} />
        <p className="mt-4 text-center text-body text-muted">{S.hint}</p>
      </>
    );
  }
  const { products, services } = await searchStorefront(q);
  const total = products.length + services.length;
  return (
    <>
      <SearchForm q={q} />
      <p role="status" className="mt-6 text-center text-body text-muted">
        {total ? S.results(q, total) : S.none(q)}
      </p>
      {services.length > 0 && (
        <section aria-labelledby="search-services" className="mt-10">
          <h2 id="search-services" className="text-micro mb-4">
            {S.services}
          </h2>
          <ul className="grid gap-1.5 md:grid-cols-2">
            {services.map((s) => (
              <ServiceCard key={s.slug} service={s} />
            ))}
          </ul>
        </section>
      )}
      {products.length > 0 && (
        <section aria-labelledby="search-products" className="mt-10">
          <h2 id="search-products" className="text-micro mb-4">
            {S.products}
          </h2>
          <ul className="grid grid-cols-2 gap-x-1.5 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <li key={p.slug} className="flex">
                <ProductCard product={p} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
