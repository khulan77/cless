import type { ReactNode } from "react";

/** Нэвтрэх / идэвхжүүлэх / сэргээх хуудасны энгийн бүрхүүл */
export function AuthShell({ brand, title, subtitle, children }: { brand: string; title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-6 py-16">
      <div className="w-full max-w-[420px] rounded-2xl border border-hairline bg-white p-8">
        <p className="mb-6 font-display text-[26px] font-semibold">{brand}</p>
        <h1 className="font-display text-[30px] font-semibold leading-tight">{title}</h1>
        <p className="mb-7 mt-2 text-[15px] text-ink-soft">{subtitle}</p>
        {children}
        <p className="mt-6 text-center text-[14px]"><a href="/admin/login" className="text-ink-soft underline underline-offset-4">Нэвтрэх хуудас</a></p>
      </div>
    </div>
  );
}
