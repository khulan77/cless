import { Phone } from "lucide-react";
import type { Metadata } from "next";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { SocialIcon } from "@/components/layout/SocialIcon";
import { getSalonInfo } from "@/server/queries/storefront";

/**
 * "Удахгүй нээгдэнэ" (PROMPT 24) — SITE_MODE=coming_soon үед proxy нийтийн хуудсыг энд rewrite хийнэ (503).
 * Нэг дэлгэц, navigation / сагс / хайлтгүй. Холбоо барих мэдээлэл — Тохиргооноос (хоосон бол нуугдана).
 */
export const metadata: Metadata = {
  title: { absolute: "CLÉSS · Удахгүй нээгдэнэ" },
  description: "Biologique Recherche-ийн Монгол дахь албан ёсны дистрибьютор — удахгүй нээгдэнэ.",
  robots: { index: false, follow: false },
};

const NAVY = "#0E1E3A";
const CREAM = "#F4EFE6";
const GOLD = "#B8975A";

export default async function ComingSoonPage() {
  const salon = await getSalonInfo();
  const tel = salon.phone.replace(/[^\d+]/g, "");
  const links = [
    tel && { href: `tel:${tel}`, label: salon.phone, kind: "phone" as const },
    salon.instagram && { href: salon.instagram, label: "Instagram", kind: "instagram" as const },
    salon.facebook && { href: salon.facebook, label: "Facebook", kind: "facebook" as const },
  ].filter(Boolean) as { href: string; label: string; kind: "phone" | "instagram" | "facebook" }[];

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-6 py-16 text-center" style={{ backgroundColor: NAVY, color: CREAM }}>
      {/* Нарийн алтан хүрээ */}
      <div aria-hidden className="pointer-events-none absolute inset-4 border sm:inset-8" style={{ borderColor: `${GOLD}55` }} />
      <div className="relative flex max-w-xl flex-col items-center">
        <h1 className="sr-only">CLÉSS — Удахгүй нээгдэнэ</h1>
        <BrandLogo className="h-[88px] w-[184.8px] sm:h-[112px] sm:w-[235.2px]" />
        <span aria-hidden className="mt-10 block h-px w-16" style={{ backgroundColor: GOLD }} />
        <p className="mt-10 font-display text-[30px] font-light uppercase tracking-[0.18em] sm:text-[40px]">Удахгүй нээгдэнэ</p>
        <p className="mt-5 max-w-sm text-[13px] leading-relaxed tracking-[0.08em] opacity-75 sm:text-[14px]">
          Biologique Recherche-ийн Монгол дахь албан ёсны дистрибьютор
        </p>
        {links.length > 0 && (
          <>
            <span aria-hidden className="mt-12 block h-px w-10" style={{ backgroundColor: `${GOLD}99` }} />
            <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-[14px] tracking-[0.06em]">
              {links.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    {...(l.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    className="inline-flex min-h-11 items-center gap-2 opacity-85 transition-opacity hover:opacity-100"
                  >
                    <span aria-hidden style={{ color: GOLD }} className="inline-flex">
                      {l.kind === "phone" ? <Phone className="size-4" strokeWidth={1.5} /> : <SocialIcon network={l.kind} className="size-4" />}
                    </span>
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}
