import type { SplitPromoSetting } from "@/lib/site-settings";
import { TextLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Img } from "@/components/ui/Img";
import { realImageSrc } from "@/lib/placeholder";

export function SplitPromo({ promo }: { promo: SplitPromoSetting }) {
  const src = realImageSrc(promo.image.src);
  return (
    <Container as="section" aria-labelledby="split-title" className="section-gap">
      <div className={`grid ${src ? "md:grid-cols-2" : ""}`}>
        <div className="order-2 flex flex-col items-center justify-center bg-promo px-6 py-14 text-center md:order-1 md:px-16">
          {promo.eyebrow && <p className="text-micro mb-4 uppercase tracking-[0.8px]">{promo.eyebrow}</p>}
          <h2 id="split-title" className="text-section">
            {promo.title}
          </h2>
          <p className="mt-4 max-w-[42ch] text-muted">{promo.text}</p>
          <TextLink href={promo.cta.href} className="mt-6">
            {promo.cta.label}
          </TextLink>
        </div>
        {src && (
          <div className="relative order-1 aspect-[6/5] md:order-2 md:aspect-auto md:min-h-[560px]">
            <Img src={src} alt={promo.image.alt} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
          </div>
        )}
      </div>
    </Container>
  );
}
