import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomerNotes } from "@/components/admin/customers/CustomerNotes";
import { MeTabs } from "@/components/admin/me/MeTabs";
import { VisitSummary } from "@/components/admin/visits/VisitSummary";
import { Badge, Card, PageHeader } from "@/components/admin/ui";
import { statusTone } from "@/components/admin/calendar/status";
import { t } from "@/i18n";
import { formatDateLabel, formatTime, ubDateKey } from "@/lib/time";
import { can } from "@/server/auth/permissions";
import { requirePagePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { canSeeCustomer } from "@/server/modules/customers/access";
import { noteViews } from "@/server/modules/customers/notes";
import { concernNames } from "@/server/modules/visits/service";

export const metadata = { title: "Үйлчлүүлэгч" };
export const instant = false;

const M = t.admin.me;

/**
 * Гоо сайханчийн харагдац: зөвхөн өөрийн үйлчилсэн үйлчлүүлэгч (бусад → 404), утас/имэйлгүй, зөвхөн
 * харах — үйлчилгээний түүх, оношлогоо; ганц үл хамаарах зүйл нь тэмдэглэл.
 */
export default async function MyCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission("me:read");
  const { id } = await params;
  if (!(await canSeeCustomer(user, id))) notFound();
  const [customer, appts, visits, notes] = await Promise.all([
    db.customer.findUnique({ where: { id }, select: { id: true, name: true, skinType: true } }),
    db.appointment.findMany({
      where: { customerId: id },
      orderBy: { startsAt: "desc" },
      take: 100,
      select: { id: true, startsAt: true, status: true, service: { select: { name: true } }, staff: { select: { name: true } } },
    }),
    db.visit.findMany({
      where: { customerId: id },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { conductedBy: { select: { name: true } }, recommendations: { orderBy: { sortOrder: "asc" }, include: { variant: { select: { size: true, product: { select: { name: true } } } } } } },
    }),
    noteViews(id, user),
  ]);
  if (!customer) notFound();
  const slugs = [...new Set(visits.flatMap((v) => v.concerns))];
  const concernName = new Map((await concernNames(slugs)).map((name, i) => [slugs[i]!, name]));

  return (
    <>
      <div className="mb-5">
        <MeTabs active="customers" />
      </div>
      <Link href="/admin/me/customers" className="mb-3 inline-block text-[14px] text-ink-soft hover:underline">
        ← {M.back}
      </Link>
      <PageHeader title={customer.name} description={[customer.skinType ? t.admin.skinTypes[customer.skinType] : null, M.readOnly].filter(Boolean).join(" · ")} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={t.admin.notes.title} description={t.admin.notes.rule}>
          <CustomerNotes customerId={customer.id} notes={notes} canWrite={can(user.role, "customer-note:write")} />
        </Card>
        <Card title={M.history}>
          {appts.length === 0 ? (
            <p className="text-[14px] text-ink-soft">—</p>
          ) : (
            <ul className="-my-2 divide-y divide-hairline text-[14px]">
              {appts.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <span>
                    <span className="tabular-nums">{formatDateLabel(a.startsAt)} {formatTime(a.startsAt)}</span> · {a.service.name}
                    <span className="block text-[13px] text-ink-soft">{a.staff.name}</span>
                  </span>
                  <Badge tone={statusTone(a.status)}>{t.admin.apptStatus[a.status]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={M.diagnoses} className="lg:col-span-2">
          {visits.length === 0 ? (
            <p className="text-[14px] text-ink-soft">—</p>
          ) : (
            <ul className="-my-2 divide-y divide-hairline">
              {visits.map((v) => (
                <li key={v.id} className="py-3 text-[14px]">
                  <VisitSummary
                    visit={{
                      conductedBy: v.conductedBy.name,
                      date: ubDateKey(v.createdAt),
                      skinType: v.skinType,
                      concerns: v.concerns.map((s) => concernName.get(s) ?? s),
                      notes: v.diagnosisNotes,
                      recommendations: v.recommendations.map((r) => ({ id: r.id, name: `${r.variant.product.name} · ${r.variant.size}`, instructions: r.instructions, purchased: r.purchased })),
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
