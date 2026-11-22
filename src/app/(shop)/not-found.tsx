import { PillLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { t } from "@/i18n";

export default function ShopNotFound() {
  return (
    <Container as="section" className="flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
      <p className="text-micro text-muted">{t.notFound.code}</p>
      <h1 className="text-section mt-3">{t.notFound.title}</h1>
      <p className="mt-4 max-w-[46ch] text-muted">{t.notFound.text}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <PillLink href="/">{t.common.backHome}</PillLink>
        <PillLink href="/collections">{t.common.viewAllProducts}</PillLink>
      </div>
    </Container>
  );
}
