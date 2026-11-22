import { ComingSoon } from "@/components/ui/ComingSoon";
import { t } from "@/i18n";

export const metadata = { title: t.pages.search.title };

export default function Page() {
  return <ComingSoon title={t.pages.search.title} text={t.pages.search.text} />;
}
