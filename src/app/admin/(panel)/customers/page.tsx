import Link from "next/link";
import { CustomerFormButton } from "@/components/admin/customers/CustomerForm";
import { FilterBar } from "@/components/admin/FilterBar";
import { Pagination, parsePage, str } from "@/components/admin/Pagination";
import { Avatar, EmptyState, PageHeader, Table, inputClass, tdClass, thClass } from "@/components/admin/ui";
import { t } from "@/i18n";
import { can } from "@/server/auth/permissions";
import { requirePagePermission } from "@/server/auth/session";
import { listCustomers } from "@/server/modules/customers/service";

export const metadata = { title: "Үйлчлүүлэгчид" };
export const instant = false;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePagePermission("customer:read");
  const sp = await searchParams;
  const q = str(sp.q);
  const { rows, count, page, pageSize } = await listCustomers({ q, page: parsePage(sp.page) });

  return (
    <>
      <PageHeader
        eyebrow="Үйлчлүүлэгч"
        title="Үйлчлүүлэгчид"
        description={`Салонд ирсэн, худалдан авалт хийсэн үйлчлүүлэгчид · нийт ${count}`}
        actions={can(user.role, "customer:write") && <CustomerFormButton label={t.admin.customers.create} />}
      />
      <FilterBar action="/admin/customers" resetHref={q ? "/admin/customers" : undefined}>
        <input name="q" defaultValue={q} placeholder="Нэр, утас, имэйлээр хайх" aria-label="Хайх" className={`${inputClass} w-80`} />
      </FilterBar>
      {rows.length === 0 ? (
        <EmptyState title={q ? "Хайлтад тохирох үйлчлүүлэгч алга" : "Одоогоор үйлчлүүлэгч алга"}>Цаг захиалах эсвэл касс дээр шинэ үйлчлүүлэгч нэмэгдэнэ.</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <th className={thClass}>Нэр</th>
              <th className={thClass}>Утас</th>
              <th className={thClass}>Имэйл</th>
              <th className={thClass}>Арьсны төрөл</th>
              <th className={`${thClass} text-right`}>Айлчлал</th>
              <th className={`${thClass} text-right`}>Борлуулалт</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="hover:bg-canvas">
                <td className={tdClass}>
                  <Link href={`/admin/customers/${c.id}`} className="flex items-center gap-3 font-medium hover:underline">
                    <Avatar name={c.name} id={c.id} size={32} />
                    {c.name}
                  </Link>
                </td>
                <td className={`${tdClass} tabular-nums`}>{c.phone}</td>
                <td className={tdClass}>{c.email ?? "—"}</td>
                <td className={tdClass}>{c.skinType ? t.admin.skinTypes[c.skinType] : "—"}</td>
                <td className={`${tdClass} text-right tabular-nums`}>{c._count.visits}</td>
                <td className={`${tdClass} text-right tabular-nums`}>{c._count.sales}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Pagination page={page} pageSize={pageSize} total={count} basePath="/admin/customers" params={{ q }} />
    </>
  );
}
