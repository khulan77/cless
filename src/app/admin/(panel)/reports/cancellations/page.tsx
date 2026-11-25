import Link from "next/link";
import { FilterBar } from "@/components/admin/FilterBar";
import { DownloadCsv } from "@/components/admin/reports/DownloadCsv";
import { RangePicker } from "@/components/admin/reports/RangePicker";
import { ReportTabs } from "@/components/admin/reports/ReportTabs";
import { Badge, EmptyState, PageHeader, Table, inputClass, tdClass, thClass } from "@/components/admin/ui";
import { t } from "@/i18n";
import { formatDateLabel, formatDateTime, formatTime } from "@/lib/time";
import { requirePagePermission } from "@/server/auth/session";
import { CANCEL_CATEGORIES, CANCEL_CATEGORY_LABELS } from "@/server/modules/appointments/cancel";
import { bookableStaff } from "@/server/modules/appointments/repo";
import { listCancellations } from "@/server/modules/reports/cancellations";
import { presetRange, rangeFromParams } from "@/server/modules/reports/definitions";

export const metadata = { title: "Цуцлалт — Тайлан" };
export const instant = false;

const R = t.admin.report;
const C = R.cancellations;
type Sp = Promise<{ from?: string; to?: string; preset?: string; staff?: string; category?: string }>;

export default async function CancellationsPage({ searchParams }: { searchParams: Sp }) {
  await requirePagePermission("report:read");
  const sp = await searchParams;
  const { range, preset } = rangeFromParams(sp);
  const staffId = sp.staff || null;
  const category = sp.category || null;
  const [{ rows, byCategory }, staff] = await Promise.all([listCancellations(range, { staffId, category }), bookableStaff()]);
  const presets = { today: presetRange("today"), week: presetRange("week"), month: presetRange("month"), lastMonth: presetRange("lastMonth") };
  const label = (c: string | null) => (c ? CANCEL_CATEGORY_LABELS[c as keyof typeof CANCEL_CATEGORY_LABELS] : C.unknown);
  const base = "/admin/reports/cancellations";

  return (
    <>
      <div className="mb-5">
        <ReportTabs active="cancellations" from={range.from} to={range.to} />
      </div>
      <PageHeader
        eyebrow={C.eyebrow}
        title={C.title}
        description={C.description}
        actions={<RangePicker from={range.from} to={range.to} preset={preset} presets={presets} base={base} keep={{ staff: staffId ?? undefined, category: category ?? undefined }} />}
      />

      <FilterBar action={base} resetHref={staffId || category ? `${base}?from=${range.from}&to=${range.to}` : undefined}>
        <input type="hidden" name="from" value={range.from} />
        <input type="hidden" name="to" value={range.to} />
        <label className="text-[13px] text-ink-soft">
          <span className="mb-1 block">{C.staff}</span>
          <select name="staff" defaultValue={staffId ?? ""} className={`${inputClass} w-52`}>
            <option value="">{C.allStaff}</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[13px] text-ink-soft">
          <span className="mb-1 block">{C.category}</span>
          <select name="category" defaultValue={category ?? ""} className={`${inputClass} w-52`}>
            <option value="">{C.allCategories}</option>
            {CANCEL_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CANCEL_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
      </FilterBar>

      {rows.length === 0 ? (
        <EmptyState title={C.empty} />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2 text-[14px]">
            <span className="font-medium text-ink">{C.count(rows.length)}</span>
            <span className="text-ink-faint">·</span>
            {byCategory.map((b) => (
              <Badge key={b.category ?? "none"} tone="neutral">
                {label(b.category)}: {b.count}
              </Badge>
            ))}
            <span className="ml-auto">
              <DownloadCsv
                filename={`cancellations_${range.from}_${range.to}.csv`}
                rows={[
                  [C.date, C.customer, C.staff, C.service, C.cancelledBy, C.cancelledAt, C.reason, C.note],
                  ...rows.map((r) => [
                    formatDateTime(r.startsAt),
                    r.customer.name,
                    r.staff,
                    r.service,
                    r.cancelledBy,
                    r.cancelledAt ? formatDateTime(r.cancelledAt) : null,
                    label(r.category),
                    r.reason && r.reason !== label(r.category) ? r.reason : null,
                  ]),
                ]}
              />
            </span>
          </div>
          <Table>
            <thead>
              <tr>
                <th className={thClass}>{C.date}</th>
                <th className={thClass}>{C.customer}</th>
                <th className={thClass}>{C.staff}</th>
                <th className={thClass}>{C.service}</th>
                <th className={thClass}>{C.cancelledBy}</th>
                <th className={thClass}>{C.reason}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className={`${tdClass} whitespace-nowrap tabular-nums`}>
                    {formatDateLabel(r.startsAt)} {formatTime(r.startsAt)}
                  </td>
                  <td className={tdClass}>
                    <Link href={`/admin/customers/${r.customer.id}`} className="hover:underline">
                      {r.customer.name}
                    </Link>
                  </td>
                  <td className={tdClass}>{r.staff}</td>
                  <td className={tdClass}>{r.service}</td>
                  <td className={tdClass}>
                    {r.cancelledBy ?? "—"}
                    {r.cancelledAt && <span className="block text-[13px] text-ink-soft tabular-nums">{formatDateTime(r.cancelledAt)}</span>}
                  </td>
                  <td className={tdClass}>
                    {label(r.category)}
                    {r.reason && r.reason !== label(r.category) && <span className="block text-[13px] text-ink-soft">{r.reason}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}
    </>
  );
}
