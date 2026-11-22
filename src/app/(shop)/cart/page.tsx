import { ComingSoon } from "@/components/ui/ComingSoon";
import { t } from "@/i18n";

export const metadata = { title: t.pages.cart.title };

export default function Page() {
  return <ComingSoon title={t.pages.cart.title} text={t.pages.cart.text} />;
}
