import { RetryButton } from "@/components/admin/system/RetryButton";
import { Badge, Card, PageHeader, Table, tdClass, thClass } from "@/components/admin/ui";
import { t } from "@/i18n";
import { formatDateTime } from "@/lib/time";
import { requirePagePermission } from "@/server/auth/session";
import { workerStatus } from "@/server/modules/outbox/heartbeat";
import { problemJobs } from "@/server/modules/outbox/monitor";

export const metadata = { title: "Систем" };
export const instant = false;

const JOB_STATUS: Record<string, string> = { PENDING: "Дараалалд", PROCESSING: "Илгээж буй", FAILED: "Илгээгдээгүй", DONE: "Илгээгдсэн" };

type Job = Awaited<ReturnType<typeof problemJobs>>["failed"][number];

function JobTable({ jobs, empty }: { jobs: Job[]; empty: string }) {
  if (jobs.length === 0) return <p className="text-[14px] text-ink-soft">{empty}</p>;
  return (
    <Table>
      <thead>
        <tr>
          <th className={thClass}>Юу</th>
          <th className={thClass}>Үүссэн</th>
          <th className={`${thClass} text-right`}>Оролдсон</th>
          <th className={thClass}>Шалтгаан</th>
          <th className={thClass} />
        </tr>
      </thead>
      <tbody>
        {jobs.map((j) => (
          <tr key={j.id}>
            <td className={tdClass}>
              {t.admin.system.jobType[j.type] ?? j.type}
              <span className="block text-[13px] text-ink-faint">{JOB_STATUS[j.status] ?? j.status}</span>
            </td>
            <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{formatDateTime(j.createdAt)}</td>
            <td className={`${tdClass} text-right tabular-nums`}>{j.attempts}</td>
            <td className={`${tdClass} max-w-[420px] break-words text-[13px] text-danger`}>{j.lastError ?? "—"}</td>
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
      <PageHeader eyebrow="Тохиргоо" title="Систем" description="Имэйл илгээлт ба QPay шалгалтын дотоод үйлчилгээ — алдаа гарвал энд харагдана" />
      <div className="space-y-6">
        <Card title="Дотоод үйлчилгээ">
          <p className="flex items-center gap-2 text-[14px]">
            <Badge tone={worker.stale ? "red" : "green"}>{worker.stale ? "Зогссон" : "Ажиллаж байна"}</Badge>
            {worker.minutesAgo === null ? "Хэзээ ч ажиллаагүй" : `Сүүлд: ${worker.minutesAgo} минутын өмнө`}
          </p>
          <p className="mt-2 text-[13px] text-ink-soft">
            Илгээх дараалалд: {jobs.counts.PENDING ?? 0} · Илгээж буй: {jobs.counts.PROCESSING ?? 0} · Илгээгдсэн: {jobs.counts.DONE ?? 0} · Илгээгдээгүй:{" "}
            {jobs.counts.FAILED ?? 0}
          </p>
        </Card>
        <Card title={`Илгээгдээгүй (${jobs.failed.length})`} description="5 удаа оролдоод бүтээгүй. Шалтгааныг засаад «Дахин оролдох» дарна.">
          <JobTable jobs={jobs.failed} empty="Бүх имэйл, мэдэгдэл илгээгдсэн." />
        </Card>
        <Card title={`Удаан хүлээгдэж буй (${jobs.slow.length})`} description="10 минутаас удаан илгээгдэхгүй байгаа — дотоод үйлчилгээ ажиллаж байгаа эсэхийг техникийн ажилтнаар шалгуулна уу.">
          <JobTable jobs={jobs.slow} empty="Удаан хүлээгдэж буй зүйл алга." />
        </Card>
      </div>
    </>
  );
}
