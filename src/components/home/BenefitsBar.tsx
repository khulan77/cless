import { Gift, Package, ScanFace, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react";
import type { BenefitIcon, BenefitsSetting } from "@/lib/site-settings";
import { Container } from "@/components/ui/Container";

const icons: Record<BenefitIcon, LucideIcon> = {
  gift: Gift,
  package: Package,
  "scan-face": ScanFace,
  "shield-check": ShieldCheck,
  sparkles: Sparkles,
};

export function BenefitsBar({ benefits }: { benefits: BenefitsSetting }) {
  return (
    <Container as="section" aria-label="Давуу тал" className="my-16 md:my-24">
      <ul className="grid grid-cols-2 gap-x-4 gap-y-10 border-t border-line pt-12 md:grid-cols-4">
        {benefits.items.map((b) => {
          const Icon = icons[b.icon] ?? Sparkles;
          return (
            <li key={b.lines.join(" ")} className="flex flex-col items-center text-center">
              <Icon className="mb-4 size-8" strokeWidth={1} aria-hidden />
              <p className="text-micro leading-relaxed">
                <span className="block">{b.lines[0]}</span>
                <span className="block">{b.lines[1]}</span>
              </p>
            </li>
          );
        })}
      </ul>
    </Container>
  );
}
