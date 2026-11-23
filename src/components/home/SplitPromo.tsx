import Link from "next/link";
import type { SplitPromoSetting } from "@/lib/site-settings";
import { Container } from "@/components/ui/Container";
import { Img } from "@/components/ui/Img";
import { realImageSrc } from "@/lib/placeholder";
import { imageEdgeColor } from "@/lib/default-images";

/**
 * BR image-with-text ("Offre des fêtes"), measured at 1440/390px:
 * #f1f0eb panel, text 54% | image 46% (616:350), 36px below the promo cards (27px on phones).
 * Text column 460px, 132px from the panel edge, vertically centred: eyebrow 12px, title 27px 4px below,
 * text 17px 40px below, link 15px 50px below the text. Phones: image on top (16:9), centred text,
 * 40px 18px padding, gaps 5 / 20 / 30px.
 */
export function SplitPromo({ promo }: { promo: SplitPromoSetting }) {
  const src = realImageSrc(promo.image.src);
  // Default images: shown whole on their own backdrop colour (BR shows the full product); uploads fill the frame
  const backdrop = imageEdgeColor(src);
  return (
    <Container as="section" pad="inset" aria-labelledby="split-title" className="mt-[27px] md:mt-9">
      <div data-br="banner.grid" className={`grid bg-card ${src ? "md:grid-cols-[724fr_616fr]" : ""}`}>
        {src && (
          <div
            data-br="banner.image"
            className="relative aspect-[360/203] overflow-hidden md:order-2 md:aspect-[616/350]"
            style={backdrop ? { backgroundColor: backdrop } : undefined}
          >
            <Img
              src={src}
              alt={promo.image.alt}
              fill
              sizes="(min-width: 768px) 46vw, 100vw"
              // Whole image: full height, natural width, centred — so the feathered edges are the photo's own
              // (! beats fill's inline width/left/right)
              className={backdrop ? "edge-feather !left-1/2 !right-auto !w-auto max-w-none -translate-x-1/2" : "object-cover"}
            />
          </div>
        )}
        <div
          data-br="banner.content"
          className="flex flex-col justify-center px-[18px] py-10 text-center md:order-1 md:px-[132px] md:py-[50px] md:text-left"
        >
          {promo.eyebrow && <p data-br="banner.eyebrow" className="text-eyebrow">{promo.eyebrow}</p>}
          <h2 id="split-title" data-br="banner.title" className="text-section mt-[5px] md:mt-1">
            {promo.title}
          </h2>
          <p data-br="banner.text" className="text-lead mt-5 md:mt-10 md:max-w-[460px]">{promo.text}</p>
          <p className="mt-[30px] md:mt-[50px]">
            <Link
              href={promo.cta.href}
              data-br="banner.link"
              className="link-underline relative text-body before:absolute before:-inset-y-3 before:inset-x-0 before:content-['']"
            >
              {promo.cta.label}
            </Link>
          </p>
        </div>
      </div>
    </Container>
  );
}
