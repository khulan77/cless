import { Users } from "lucide-react";
import Link from "next/link";
import { MeTabs } from "@/components/admin/me/MeTabs";
import { Avatar, EmptyState, PageHeader, Table, tdClass, thClass } from "@/components/admin/ui";
import { t } from "@/i18n";
import { formatDateLabel } from "@/lib/time";
import { requirePagePermission } from "@/server/auth/session";
import { myCustomers } from "@/server/modules/staff/dashboard";

export const metadata = { title: "Миний үйлчлүүлэгчид" };
export const instant = false;

const M = t.admin.me;

/** Зөвхөн өөрийн үйлчилсэн үйлчлүүлэгчид (server-side), утас/имэйлгүй */
export default async function MyCustomersPage() {
  const user = await requirePagePermission("me:read");
  const list = await myCustomers(user.id);
  return (
    <>
      <div className="mb-5">
        <MeTabs active="customers" />
      </div>
      <PageHeader title={M.customersTitle} description={M.customersHint} />
      {list.length === 0 ? (
        <EmptyState icon={Users} title={M.noCustomers} />
      ) : (
        <Table>
          <thead>
            <tr>
              <th className={thClass}>{M.name}</th>
              <th className={thClass}>{t.admin.customers.history.skinType}</th>
              <th className={thClass}>{M.lastService}</th>
              <th className={`${thClass} text-right`}>{M.qty}</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id}>
                <td className={tdClass}>
                  <Link href={`/admin/me/customers/${c.id}`} className="flex items-center gap-3 font-medium hover:underline">
                    <Avatar name={c.name} id={c.id} size={32} />
                    {c.name}
                  </Link>
                </td>
                <td className={tdClass}>{c.skinType ? t.admin.skinTypes[c.skinType] : "—"}</td>
                <td className={tdClass}>{c.last ? `${formatDateLabel(c.last.at)} · ${c.last.service}` : "—"}</td>
                <td className={`${tdClass} text-right tabular-nums`}>{M.servicesCount(c.services)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
