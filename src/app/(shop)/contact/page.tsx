import { ComingSoon } from "@/components/ui/ComingSoon";
import { t } from "@/i18n";

export const metadata = { title: t.pages.contact.title };

export default function Page() {
  return <ComingSoon title={t.pages.contact.title} text={t.pages.contact.text} />;
}
