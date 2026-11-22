import { ComingSoon } from "@/components/ui/ComingSoon";
import { t } from "@/i18n";

export const metadata = { title: t.pages.privacy.title };

export default function Page() {
  return <ComingSoon title={t.pages.privacy.title} text={t.pages.privacy.text} />;
}
