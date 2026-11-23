import { Gift, Package, ScanFace, ShieldCheck, Sparkles, Truck, type LucideIcon } from "lucide-react";
import type { BenefitIcon, BenefitsSetting } from "@/lib/site-settings";
import { Container } from "@/components/ui/Container";
import { t } from "@/i18n";

export const benefitIcons: Record<BenefitIcon, LucideIcon> = {
  gift: Gift,
  package: Package,
  "scan-face": ScanFace,
  "shield-check": ShieldCheck,
  sparkles: Sparkles,
  truck: Truck,
};

/**
 * BR guarantees row: 4 columns 5px apart, a 26px icon and, 15px below, one sentence-case line of
 * 15px text in navy at 75%. Phones: a swipeable row of 62%-wide items.
 */
export function BenefitsBar({ benefits }: { benefits: BenefitsSetting }) {
  return (
    <Container as="section" aria-label={t.layout.benefits} className="section-gap mb-[81px] md:mb-[108px]">
      <ul data-br="guarantees.list" className="no-scrollbar -mx-[15px] flex snap-x snap-mandatory scroll-px-[15px] gap-[2px] overflow-x-auto px-[15px] md:mx-0 md:grid md:grid-cols-4 md:gap-[5px] md:overflow-visible md:px-0">
        {benefits.items.map((b) => {
          const Icon = benefitIcons[b.icon] ?? Sparkles;
          return (
            <li key={b.lines.join(" ")} data-br="guarantees.item" className="flex w-[62%] shrink-0 snap-start flex-col items-center text-center md:w-auto">
              <Icon data-br="guarantees.icon" className="size-[26px]" strokeWidth={1.25} aria-hidden />
              <p data-br="guarantees.text" className="mt-[15px] text-body text-navy/75">{b.lines.filter(Boolean).join(" ")}</p>
            </li>
          );
        })}
      </ul>
    </Container>
  );
}
