import { ComingSoon } from "@/components/ui/ComingSoon";
import { t } from "@/i18n";

export const metadata = { title: t.pages.account.title };

export default function Page() {
  return <ComingSoon title={t.pages.account.title} text={t.pages.account.text} />;
}
