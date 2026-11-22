import { Clock } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Img } from "@/components/ui/Img";
import { formatMNT } from "@/lib/money";
import { getActiveServices } from "@/server/queries/catalog";
import { getSetting } from "@/server/queries/settings";

export const metadata = { title: "Салоны үйлчилгээ" };

export default async function ServicesPage() {
  const [services, banner] = await Promise.all([getActiveServices(), getSetting("servicesBanner")]);
  return (
    <Container as="section" className="py-12 md:py-16">
      <h1 className="text-section mb-8 text-center md:mb-10">{banner?.title ?? "Салоны үйлчилгээ"}</h1>
      {banner?.text && <p className="-mt-4 mb-10 text-center text-muted">{banner.text}</p>}
      <ul className="grid gap-1.5 md:grid-cols-2">
        {services.map((s) => (
          <li key={s.slug} className="flex flex-col bg-card sm:flex-row">
            {s.image && (
              <div className="relative aspect-[4/3] sm:aspect-auto sm:w-48 sm:shrink-0">
                <Img src={s.image} alt="" fill sizes="(min-width: 640px) 192px, 100vw" className="object-cover" />
              </div>
            )}
            <div className="flex flex-1 flex-col p-6">
              <h2 className="text-product">{s.name}</h2>
              <p className="mt-2 flex-1 text-[14px] text-muted">{s.description}</p>
              <div className="mt-4 flex items-center justify-between text-[14px]">
                <span className="flex items-center gap-1.5 text-muted">
                  <Clock className="size-4" strokeWidth={1.25} aria-hidden /> {s.durationMin} мин
                </span>
                <span>{formatMNT(s.price)}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-10 text-center text-[14px] text-muted">Цаг захиалахдаа салонтой утсаар холбогдоно уу.</p>
    </Container>
  );
}
