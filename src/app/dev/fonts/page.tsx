import type { Metadata } from "next";
import { Inter, Inter_Tight, Onest } from "next/font/google";
import { notFound } from "next/navigation";

/** DEV ONLY — font comparison for the storefront (PROMPT 10). 404 in production. */
export const metadata: Metadata = { title: "Fonts (dev)", robots: { index: false } };

const interTight = Inter_Tight({ subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"], weight: ["400", "500"], display: "swap" });
const inter = Inter({ subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"], weight: ["400", "500"], display: "swap" });
const onest = Onest({ subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"], weight: ["400", "500"], display: "swap" });

const OPTIONS = [
  { key: "A", name: "Inter Tight (гарчиг) + Inter (текст)", heading: interTight.style.fontFamily, body: inter.style.fontFamily },
  { key: "B", name: "Onest (ганцаараа)", heading: onest.style.fontFamily, body: onest.style.fontFamily },
  { key: "C", name: "Inter Tight (ганцаараа) — одоогийнх", heading: interTight.style.fontFamily, body: interTight.style.fontFamily },
];

export default function FontsPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="bg-white px-[50px] py-12 text-[#0E2243]">
      <h1 className="mb-2 text-[21px]">Storefront фонт харьцуулалт</h1>
      <p className="mb-10 text-[13px] text-[#6B6F78]">Бүх жин 400 (үнэ, идэвхтэй tab — 500). BR-ийн хэмжүүр: hero/h2 27px, h1 21px, h3 17px, текст 15px, товч 13px, шошго 11px.</p>
      <div className="grid gap-8 xl:grid-cols-3">
        {OPTIONS.map((o) => (
          <section key={o.key} className="border border-[#ECEAE6] p-8">
            <p className="mb-6 text-[11px] uppercase tracking-[0.2px] text-[#A1A6AE]" style={{ fontFamily: o.body }}>
              {o.key} · {o.name}
            </p>
            {/* Hero on an image */}
            <div className="mb-8 flex h-44 items-end justify-center bg-[linear-gradient(165deg,#0e2243,#8c8273)] pb-6">
              <p className="text-center text-[27px] uppercase leading-none tracking-[-0.54px] text-white" style={{ fontFamily: o.heading, fontWeight: 400 }}>
                Бэлгийн улирал
                <br />
                эхэллээ
              </p>
            </div>
            <p className="mb-2 text-[11px] uppercase tracking-[0.2px] text-[#A1A6AE]" style={{ fontFamily: o.body }}>
              Хязгаарлагдмал · Шинэ
            </p>
            <h2 className="mb-4 text-[27px] uppercase leading-[1.1] tracking-[-0.1px]" style={{ fontFamily: o.heading, fontWeight: 400 }}>
              Өвлийн арчилгаа үргэлжилнэ
            </h2>
            <h3 className="mb-1 text-[17px] uppercase leading-[1.18] tracking-[-0.2px]" style={{ fontFamily: o.heading, fontWeight: 400 }}>
              Lotion P50 · Crème Masque Vernix
            </h3>
            <p className="mb-4 text-[15px] tracking-[0.2px]" style={{ fontFamily: o.body, fontWeight: 500 }}>
              280,000₮ <span className="font-normal text-[#6B6F78]">· 250 мл</span>
            </p>
            <p className="mb-6 text-[15px] leading-[1.5] tracking-[0.2px]" style={{ fontFamily: o.body, fontWeight: 400 }}>
              Арьсны төлөвт тохирсон өдөр тутмын арчилгаа. CLÉSS салонд гоо сайханчийн зөвлөгөөтэйгөөр сонгоорой — ёс, өнгө, үйлчилгээ, «Épiderme».
            </p>
            <h1 className="mb-6 text-[21px] leading-[1.2] tracking-[-0.2px]" style={{ fontFamily: o.heading, fontWeight: 400 }}>
              Нүүрний эмчилгээ — Хөгшрөлтийн эсрэг
            </h1>
            <div className="flex flex-wrap items-center gap-6" style={{ fontFamily: o.body }}>
              <span className="rounded-full border border-[#0E2243] px-5 py-2 text-[13px] leading-[1.8] tracking-[0.2px]">Салонд захиалах</span>
              <span className="text-[13px] leading-[1.8] tracking-[0.2px] underline underline-offset-4">Сонголтыг үзэх</span>
            </div>
            <p className="mt-6 text-[12px] tracking-[0.2px] text-[#A1A6AE]" style={{ fontFamily: o.body }}>
              Ө ө Ү ү Ё ё · É é · ₮ · 0123456789 · ӨВӨЛ ҮЕ ЁСОЛ
            </p>
          </section>
        ))}
      </div>
    </main>
  );
}
