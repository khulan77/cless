import Link from "next/link";
import { MonthlyBars } from "@/components/admin/reports/MonthlyBars";
import { RangePicker } from "@/components/admin/reports/RangePicker";
import { ReportTabs } from "@/components/admin/reports/ReportTabs";
import { Card, EmptyState, PageHeader, Table, btnClass, tdClass, thClass } from "@/components/admin/ui";
import { t } from "@/i18n";
import { formatMNT } from "@/lib/money";
import { can } from "@/server/auth/permissions";
import { requirePagePermission } from "@/server/auth/session";
import { presetRange, rangeBounds, rangeFromParams } from "@/server/modules/reports/definitions";
import { serviceUseReport } from "@/server/modules/inventory/service-use";
import { productAnalytics, productDetail, type ProductRow } from "@/server/modules/reports/products";

export const metadata = { title: "Бүтээгдэхүүн — Тайлан" };
export const instant = false;

const P = t.admin.report.products;
type Sp = Promise<{ from?: string; to?: string; preset?: string; variant?: string }>;
const num = (n: number) => n.toLocaleString("mn-MN", { maximumFractionDigits: 2 });

function StaffTable({ rows }: { rows: ProductRow["byStaff"] }) {
  return (
    <Table>
      <thead>
        <tr>
          <th className={thClass}>{P.staff}</th>
          <th className={`${thClass} text-right`}>{P.soldQty}</th>
          <th className={`${thClass} text-right`}>{P.revenue}</th>
          <th className={`${thClass} text-right`}>{P.usedQty}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((s) => (
          <tr key={s.staffId}>
            <td className={tdClass}>{s.name ?? P.unknownStaff}</td>
            <td className={`${tdClass} text-right tabular-nums`}>{num(s.soldQty)}</td>
            <td className={`${tdClass} text-right tabular-nums`}>{formatMNT(s.revenue)}</td>
            <td className={`${tdClass} text-right tabular-nums`}>{num(s.usedQty)}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export default async function ProductReportPage({ searchParams }: { searchParams: Sp }) {
  const user = await requirePagePermission("report:read");
  const sp = await searchParams;
  const { range, preset } = rangeFromParams(sp);
  const base = "/admin/reports/products";
  const q = `from=${range.from}&to=${range.to}`;
  const presets = { today: presetRange("today"), week: presetRange("week"), month: presetRange("month"), lastMonth: presetRange("lastMonth") };
  const excel = (
    <a href={`/api/admin/reports/products.xlsx?${q}`} className={btnClass("secondary", "md")} download>
      {P.excel}
    </a>
  );

  const header = (
    <>
      <div className="mb-5">
        <ReportTabs active="products" from={range.from} to={range.to} showPayroll={can(user.role, "payroll:read")} />
      </div>
      <PageHeader
        eyebrow={P.eyebrow}
        title={P.title}
        description={P.description}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <RangePicker from={range.from} to={range.to} preset={preset} presets={presets} base={base} keep={{ variant: sp.variant }} />
            {excel}
          </div>
        }
      />
    </>
  );

  if (sp.variant) {
    const d = await productDetail(sp.variant, range);
    return (
      <>
        {header}
        <Link href={`${base}?${q}`} className="mb-4 inline-block text-[14px] text-ink-soft hover:text-ink hover:underline">
          ← {P.back}
        </Link>
        <h2 className="mb-1 text-[20px] font-semibold">{d.name}</h2>
        <p className="mb-5 text-[14px] text-ink-soft tabular-nums">{d.sku}</p>
        <div className="grid gap-6">
          <Card title={P.monthly} description={`${P.revenue} · ${P.soldQty}·${P.usedQty}`}>
            <MonthlyBars months={d.months} label={P.monthly} />
          </Card>
          <section>
            <h3 className="mb-3 font-display text-[22px] font-semibold leading-tight">{P.byStaff}</h3>
            {d.byStaff.length === 0 ? <p className="text-[14px] text-ink-soft">{P.empty}</p> : <StaffTable rows={d.byStaff} />}
          </section>
        </div>
      </>
    );
  }

  const { start, end } = rangeBounds(range);
  const [rows, use] = await Promise.all([productAnalytics(range), serviceUseReport(start, end)]);
  const canCost = can(user.role, "cost:read");
  const tot = rows.reduce((a, r) => ({ sold: a.sold + r.soldQty, rev: a.rev + r.revenue, used: a.used + r.usedQty }), { sold: 0, rev: 0, used: 0 });
  return (
    <>
      {header}
      {rows.length === 0 ? (
        <EmptyState title={P.empty} />
      ) : (
        <>
          <p className="mb-3 text-[14px] font-medium">{P.count(rows.length)}</p>
          <Table>
            <thead>
              <tr>
                <th className={thClass}>{P.name}</th>
                <th className={thClass}>{P.sku}</th>
                <th className={`${thClass} text-right`}>{P.soldQty}</th>
                <th className={`${thClass} text-right`}>{P.revenue}</th>
                <th className={`${thClass} text-right`}>{P.usedQty}</th>
                <th className={thClass}>{P.staff}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.variantId}>
                  <td className={tdClass}>
                    <Link href={`${base}?${q}&variant=${r.variantId}`} className="font-medium hover:underline">
                      {r.name}
                    </Link>
                  </td>
                  <td className={`${tdClass} text-[13px] text-ink-soft tabular-nums`}>
                    {r.sku}
                    {r.barcode && <span className="block">{r.barcode}</span>}
                  </td>
                  <td className={`${tdClass} text-right tabular-nums`}>{num(r.soldQty)}</td>
                  <td className={`${tdClass} text-right tabular-nums`}>{formatMNT(r.revenue)}</td>
                  <td className={`${tdClass} text-right tabular-nums`}>{num(r.usedQty)}</td>
                  <td className={`${tdClass} text-[13px] text-ink-soft`}>
                    {r.byStaff
                      .slice(0, 3)
                      .map((s) => `${s.name ?? P.unknownStaff}: ${num(s.soldQty)}${s.usedQty ? ` / ${num(s.usedQty)}` : ""}`)
                      .join(" · ")}
                    {r.byStaff.length > 3 ? " …" : ""}
                  </td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className={tdClass}>{P.totals}</td>
                <td className={tdClass} />
                <td className={`${tdClass} text-right tabular-nums`}>{num(tot.sold)}</td>
                <td className={`${tdClass} text-right tabular-nums`}>{formatMNT(tot.rev)}</td>
                <td className={`${tdClass} text-right tabular-nums`}>{num(Math.round(tot.used * 100) / 100)}</td>
                <td className={tdClass} />
              </tr>
            </tbody>
          </Table>
        </>
      )}

      {/* PROMPT 27: менежерийн «Үйлчилгээнд олгох»-оор бүртгэсэн бодит зарцуулалт (өртгөөр), гоо сайханч бүрээр */}
      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <Card title="Үйлчилгээнд зарцуулсан бүтээгдэхүүн" description={canCost ? `Нийт өртөг: ${formatMNT(use.totalCost)}` : "Бодит олголтоор (ширхэг / сав)"}>
          {use.byProduct.length === 0 ? (
            <p className="text-[14px] text-ink-soft">Энэ хугацаанд үйлчилгээнд олгосон бүтээгдэхүүн алга.</p>
          ) : (
            <ul className="divide-y divide-hairline text-[14px]">
              {use.byProduct.map((p) => (
                <li key={p.key} className="flex justify-between gap-3 py-2">
                  <span>{p.name}</span>
                  <span className="tabular-nums">{p.qty}{canCost ? ` · ${formatMNT(p.cost)}` : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Гоо сайханч бүрээр">
          {use.byStaff.length === 0 ? (
            <p className="text-[14px] text-ink-soft">—</p>
          ) : (
            <ul className="divide-y divide-hairline text-[14px]">
              {use.byStaff.map((p) => (
                <li key={p.key} className="flex justify-between gap-3 py-2">
                  <span>{p.name}</span>
                  <span className="tabular-nums">{p.qty}{canCost ? ` · ${formatMNT(p.cost)}` : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
