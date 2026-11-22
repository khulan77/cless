import Link from "next/link";
import type { BannerSetting } from "@/lib/site-settings";
import { Img } from "@/components/ui/Img";

export function FullBleedBanner({ banner, id }: { banner: BannerSetting; id: string }) {
  return (
    <section aria-labelledby={id} className="on-dark relative mt-16 h-[70svh] min-h-[420px] w-full overflow-hidden md:mt-24 md:h-[80vh]">
      <Img src={banner.image.src} alt={banner.image.alt} fill sizes="100vw" className="object-cover" />
      <div aria-hidden className="absolute inset-0 bg-navy/25" />
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center text-white">
        {banner.eyebrow && <p className="text-micro mb-4">{banner.eyebrow}</p>}
        <h2 id={id} className="text-section md:text-[34px]">
          {banner.title}
        </h2>
        {banner.text && <p className="mt-4 max-w-[48ch] text-white/90">{banner.text}</p>}
        <Link href={banner.cta.href} className="link-underline mt-6 text-[14px]">
          {banner.cta.label}
        </Link>
      </div>
    </section>
  );
}
