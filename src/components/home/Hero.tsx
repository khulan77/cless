import Link from "next/link";
import { getImageProps } from "next/image";
import type { HeroSetting } from "@/lib/site-settings";
import { realImageSrc } from "@/lib/placeholder";

/**
 * Full-bleed hero. Art direction with <picture>: a separate portrait image on phones (if set) —
 * only one file is downloaded. Focal point keeps the subject in frame; quality 90, high priority.
 *
 * layout "center" (as on biologique-recherche.com): on md+ the photo is not blown up to the full width —
 * it sits centred at ~63% width, anchored to the top, its edges feathered into `background`
 * (pick the photo's own backdrop colour). Phones always fill the hero.
 * headerTone "dark": navy logo/icons over a light photo (globals.css, [data-header-overlay="dark"]).
 */
export function Hero({ hero }: { hero: HeroSetting }) {
  // Text sits on the image, so a labelled placeholder is never shown (dev included)
  const src = realImageSrc(hero.image.src, { always: true });
  const mobileSrc = realImageSrc(hero.mobileImage?.src, { always: true });
  const position = hero.focal ? `${hero.focal.x}% ${hero.focal.y}%` : "50% 50%";
  const center = hero.layout === "center";
  const dark = hero.headerTone === "dark";

  let picture: React.ReactNode = null;
  if (src) {
    const common = { alt: hero.image.alt, fill: true, quality: 90, priority: true, fetchPriority: "high" as const };
    const desktop = getImageProps({ ...common, src, sizes: center ? "(max-width: 767px) 100vw, 63vw" : "100vw" }).props;
    const mobile = mobileSrc ? getImageProps({ ...common, src: mobileSrc, sizes: "100vw" }).props : null;
    // "center": sizing comes from classes (md+), so fill's inline width/height/inset are dropped
    const { style: fillStyle, ...img } = desktop;
    picture = (
      <picture>
        {/* Unoptimized images (NEXT_IMAGE_UNOPTIMIZED) have no srcSet — fall back to the file itself */}
        {mobile && <source media="(max-width: 767px)" srcSet={mobile.srcSet ?? mobile.src} sizes="100vw" />}
        <img
          {...img}
          alt={hero.image.alt}
          className={
            center
              ? "hero-feather absolute inset-0 size-full object-cover md:inset-auto md:top-0 md:left-1/2 md:h-auto md:w-[63%] md:-translate-x-1/2"
              : "absolute inset-0 size-full object-cover"
          }
          style={center ? { objectPosition: position } : { ...fillStyle, objectPosition: position }}
        />
      </picture>
    );
  }

  return (
    // data-header-overlay: the header floats transparent over the hero (as on biologique-recherche.com)
    <section
      aria-labelledby="hero-title"
      data-header-overlay={dark ? "dark" : ""}
      data-br="hero.section"
      // BR: 100vh under the 70px header (500px under 55px on phones)
      className="on-dark relative -mt-[55px] h-[500px] w-full overflow-hidden md:-mt-[70px] md:h-screen"
      style={center && hero.background ? { backgroundColor: hero.background } : undefined}
    >
      {picture ?? <div aria-hidden data-hero-fallback className="absolute inset-0 bg-[linear-gradient(165deg,#0e2243_0%,#1f3557_48%,#8c8273_100%)]" />}
      {/* Top: keeps a white header legible on light photos (not needed for a navy header); bottom: the title */}
      {!dark && <div aria-hidden className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/30 to-transparent" />}
      <div aria-hidden className={`absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t to-transparent ${dark ? "from-black/30" : "from-black/45"}`} />
      {/* BR: title block 60px above the bottom (15px on phones), 150px side padding, link 16px below */}
      <div className="absolute inset-x-0 bottom-[15px] flex flex-col items-center px-[15px] text-center text-white md:bottom-[60px] md:px-[150px]">
        <h1 id="hero-title" data-br="hero.title" className="text-hero">
          {hero.title.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </h1>
        <Link href={hero.cta.href} data-br="hero.link" className="text-body link-underline relative mt-4 before:absolute before:-inset-y-3 before:inset-x-0 before:content-['']">
          {hero.cta.label}
        </Link>
      </div>
    </section>
  );
}
