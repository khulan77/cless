import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { homePathFor } from "@/server/auth/permissions";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Нэвтрэх" };
export const instant = false;

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect(homePathFor(user.role));
  const { callbackUrl } = await searchParams;

  return (
    <div className="grid min-h-dvh place-items-center bg-promo px-4">
      <div className="w-full max-w-[400px] bg-white px-8 py-10 md:px-10">
        <div className="mb-10 flex flex-col items-center font-serif leading-none">
          <span className="text-[16px] tracking-[0.32em]">BIOLOGIQUE</span>
          <span className="text-[16px] tracking-[0.32em]">RECHERCHE</span>
          <span className="mt-1 text-[8px] tracking-[0.5em]">PARIS</span>
        </div>
        <h1 className="text-section mb-8 text-center text-[20px]">Удирдлагад нэвтрэх</h1>
        <LoginForm callbackUrl={callbackUrl} />
      </div>
    </div>
  );
}
