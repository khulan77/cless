import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { SafeMarkdown } from "@/components/ui/SafeMarkdown";
import { PRIVACY_PAGE_DEFAULT } from "@/lib/validation/content-pages";
import { getSetting } from "@/server/queries/settings";

export async function generateMetadata(): Promise<Metadata> {
  const p = (await getSetting("privacyPage")) ?? PRIVACY_PAGE_DEFAULT;
  return { title: p.title, alternates: { canonical: "/privacy" } };
}

/** Агуулга: SiteSetting "privacyPage" (markdown, SafeMarkdown — HTML render хийхгүй) */
export default async function PrivacyPage() {
  const p = (await getSetting("privacyPage")) ?? PRIVACY_PAGE_DEFAULT;
  return (
    <Container as="article" className="py-16 md:py-24">
      <h1 className="text-section text-center">{p.title}</h1>
      <SafeMarkdown source={p.body} className="mx-auto mt-10 max-w-[720px]" />
    </Container>
  );
}
