import type { Metadata } from "next";
import { AuthShell } from "@/components/admin/auth/AuthShell";
import { CodePasswordFlow } from "@/components/admin/auth/CodePasswordFlow";
import { getSalonInfo } from "@/server/queries/storefront";

export const metadata: Metadata = { title: "Нууц үг сэргээх", robots: { index: false } };
export const instant = false;

export default async function Page() {
  const salon = await getSalonInfo();
  return (
    <AuthShell brand={salon.name || salon.siteName} title="Нууц үг сэргээх" subtitle="Утас эсвэл имэйлээ оруулна уу — бүртгэлтэй бол код илгээнэ.">
      <CodePasswordFlow mode="reset" />
    </AuthShell>
  );
}
