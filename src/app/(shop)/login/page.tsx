import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { getCurrentCustomer } from "@/server/modules/customer-auth/session";
import { LoginClient } from "./LoginClient";

export const metadata = { title: "Нэвтрэх", robots: { index: false } };
// Үйлчлүүлэгчийн session (cookie) уншдаг — request бүрт render
export const instant = false;

/** Зөвхөн сайтын доторх зам (open redirect хамгаалалт) */
function safeNext(raw: string | undefined) {
  return raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/admin") ? raw : "/account";
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  // Үйлчлүүлэгчийн session, одоогийн цаг — request бүрт (prerender хийхгүй)
  await connection();
  const next = safeNext((await searchParams).next);
  if (await getCurrentCustomer()) redirect(next);
  return (
    <Container as="section" className="py-16 md:py-24">
      <div className="mx-auto max-w-[420px]">
        <h1 className="text-section text-center">Нэвтрэх</h1>
        <p className="mt-4 text-center text-muted">Нууц үг хэрэггүй — утсандаа ирсэн кодоор нэвтэрнэ. Цаг захиалах, өмнөх айлчлал, арьсны зөвлөмжөө харна.</p>
        <div className="mt-10">
          <LoginClient next={next} />
        </div>
      </div>
    </Container>
  );
}
