import { t } from "@/i18n";
import { PillLink } from "./Button";
import { Container } from "./Container";

/** Placeholder for pages that are not built yet (instead of a 404) */
export function ComingSoon({ title, text, back = { label: t.common.backHome, href: "/" } }: {
  title: string;
  text?: string;
  back?: { label: string; href: string };
}) {
  return (
    <Container as="section" className="flex min-h-[55vh] flex-col items-center justify-center py-24 text-center">
      <p className="text-micro text-muted">{t.common.comingSoon}</p>
      <h1 className="text-section mt-3">{title}</h1>
      <p className="mt-4 max-w-[46ch] text-muted">{text ?? t.comingSoon.defaultText}</p>
      <PillLink href={back.href} className="mt-8">
        {back.label}
      </PillLink>
    </Container>
  );
}
