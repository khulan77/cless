import type { Metadata } from "next";
import { AuthShell } from "@/components/admin/auth/AuthShell";
import { CodePasswordFlow } from "@/components/admin/auth/CodePasswordFlow";
import { getSalonInfo } from "@/server/queries/storefront";

export const metadata: Metadata = { title: "Бүртгэл идэвхжүүлэх", robots: { index: false } };
export const instant = false;

export default async function Page() {
  const salon = await getSalonInfo();
  return (
    <AuthShell brand={salon.name || salon.siteName} title="Бүртгэл идэвхжүүлэх" subtitle="Утас эсвэл имэйлээ оруулж код аваад нууц үгээ үүсгэнэ.">
      <CodePasswordFlow mode="activate" />
    </AuthShell>
  );
}
