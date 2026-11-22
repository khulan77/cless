import Link from "next/link";
import type { BadgeType } from "@/generated/prisma/enums";
import type { ProductCardData } from "@/server/queries/catalog";
import { Img } from "@/components/ui/Img";
import { VariantPicker } from "./VariantPicker";

const badgeLabel: Record<BadgeType, string> = {
  NEW: "Шинэ",
  ICONIC: "Иконик",
  LIMITED: "Хязгаарлагдмал",
};

type Props = { product: ProductCardData; size?: "md" | "lg"; priority?: boolean };

export function ProductCard({ product, size = "md", priority }: Props) {
  const large = size === "lg";
  const href = `/products/${product.slug}`;
  return (
    <article className={`relative flex h-full flex-col bg-card ${large ? "p-6 md:p-10" : "p-4 md:p-5"}`}>
      {product.badge && <span className="text-micro absolute left-4 top-4 md:left-5 md:top-5">{badgeLabel[product.badge]}</span>}

      <Link href={href} className="group block">
        <div className={`relative mx-auto aspect-square w-full ${large ? "max-w-[420px]" : ""}`}>
          {product.image ? (
            <Img
              src={product.image.src}
              alt={product.image.alt}
              fill
              priority={priority}
              sizes={large ? "(min-width: 768px) 40vw, 90vw" : "(min-width: 1024px) 25vw, (min-width: 640px) 45vw, 75vw"}
              className="object-contain transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : null}
        </div>
        <h3 className={`text-product mt-4 ${large ? "md:text-[21px]" : ""}`}>{product.name}</h3>
        <p className="text-micro mt-1.5 text-muted">{product.subtitle}</p>
      </Link>

      <VariantPicker productName={product.name} variants={product.variants} large={large} />
    </article>
  );
}
