import { Img } from "@/components/ui/Img";
import { IntroToggle } from "./IntroToggle";

/**
 * Full-width banner. Pulled up under the (transparent) sticky header with a
 * negative top margin equal to the header height.
 */
export function CollectionBanner({ heading, intro, image }: { heading: string; intro: string | null; image: string | null }) {
  return (
    <section className="on-dark relative -mt-16 flex h-[264px] items-center justify-center overflow-hidden bg-navy pt-16 text-center text-white md:-mt-[76px] md:h-[336px] md:pt-[76px]">
      {image && <Img src={image} alt="" fill priority sizes="100vw" className="object-cover" />}
      <div aria-hidden className="absolute inset-0 bg-black/20" />
      <div className="relative px-4">
        <h1 className="text-section">{heading}</h1>
        {intro && <IntroToggle text={intro} />}
      </div>
    </section>
  );
}
