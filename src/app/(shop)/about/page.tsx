import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Img } from "@/components/ui/Img";
import { ABOUT_PAGE_DEFAULT } from "@/lib/validation/content-pages";
import { getSetting } from "@/server/queries/settings";

export async function generateMetadata(): Promise<Metadata> {
  const about = (await getSetting("aboutPage")) ?? ABOUT_PAGE_DEFAULT;
  return { title: about.title, description: about.intro.slice(0, 160), alternates: { canonical: "/about" } };
}

/** Агуулга: SiteSetting "aboutPage" (Админ → Сайтын контент → Бидний тухай) */
export default async function AboutPage() {
  const about = (await getSetting("aboutPage")) ?? ABOUT_PAGE_DEFAULT;
  return (
    <>
      <Container as="header" className="py-16 text-center md:py-24">
        <h1 className="text-section">{about.title}</h1>
        <p className="mx-auto mt-5 max-w-[60ch] whitespace-pre-line text-muted">{about.intro}</p>
      </Container>

      <Container as="div" className="space-y-12 pb-20 md:space-y-0 md:pb-28">
        {about.sections.map((s, i) => (
          <section key={i} aria-labelledby={`about-${i}`} className="grid items-stretch md:grid-cols-2">
            <div className={`relative aspect-[6/5] md:aspect-auto md:min-h-[480px] ${i % 2 ? "md:order-2" : ""}`}>
              <Img src={s.image.src} alt={s.image.alt} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
            </div>
            <div className="flex flex-col justify-center bg-promo px-6 py-12 md:px-16">
              <h2 id={`about-${i}`} className="text-[22px] font-medium md:text-[26px]">
                {s.title}
              </h2>
              <p className="mt-4 max-w-[48ch] whitespace-pre-line text-muted">{s.text}</p>
            </div>
          </section>
        ))}
      </Container>
    </>
  );
}
