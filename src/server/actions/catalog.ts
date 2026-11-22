"use server";

import { z } from "zod";
import { COLLECTION_PAGE_SIZE } from "@/lib/catalog-constants";
import { getCollectionPage, type ProductCardData } from "@/server/queries/catalog";

const input = z.object({ slug: z.string().min(1).max(100), offset: z.number().int().min(0).max(10_000) });

/** "Цааш үзэх": дараагийн 24 бүтээгдэхүүн (нийтийн, кэштэй өгөгдлөөс) */
export async function loadCollectionProducts(slug: string, offset: number): Promise<ProductCardData[]> {
  const parsed = input.safeParse({ slug, offset });
  if (!parsed.success) return [];
  const page = await getCollectionPage(parsed.data.slug);
  return page ? page.products.slice(parsed.data.offset, parsed.data.offset + COLLECTION_PAGE_SIZE) : [];
}
