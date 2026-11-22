import Link from "next/link";
import { OpenShiftForm, ShiftOpenControls } from "@/components/admin/shifts/ShiftControls";
import { Badge, Card, PageHeader, Table, tdClass, thClass } from "@/components/admin/ui";
import { t } from "@/i18n";
import { formatMNT } from "@/lib/money";
import { can } from "@/server/auth/permissions";
import { requirePagePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { getCurrentBranch } from "@/server/modules/branches/service";
import { getOpenShift, shiftReport } from "@/server/modules/cash-shifts/service";

export const metadata = { title: "Кассын ээлж" };
export const instant = false;

const dt = (d: Date) => d.toLocaleString("en-GB", { timeZone: "Asia/Ulaanbaatar", dateStyle: "short", timeStyle: "short" });

export default async function ShiftsPage() {
  const user = await requirePagePermission("shift:own");
  const branch = await getCurrentBranch();
  const open = await getOpenShift(db, branch.id);
  const report = open ? await shiftReport(open.id) : null;
  const mine = open && (open.openedById === user.id || can(user.role, "shift:all"));
  const history = await db.cashShift.findMany({
    where: { branchId: branch.id, status: "CLOSED" },
    orderBy: { openedAt: "desc" },
    take: 30,
    include: { openedBy: { select: { name: true } }, closedBy: { select: { name: true } } },
  });

  return (
    <>
      <PageHeader title="Кассын ээлж" description={branch.name} />
      {!open || !report ? (
        <Card title="Касс хаалттай" description="Ээлж нээж бэлэн төлбөр хүлээн авна." className="mb-6">
          <OpenShiftForm />
        </Card>
      ) : (
        <div className="mb-6 space-y-5">
          <Card
            title="Нээлттэй ээлж"
            description={`${report.shift.openedBy.name} · ${dt(report.shift.openedAt)}`}
            actions={<Link href={`/admin/shifts/${open.id}`} className="text-[13px] underline underline-offset-4">Тайлан</Link>}
          >
            <dl className="grid gap-3 sm:grid-cols-4">
              {[
                ["Эхний бэлэн", formatMNT(open.openingCash)],
                ["Кассанд байх ёстой", formatMNT(report.expectedCash)],
                ["Борлуулалт", `${report.salesCount} · ${formatMNT(report.salesTotal)}`],
                ["Буцаалт", `${report.refundsCount} · ${formatMNT(report.refundsTotal)}`],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[12px] text-navy/55">{k}</dt>
                  <dd className="mt-1 text-[18px] font-light tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
            {report.byMethod.length > 0 && (
              <p className="mt-3 text-[13px] text-navy/65">
                {report.byMethod.map((m) => `${t.admin.payMethod[m.method]}: ${formatMNT(m.amount)}`).join(" · ")}
              </p>
            )}
          </Card>
          {mine ? <ShiftOpenControls shiftId={open.id} expected={report.expectedCash} /> : <p className="text-[14px] text-navy/60">Энэ ээлжийг өөр ажилтан нээсэн.</p>}
        </div>
      )}

      <h2 className="mb-3 text-[15px] font-medium">Түүх</h2>
      {history.length === 0 ? (
        <p className="text-[14px] text-navy/55">Хаагдсан ээлж алга.</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <th className={thClass}>Нээсэн</th>
              <th className={thClass}>Хаасан</th>
              <th className={`${thClass} text-right`}>Байх ёстой</th>
              <th className={`${thClass} text-right`}>Тоолсон</th>
              <th className={`${thClass} text-right`}>Зөрүү</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.id} className="hover:bg-navy/[0.02]">
                <td className={tdClass}>
                  <Link href={`/admin/shifts/${h.id}`} className="hover:underline">
                    {dt(h.openedAt)} · {h.openedBy.name}
                  </Link>
                </td>
                <td className={tdClass}>{h.closedAt ? `${dt(h.closedAt)} · ${h.closedBy?.name ?? ""}` : "—"}</td>
                <td className={`${tdClass} text-right tabular-nums`}>{formatMNT(h.expectedCash ?? 0)}</td>
                <td className={`${tdClass} text-right tabular-nums`}>{formatMNT(h.countedCash ?? 0)}</td>
                <td className={`${tdClass} text-right`}>
                  <Badge tone={(h.difference ?? 0) === 0 ? "green" : "red"}>{formatMNT(h.difference ?? 0)}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
