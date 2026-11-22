import Link from "next/link";
import type { HeroSetting } from "@/lib/site-settings";
import { Img } from "@/components/ui/Img";

export function Hero({ hero }: { hero: HeroSetting }) {
  return (
    <section aria-labelledby="hero-title" className="on-dark relative h-[78svh] min-h-[460px] w-full overflow-hidden md:h-[90vh]">
      <Img src={hero.image.src} alt={hero.image.alt} fill priority sizes="100vw" className="object-cover" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/45 to-transparent" />
      <div className="absolute inset-x-0 bottom-12 flex flex-col items-center px-4 text-center text-white md:bottom-16">
        <h1 id="hero-title" className="text-[26px] uppercase leading-[1.15] tracking-[-0.3px] md:text-[40px]">
          {hero.title.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </h1>
        <Link href={hero.cta.href} className="link-underline mt-5 text-[14px]">
          {hero.cta.label}
        </Link>
      </div>
    </section>
  );
}
