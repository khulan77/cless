import { RetryButton } from "@/components/admin/system/RetryButton";
import { Badge, Card, PageHeader, Table, tdClass, thClass } from "@/components/admin/ui";
import { t } from "@/i18n";
import { formatDateTime } from "@/lib/time";
import { requirePagePermission } from "@/server/auth/session";
import { workerStatus } from "@/server/modules/outbox/heartbeat";
import { problemJobs } from "@/server/modules/outbox/monitor";

export const metadata = { title: "Систем" };
export const instant = false;

type Job = Awaited<ReturnType<typeof problemJobs>>["failed"][number];

function JobTable({ jobs, empty }: { jobs: Job[]; empty: string }) {
  if (jobs.length === 0) return <p className="text-[14px] text-navy/55">{empty}</p>;
  return (
    <Table>
      <thead>
        <tr>
          <th className={thClass}>Төрөл</th>
          <th className={thClass}>Үүссэн</th>
          <th className={`${thClass} text-right`}>Оролдлого</th>
          <th className={thClass}>Сүүлийн алдаа</th>
          <th className={thClass} />
        </tr>
      </thead>
      <tbody>
        {jobs.map((j) => (
          <tr key={j.id}>
            <td className={tdClass}>
              {t.admin.system.jobType[j.type] ?? j.type}
              <span className="block text-[11px] text-navy/45">{j.status}</span>
            </td>
            <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{formatDateTime(j.createdAt)}</td>
            <td className={`${tdClass} text-right tabular-nums`}>{j.attempts}</td>
            <td className={`${tdClass} max-w-[420px] break-words text-[12.5px] text-red-700`}>{j.lastError ?? "—"}</td>
            <td className={`${tdClass} text-right`}>
              <RetryButton id={j.id} />
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export default async function SystemPage() {
  await requirePagePermission("settings:write");
  const [jobs, worker] = await Promise.all([problemJobs(), workerStatus()]);
  return (
    <>
      <PageHeader title="Систем" description="Background worker ба outbox (имэйл, QPay) ажлууд" />
      <div className="space-y-6">
        <Card title="Worker">
          <p className="flex items-center gap-2 text-[14px]">
            <Badge tone={worker.stale ? "red" : "green"}>{worker.stale ? "Зогссон" : "Ажиллаж байна"}</Badge>
            {worker.minutesAgo === null ? "Хэзээ ч ажиллаагүй" : `Сүүлд: ${worker.minutesAgo} минутын өмнө`}
          </p>
          <p className="mt-2 text-[13px] text-navy/55">
            Дараалалд: {jobs.counts.PENDING ?? 0} · Гүйцэтгэж буй: {jobs.counts.PROCESSING ?? 0} · Амжилттай: {jobs.counts.DONE ?? 0} · Амжилтгүй:{" "}
            {jobs.counts.FAILED ?? 0}
          </p>
        </Card>
        <Card title={`Амжилтгүй ажлууд (${jobs.failed.length})`} description="5 удаа оролдоод бүтээгүй. Шалтгааныг засаад дахин оролдоно.">
          <JobTable jobs={jobs.failed} empty="Амжилтгүй ажил алга." />
        </Card>
        <Card title={`Удаан хүлээгдэж буй (${jobs.slow.length})`} description="10 минутаас удаан дараалалд/гүйцэтгэлд байгаа — worker ажиллаж байгаа эсэхийг шалгана уу.">
          <JobTable jobs={jobs.slow} empty="Удаан хүлээгдэж буй ажил алга." />
        </Card>
      </div>
    </>
  );
}
