import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomerFormButton } from "@/components/admin/customers/CustomerForm";
import { CustomerNotes } from "@/components/admin/customers/CustomerNotes";
import { ResendEmailButton } from "@/components/admin/sales/SaleActions";
import { Badge, Card, EmptyState, PageHeader, SegmentedTabs, Table, btnClass, tdClass, thClass } from "@/components/admin/ui";
import { t } from "@/i18n";
import { formatMNT } from "@/lib/money";
import { saleStatusTone } from "@/lib/sale-status";
import { formatDateLabel, formatTime, ubDateKey } from "@/lib/time";
import { can } from "@/server/auth/permissions";
import { requirePagePermission } from "@/server/auth/session";
import { customerHistory } from "@/server/modules/customers/history";
import { noteViews } from "@/server/modules/customers/notes";
import { photoPanel } from "@/server/modules/visits/photos";
import { customerProfile } from "@/server/modules/customers/service";
import { concernNames } from "@/server/modules/visits/service";
import { VisitPhotos } from "@/components/admin/visits/VisitPhotos";
import { VisitSummary } from "@/components/admin/visits/VisitSummary";

export const metadata = { title: "Үйлчлүүлэгч" };
export const instant = false;

const H = t.admin.customers.history;
const TABS = ["services", "products", "visits", "photos", "notes", "sales"] as const;
type Tab = (typeof TABS)[number];

export default async function CustomerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const user = await requirePagePermission("customer:read");
  const { id } = await params;
  const tab: Tab = (TABS as readonly string[]).includes((await searchParams).tab ?? "") ? ((await searchParams).tab as Tab) : "services";
  const [profile, history, notes, photos] = await Promise.all([
    customerProfile(id),
    customerHistory(id),
    tab === "notes" ? noteViews(id, user) : null,
    tab === "photos" && can(user.role, "visit-photo:read") ? photoPanel(id, user) : null,
  ]);
  if (!profile) notFound();
  const { customer: c, visits, sales } = profile;
  const slugs = [...new Set(visits.flatMap((v) => v.concerns))];
  const concernName = new Map((await concernNames(slugs)).map((name, i) => [slugs[i]!, name]));

  return (
    <>
      <PageHeader
        eyebrow="Үйлчлүүлэгч"
        title={c.name}
        description={[c.phone, c.email].filter(Boolean).join(" · ")}
        actions={
          <>
            {can(user.role, "pos:use") && (
              <Link href="/admin/pos" className={btnClass("primary")}>
                Төлбөр авах
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
      {/* Net of refunds (same rules as the reports) */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          [H.totalProduct, formatMNT(history.totals.product)],
          [H.totalService, formatMNT(history.totals.service)],
          [H.total, formatMNT(history.totals.total)],
          [H.visits, String(visits.length)],
          [H.skinType, c.skinType ? t.admin.skinTypes[c.skinType] : "—"],
        ].map(([k, v], i) => (
          <div key={k} className={`rounded-2xl border p-4 ${i === 2 ? "border-navy/20 bg-navy/[0.03]" : "border-hairline bg-white"}`}>
            <p className="text-[13px] text-ink-soft">{k}</p>
            <p className={`mt-1.5 text-[20px] tabular-nums ${i === 2 ? "font-semibold" : "font-light"}`}>{v}</p>
          </div>
        ))}
      </div>
      {c.notes && <p className="mb-5 whitespace-pre-line rounded-2xl border border-hairline bg-white p-4 text-[14px]">{c.notes}</p>}

      <div className="mb-4">
        <SegmentedTabs
          label={H.tabsLabel}
          value={tab}
          items={TABS.map((k) => ({ value: k, label: H.tabs[k], href: `/admin/customers/${c.id}?tab=${k}` }))}
        />
      </div>

      {tab === "services" &&
        (history.services.length === 0 ? (
          <EmptyState title={H.noServices} />
        ) : (
          <Table>
            <thead>
              <tr>
                <th className={thClass}>{H.date}</th>
                <th className={thClass}>{H.service}</th>
                <th className={thClass}>{H.staff}</th>
                <th className={`${thClass} text-right`}>{H.amount}</th>
                <th className={thClass}>{H.status}</th>
              </tr>
            </thead>
            <tbody>
              {history.services.map((r) => (
                <tr key={r.appointmentId ?? `${r.saleId}-${r.service}`}>
                  <td className={`${tdClass} whitespace-nowrap tabular-nums`}>
                    {formatDateLabel(r.at)} {formatTime(r.at)}
                  </td>
                  <td className={tdClass}>{r.service}</td>
                  <td className={tdClass}>{r.staff ?? "—"}</td>
                  <td className={`${tdClass} text-right tabular-nums`}>{r.amount === null ? "—" : formatMNT(r.amount)}</td>
                  <td className={tdClass}>
                    {r.status === "SOLD" ? <Badge tone="green">{H.sold}</Badge> : <Badge tone={r.status === "DONE" ? "green" : r.status === "CANCELLED" || r.status === "NO_SHOW" ? "red" : "neutral"}>{t.admin.apptStatus[r.status as keyof typeof t.admin.apptStatus]}</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ))}

      {tab === "products" &&
        (history.products.length === 0 ? (
          <EmptyState title={H.noProducts} />
        ) : (
          <Table>
            <thead>
              <tr>
                <th className={thClass}>{H.date}</th>
                <th className={thClass}>{H.code}</th>
                <th className={thClass}>{H.product}</th>
                <th className={thClass}>{H.size}</th>
                <th className={`${thClass} text-right`}>{H.qty}</th>
                <th className={`${thClass} text-right`}>{H.amount}</th>
                <th className={thClass}>{H.soldBy}</th>
              </tr>
            </thead>
            <tbody>
              {history.products.map((r, i) => (
                <tr key={`${r.saleId}-${i}`}>
                  <td className={`${tdClass} whitespace-nowrap tabular-nums`}>
                    <Link href={`/admin/sales/${r.saleId}`} className="hover:underline">
                      {formatDateLabel(r.at)}
                    </Link>
                  </td>
                  <td className={`${tdClass} font-mono text-[13px]`}>
                    {r.sku ?? "—"}
                    {r.barcode && <span className="block text-ink-soft">{r.barcode}</span>}
                  </td>
                  <td className={tdClass}>{r.name}</td>
                  <td className={tdClass}>{r.size ?? "—"}</td>
                  <td className={`${tdClass} text-right tabular-nums`}>{r.qty}</td>
                  <td className={`${tdClass} text-right tabular-nums`}>{formatMNT(r.amount)}</td>
                  <td className={tdClass}>{r.staff ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        ))}

      {tab === "visits" && (
        <Card title={H.tabs.visits}>
          {visits.length === 0 ? (
            <p className="text-[14px] text-ink-soft">Айлчлал алга.</p>
          ) : (
            <ul className="-my-2 divide-y divide-hairline">
              {visits.map((v) => (
                <li key={v.id} className="space-y-2 py-3 text-[14px]">
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
                    <Link href={`/admin/sales/${v.sale.id}`} className="text-[13px] underline underline-offset-4">
                      {v.sale.number}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === "photos" && photos && (
        <VisitPhotos
          customerId={c.id}
          consented={photos.consented}
          groups={photos.groups}
          targets={photos.targets.map((x) => ({ appointmentId: x.appointmentId, label: `${formatDateLabel(x.startsAt)} ${formatTime(x.startsAt)} · ${x.service}` }))}
          canWrite={can(user.role, "visit-photo:write")}
        />
      )}

      {tab === "notes" && notes && (
        <Card title={t.admin.notes.title} description={t.admin.notes.rule}>
          <CustomerNotes customerId={c.id} notes={notes} canWrite={can(user.role, "customer-note:write")} />
        </Card>
      )}

      {tab === "sales" && (
        <Card title={H.tabs.sales}>
          {sales.length === 0 ? (
            <p className="text-[14px] text-ink-soft">Борлуулалт алга.</p>
          ) : (
            <ul className="-my-2 divide-y divide-hairline text-[14px]">
              {sales.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                  <Link href={`/admin/sales/${s.id}`} className="font-mono text-[13px] hover:underline">
                    {s.number ?? "—"}
                  </Link>
                  <span className="text-ink-soft">{ubDateKey(s.createdAt)}</span>
                  <Badge tone={saleStatusTone(s.status)}>{t.admin.saleStatus[s.status]}</Badge>
                  <span className="tabular-nums">{formatMNT(s.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </>
  );
}
