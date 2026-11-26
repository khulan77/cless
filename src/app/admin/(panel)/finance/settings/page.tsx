import { CategoryRow, FinanceSettingsForm } from "@/components/admin/finance/FinanceSettingsForms";
import { Card, PageHeader } from "@/components/admin/ui";
import { ubDateKey } from "@/lib/time";
import { requirePagePermission } from "@/server/auth/session";
import { expenseCategories } from "@/server/modules/finance/expenses";
import { getFinanceSettings } from "@/server/modules/finance/settings";

export const metadata = { title: "Санхүүгийн тохиргоо" };
export const instant = false;

export default async function FinanceSettingsPage() {
  await requirePagePermission("expense:write");
  const [settings, cats] = await Promise.all([getFinanceSettings(), expenseCategories({ includeInactive: true })]);
  return (
    <>
      <PageHeader eyebrow="Санхүү" title="Санхүүгийн тохиргоо" description="Ресепшний хандалт, мөнгөн гүйлгээний эхний үлдэгдэл, зардлын ангилал (нягтлангийн дансны код)." />
      <div className="grid gap-6">
        <Card title="Хандалт ба эхний үлдэгдэл">
          <FinanceSettingsForm initial={settings} today={ubDateKey()} />
        </Card>
        <Card title="Зардлын ангилал" description="Кодыг нягтлангийн дансны кодоор солино уу. Системийн ангилалд (цалин, НДШ, ХХОАТ) зөвхөн код, нэрийг засна.">
          {cats.map((c) => (
            <CategoryRow key={c.id} c={c} />
          ))}
          <h4 className="mt-4 text-[14px] font-medium">Шинэ ангилал</h4>
          <CategoryRow c={null} />
        </Card>
      </div>
    </>
  );
}
