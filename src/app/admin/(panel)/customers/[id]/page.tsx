import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomerFormButton } from "@/components/admin/customers/CustomerForm";
import { ResendEmailButton } from "@/components/admin/sales/SaleActions";
import { Badge, Card, PageHeader, btnClass } from "@/components/admin/ui";
import { t } from "@/i18n";
import { formatMNT } from "@/lib/money";
import { saleStatusTone } from "@/lib/sale-status";
import { ubDateKey } from "@/lib/ub-time";
import { can } from "@/server/auth/permissions";
import { requirePagePermission } from "@/server/auth/session";
import { customerProfile } from "@/server/modules/customers/service";
import { concernNames } from "@/server/modules/visits/service";
import { VisitSummary } from "@/components/admin/visits/VisitSummary";

export const metadata = { title: "Үйлчлүүлэгч" };
export const instant = false;

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission("customer:read");
  const { id } = await params;
  const profile = await customerProfile(id);
  if (!profile) notFound();
  const { customer: c, visits, sales, totalSpent, paidSalesCount } = profile;
  const slugs = [...new Set(visits.flatMap((v) => v.concerns))];
  const concernName = new Map((await concernNames(slugs)).map((name, i) => [slugs[i]!, name]));

  return (
    <>
      <PageHeader
        title={c.name}
        description={[c.phone, c.email].filter(Boolean).join(" · ")}
        actions={
          <>
            {can(user.role, "pos:use") && (
              <Link href="/admin/pos" className={btnClass("primary")}>
                POS
              </Link>
            )}
            {can(user.role, "customer:write") && (
              <CustomerFormButton
                id={c.id}
                label={t.admin.customers.edit}
                initial={{
                  name: c.name,
                  phone: c.phone,
                  email: c.email ?? "",
                  birthday: c.birthday ? c.birthday.toISOString().slice(0, 10) : "",
                  skinType: c.skinType ?? "",
                  notes: c.notes ?? "",
                  marketingConsent: c.marketingConsent,
                }}
              />
            )}
          </>
        }
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        {[
          ["Нийт зарцуулалт", formatMNT(totalSpent)],
          ["Төлсөн борлуулалт", String(paidSalesCount)],
          ["Айлчлал", String(visits.length)],
          ["Арьсны төрөл", c.skinType ? t.admin.skinTypes[c.skinType] : "—"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-line bg-white p-4">
            <p className="text-[12px] text-navy/55">{k}</p>
            <p className="mt-1.5 text-[20px] font-light tabular-nums">{v}</p>
          </div>
        ))}
      </div>
      {c.notes && <p className="mb-5 whitespace-pre-line rounded-lg border border-line bg-white p-4 text-[14px]">{c.notes}</p>}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Айлчлалууд">
          {visits.length === 0 ? (
            <p className="text-[14px] text-navy/55">Айлчлал алга.</p>
          ) : (
            <ul className="-my-2 divide-y divide-line">
              {visits.map((v) => (
                <li key={v.id} className="space-y-2 py-3 text-[13.5px]">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Badge tone={v.emailStatus === "SENT" ? "green" : v.emailStatus === "FAILED" ? "red" : "neutral"}>{t.admin.emailStatus[v.emailStatus]}</Badge>
                    {c.email && can(user.role, "visit:write") && <ResendEmailButton visitId={v.id} />}
                  </div>
                  <VisitSummary
                    visit={{
                      conductedBy: v.conductedBy.name,
                      date: ubDateKey(v.createdAt),
                      skinType: v.skinType,
                      concerns: v.concerns.map((slug) => concernName.get(slug) ?? slug),
                      notes: v.diagnosisNotes,
                      recommendations: v.recommendations.map((r) => ({
                        id: r.id,
                        name: `${r.variant.product.name} · ${r.variant.size}`,
                        instructions: r.instructions,
                        purchased: r.purchased,
                      })),
                    }}
                  />
                  {v.sale && (
                    <Link href={`/admin/sales/${v.sale.id}`} className="text-[12px] underline underline-offset-4">
                      {v.sale.number}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Борлуулалт">
          {sales.length === 0 ? (
            <p className="text-[14px] text-navy/55">Борлуулалт алга.</p>
          ) : (
            <ul className="-my-2 divide-y divide-line text-[13.5px]">
              {sales.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                  <Link href={`/admin/sales/${s.id}`} className="font-mono text-[12.5px] hover:underline">
                    {s.number ?? "—"}
                  </Link>
                  <span className="text-navy/55">{ubDateKey(s.createdAt)}</span>
                  <Badge tone={saleStatusTone(s.status)}>{t.admin.saleStatus[s.status]}</Badge>
                  <span className="tabular-nums">{formatMNT(s.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
