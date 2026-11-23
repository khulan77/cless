import Link from "next/link";
import type { BannerSetting } from "@/lib/site-settings";
import type { ReactNode } from "react";
import { Img } from "@/components/ui/Img";
import { realImageSrc } from "@/lib/placeholder";

/** Text on a full-width image. Without a real photo: a navy gradient, shorter (dev placeholders never sit under the text). */
export function FullBleedBanner({ banner, id, extra }: { banner: BannerSetting; id: string; extra?: ReactNode }) {
  const src = realImageSrc(banner.image.src, { always: true });
  return (
    <section
      aria-labelledby={id}
      className={`on-dark relative mt-16 w-full overflow-hidden md:mt-24 ${src ? "h-[70svh] min-h-[420px] md:h-[80vh]" : "flex min-h-[360px] flex-col justify-center md:min-h-[440px]"}`}
    >
      {src ? (
        <>
          <Img src={src} alt={banner.image.alt} fill sizes="100vw" className="object-cover" />
          <div aria-hidden className="absolute inset-0 bg-navy/25" />
        </>
      ) : (
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(160deg,#0e2243_0%,#22385a_60%,#5d5a55_100%)]" />
      )}
      <div className={`${src ? "absolute inset-0" : "relative py-20"} flex flex-col items-center justify-center px-6 text-center text-white`}>
        {banner.eyebrow && <p className="text-micro mb-4 uppercase tracking-[0.8px]">{banner.eyebrow}</p>}
        <h2 id={id} className="text-section md:text-[34px]">
          {banner.title}
        </h2>
        {banner.text && <p className="mt-4 max-w-[48ch] text-white/90">{banner.text}</p>}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          <Link href={banner.cta.href} className="link-underline inline-flex min-h-11 items-center text-[14px]">
            {banner.cta.label}
          </Link>
          {extra}
        </div>
      </div>
    </section>
  );
}
