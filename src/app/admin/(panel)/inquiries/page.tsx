import Link from "next/link";
import { InquiryStatusSelect } from "@/components/admin/inquiries/StatusSelect";
import { Badge, Card, PageHeader, Table, tdClass, thClass } from "@/components/admin/ui";
import { t } from "@/i18n";
import { formatMNT } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { requirePagePermission } from "@/server/auth/session";
import { INQUIRY_STATUSES, listInquiries } from "@/server/modules/inquiries/service";

export const metadata = { title: "Хүсэлтүүд" };
export const instant = false;

const s = t.admin.inquiries;
const TONE = { NEW: "red", CONTACTED: "amber", DONE: "green", CANCELLED: "neutral" } as const;

export default async function InquiriesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requirePagePermission("inquiry:manage");
  const { status: raw } = await searchParams;
  const status = INQUIRY_STATUSES.find((x) => x === raw);
  const rows = await listInquiries(status);

  return (
    <>
      <PageHeader eyebrow="Үйлчлүүлэгч" title={s.title} description={s.description} />
      <nav aria-label={s.changeStatus} className="mb-4 flex flex-wrap gap-1 border-b border-hairline">
        {[undefined, ...INQUIRY_STATUSES].map((k) => (
          <Link
            key={k ?? "all"}
            href={k ? `/admin/inquiries?status=${k}` : "/admin/inquiries"}
            aria-current={status === k ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-[14px] ${status === k ? "border-navy font-medium" : "border-transparent text-ink-soft hover:text-navy"}`}
          >
            {k ? s.status[k] : s.all}
          </Link>
        ))}
      </nav>
      <Card>
        {rows.length === 0 ? (
          <p className="text-[14px] text-ink-soft">{s.empty}</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <th className={thClass}>{s.when}</th>
                <th className={thClass}>{s.customer}</th>
                <th className={thClass}>{s.items}</th>
                <th className={thClass}>{s.note}</th>
                <th className={thClass}>{s.changeStatus}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} data-testid="inquiry-row">
                  <td className={`${tdClass} whitespace-nowrap tabular-nums`}>
                    {formatDateTime(r.createdAt)}
                    <span className="mt-1 block">
                      <Badge tone={TONE[r.status]}>{s.status[r.status]}</Badge>
                    </span>
                  </td>
                  <td className={tdClass}>
                    <p className="font-medium">{r.name}</p>
                    <a href={`tel:${r.phone}`} className="mt-0.5 inline-flex min-h-11 items-center text-[15px] tabular-nums underline underline-offset-4" aria-label={`${s.call} ${r.phone}`}>
                      {r.phone}
                    </a>
                  </td>
                  <td className={tdClass}>
                    <ul className="space-y-0.5 text-[13px]">
                      {r.items.map((i) => (
                        <li key={i.variantId}>
                          {i.productName} — {i.size} × {i.qty} <span className="text-ink-soft">({formatMNT(i.price * i.qty)})</span>
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className={`${tdClass} max-w-[260px] whitespace-pre-line break-words text-[13px]`}>{r.note ?? "—"}</td>
                  <td className={tdClass}>
                    <InquiryStatusSelect id={r.id} status={r.status} />
                    {r.handledBy && <p className="mt-1 text-[13px] text-ink-soft">{s.handledBy(r.handledBy.name)}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
