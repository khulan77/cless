import Link from "next/link";
import { t } from "@/i18n";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-promo px-4 text-center">
      <div>
        <div className="mb-10 flex flex-col items-center font-serif leading-none">
          <span className="text-[16px] tracking-[0.32em]">BIOLOGIQUE</span>
          <span className="text-[16px] tracking-[0.32em]">RECHERCHE</span>
          <span className="mt-1 text-[8px] tracking-[0.5em]">PARIS</span>
        </div>
        <p className="text-micro text-muted">{t.notFound.code}</p>
        <h1 className="text-section mt-3">{t.notFound.title}</h1>
        <p className="mt-4 text-muted">{t.notFound.text}</p>
        <Link href="/" className="mt-8 inline-flex rounded-full border border-navy px-5 py-2.5 text-[14px] hover:bg-navy hover:text-white">
          {t.common.backHome}
        </Link>
      </div>
    </main>
  );
}
