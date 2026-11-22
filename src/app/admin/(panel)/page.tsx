import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, Card, PageHeader, tdClass, thClass } from "@/components/admin/ui";
import { db } from "@/server/db";
import { can } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";

export const metadata = { title: "Хянах самбар" };
// Нэвтэрсэн хэрэглэгчийн динамик хуудас — request бүрт render (Cache Components validation-аас гаргана)
export const instant = false;

function startOfTodayUB() {
  // Монгол цаг (UTC+8)-ээр өнөөдрийн эхлэл
  const now = new Date();
  const ub = new Date(now.getTime() + 8 * 3600_000);
  ub.setUTCHours(0, 0, 0, 0);
  return new Date(ub.getTime() - 8 * 3600_000);
}

export default async function DashboardPage() {
  const user = await requireUser();
  if (!can(user.role, "schedule:all")) redirect("/admin/schedule");

  const today = startOfTodayUB();
  const tomorrow = new Date(today.getTime() + 24 * 3600_000);
  const lowStockWhere = { isActive: true, stock: { lte: db.variant.fields.lowStockAt } };

  const [published, drafts, lowCount, lowList, services, appointments, users] = await Promise.all([
    db.product.count({ where: { isPublished: true } }),
    db.product.count({ where: { isPublished: false } }),
    db.variant.count({ where: lowStockWhere }),
    db.variant.findMany({
      where: lowStockWhere,
      orderBy: { stock: "asc" },
      take: 6,
      select: { id: true, sku: true, size: true, stock: true, lowStockAt: true, product: { select: { name: true } } },
    }),
    db.service.count({ where: { isActive: true } }),
    db.appointment.count({ where: { startsAt: { gte: today, lt: tomorrow }, status: { notIn: ["CANCELLED", "NO_SHOW"] } } }),
    can(user.role, "user:write") ? db.user.count({ where: { isActive: true } }) : Promise.resolve(null),
  ]);

  const stats = [
    { label: "Нийтлэгдсэн бүтээгдэхүүн", value: published, hint: `${drafts} ноорог`, href: can(user.role, "product:write") ? "/admin/products" : undefined },
    { label: "Бага үлдэгдэлтэй хувилбар", value: lowCount, hint: "босгоос доош", href: "/admin/inventory?low=1", alert: lowCount > 0 },
    { label: "Идэвхтэй үйлчилгээ", value: services, href: can(user.role, "service:write") ? "/admin/services" : undefined },
    { label: "Өнөөдрийн цаг", value: appointments, hint: "Календарь удахгүй" },
    ...(users !== null ? [{ label: "Идэвхтэй хэрэглэгч", value: users, href: "/admin/users" }] : []),
  ];

  return (
    <>
      <PageHeader title={`Сайн байна уу, ${user.name}`} description="Өнөөдрийн товч мэдээлэл" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((s) => {
          const body = (
            <>
              <p className="text-[12px] text-navy/55">{s.label}</p>
              <p className={`mt-2 text-[28px] font-light tabular-nums ${"alert" in s && s.alert ? "text-red-700" : ""}`}>{s.value}</p>
              {s.hint && <p className="mt-0.5 text-[12px] text-navy/45">{s.hint}</p>}
            </>
          );
          return s.href ? (
            <Link key={s.label} href={s.href} className="rounded-lg border border-line bg-white p-4 hover:border-navy/40">
              {body}
            </Link>
          ) : (
            <div key={s.label} className="rounded-lg border border-line bg-white p-4">
              {body}
            </div>
          );
        })}
      </div>

      <Card title="Бага үлдэгдэл" className="mt-6" actions={<Link href="/admin/inventory?low=1" className="text-[13px] underline underline-offset-4">Бүгдийг харах</Link>}>
        {lowList.length === 0 ? (
          <p className="text-[14px] text-navy/60">Бүх хувилбарын үлдэгдэл хангалттай байна.</p>
        ) : (
          <table className="-mx-5 -my-5 w-[calc(100%+40px)] text-[13.5px]">
            <thead>
              <tr>
                <th className={thClass}>Бүтээгдэхүүн</th>
                <th className={thClass}>SKU</th>
                <th className={`${thClass} text-right`}>Үлдэгдэл</th>
              </tr>
            </thead>
            <tbody>
              {lowList.map((v) => (
                <tr key={v.id}>
                  <td className={tdClass}>
                    {v.product.name} <span className="text-navy/50">· {v.size}</span>
                  </td>
                  <td className={`${tdClass} font-mono text-[12px]`}>{v.sku}</td>
                  <td className={`${tdClass} text-right`}>
                    <Badge tone="red">
                      {v.stock} / {v.lowStockAt}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
