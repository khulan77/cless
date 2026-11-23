import type { PromoTrioSetting } from "@/lib/site-settings";
import { PillLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Img } from "@/components/ui/Img";
import { realImageSrc } from "@/lib/placeholder";
import { t } from "@/i18n";

export function PromoTrio({ promo }: { promo: PromoTrioSetting }) {
  return (
    <Container as="section" aria-label={t.layout.featured} className="mt-16 md:mt-24">
      <div className="grid gap-y-12 md:grid-cols-3 md:gap-x-1.5">
        {promo.items.map((item) => {
          const src = realImageSrc(item.image.src);
          return (
          <article key={item.title} className={`flex flex-col ${src ? "" : "justify-center bg-promo py-12"}`}>
            {src && (
              <div className="relative aspect-square w-full overflow-hidden bg-card">
                <Img src={src} alt={item.image.alt} fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover" />
              </div>
            )}
            <div className={`flex flex-1 flex-col items-center px-4 text-center ${src ? "pt-6" : "justify-center"}`}>
              <h3 className="text-product">{item.title}</h3>
              <p className="mt-2 max-w-[34ch] text-[14px] text-muted">{item.text}</p>
              <PillLink href={item.cta.href} className="mt-5">
                {item.cta.label}
              </PillLink>
            </div>
          </article>
          );
        })}
      </div>
    </Container>
  );
}
