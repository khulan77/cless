import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { homePathFor } from "@/server/auth/permissions";
import { getSalonInfo } from "@/server/queries/storefront";
import { t } from "@/i18n";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Нэвтрэх" };
export const instant = false;

const L = t.admin.login;

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string; changed?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect(homePathFor(user.role));
  const [{ callbackUrl, changed }, salon] = await Promise.all([searchParams, getSalonInfo()]);
  const brand = salon.name || salon.siteName;

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* Brand half */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-navy p-12 text-white lg:flex">
        <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 size-[520px] rounded-full border border-white/10" />
        <div aria-hidden className="pointer-events-none absolute -bottom-56 -left-24 size-[640px] rounded-full border border-champagne/20" />
        <p className="relative font-display text-[34px] font-semibold tracking-[0.02em]">{brand}</p>
        <div className="relative max-w-md">
          <p className="mb-4 text-[13px] font-medium uppercase tracking-[0.12em] text-champagne">{L.eyebrow}</p>
          <p className="font-display text-[44px] font-semibold leading-[1.08]">{L.tagline}</p>
        </div>
        <p className="relative text-[13px] text-white/50">Biologique Recherche · {L.distributor}</p>
      </section>

      {/* Form half */}
      <section className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-[400px]">
          <p className="mb-8 font-display text-[28px] font-semibold lg:hidden">{brand}</p>
          <h1 className="font-display text-[34px] font-semibold leading-tight">{L.title}</h1>
          <p className="mb-8 mt-2 text-[15px] text-ink-soft">{L.subtitle}</p>
          {changed === "1" && (
            <p role="status" className="mb-6 rounded-xl bg-ok-bg px-4 py-3 text-[14px] text-ok">
              Нууц үг солигдлоо. Шинэ нууц үгээрээ нэвтэрнэ үү.
            </p>
          )}
          <LoginForm callbackUrl={callbackUrl} />
        </div>
      </section>
    </div>
  );
}
