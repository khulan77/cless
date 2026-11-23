import type { PromoTrioSetting } from "@/lib/site-settings";
import { PillLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Img } from "@/components/ui/Img";
import { realImageSrc } from "@/lib/placeholder";
import { t } from "@/i18n";

/**
 * Three promo cards (BR multicolumn): square images, 5px apart; title 20px below the image, text 10px,
 * soft pill 15px below. Phones: a swipeable row of 62%-wide cards, 2px apart.
 */
export function PromoTrio({ promo }: { promo: PromoTrioSetting }) {
  return (
    <Container as="section" pad="inset-wide" aria-label={t.layout.featured} className="mt-[41px] md:mt-[51px]">
      <ul data-br="promo.list" className="no-scrollbar -mx-[25px] flex snap-x snap-mandatory scroll-px-[25px] gap-[2px] overflow-x-auto px-[25px] md:mx-0 md:grid md:grid-cols-3 md:gap-[5px] md:overflow-visible md:px-0">
        {promo.items.map((item) => {
          const src = realImageSrc(item.image.src);
          return (
            <li key={item.title} data-br="promo.card" className="flex w-[62%] shrink-0 snap-start flex-col gap-5 md:w-auto">
              {src ? (
                <div data-br="promo.image" className="relative aspect-square w-full overflow-hidden bg-card">
                  <Img src={src} alt={item.image.alt} fill sizes="(min-width: 768px) 33vw, 62vw" className="object-cover" />
                </div>
              ) : (
                <div aria-hidden className="aspect-square w-full bg-promo" />
              )}
              <div className="flex flex-col items-center text-center">
                <h2 data-br="promo.title" className="text-h3">{item.title}</h2>
                <p data-br="promo.text" className="mt-[10px] text-body">{item.text}</p>
                <PillLink href={item.cta.href} tone="soft" data-br="promo.button" className="mt-[15px]">
                  {item.cta.label}
                </PillLink>
              </div>
            </li>
          );
        })}
      </ul>
    </Container>
  );
}
