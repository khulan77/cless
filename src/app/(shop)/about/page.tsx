import { ComingSoon } from "@/components/ui/ComingSoon";
import { t } from "@/i18n";

export const metadata = { title: t.pages.about.title };

export default function Page() {
  return <ComingSoon title={t.pages.about.title} text={t.pages.about.text} />;
}
