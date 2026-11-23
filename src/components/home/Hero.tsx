import Link from "next/link";
import type { HeroSetting } from "@/lib/site-settings";
import { Img } from "@/components/ui/Img";
import { realImageSrc } from "@/lib/placeholder";

export function Hero({ hero }: { hero: HeroSetting }) {
  // Text sits on the image, so a labelled placeholder is never shown (dev included)
  const src = realImageSrc(hero.image.src, { always: true });
  return (
    <section aria-labelledby="hero-title" className="on-dark relative h-[78svh] min-h-[460px] w-full overflow-hidden md:h-[90vh]">
      {src ? (
        <Img src={src} alt={hero.image.alt} fill priority fetchPriority="high" sizes="100vw" className="object-cover" />
      ) : (
        <div aria-hidden data-hero-fallback className="absolute inset-0 bg-[linear-gradient(165deg,#0e2243_0%,#1f3557_48%,#8c8273_100%)]" />
      )}
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/45 to-transparent" />
      <div className="absolute inset-x-0 bottom-12 flex flex-col items-center px-4 text-center text-white md:bottom-16">
        <h1 id="hero-title" className="max-w-[20ch] text-balance text-[24px] uppercase leading-[1.15] tracking-[-0.3px] sm:text-[26px] md:max-w-none md:text-[40px]">
          {hero.title.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </h1>
        <Link href={hero.cta.href} className="link-underline mt-5 inline-flex min-h-11 items-center text-[14px]">
          {hero.cta.label}
        </Link>
      </div>
    </section>
  );
}
