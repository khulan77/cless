import { ComingSoon } from "@/components/ui/ComingSoon";
import { t } from "@/i18n";

export const metadata = { title: t.pages.shipping.title };

export default function Page() {
  return <ComingSoon title={t.pages.shipping.title} text={t.pages.shipping.text} />;
}
