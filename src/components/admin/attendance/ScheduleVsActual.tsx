import { Table, tdClass, thClass } from "@/components/admin/ui";
import { t } from "@/i18n";
import type { scheduleVsActual } from "@/server/modules/attendance/service";
import { DAY_STATE_LABEL } from "@/server/modules/attendance/punctuality";

type Rows = Awaited<ReturnType<typeof scheduleVsActual>>;

const CELL: Record<string, string> = {
  ON_TIME: "bg-ok-bg text-ok",
  LATE: "bg-warn-bg text-warn",
  ABSENT: "bg-err-bg text-err",
  LEAVE: "bg-info-bg text-info",
  EXTRA: "bg-info-bg text-info",
  NOT_YET: "text-ink-soft",
  OFF: "text-ink-faint",
};

/** Хуваарь vs бодит (PROMPT 27 §5): нийлбэр + өдөр бүрийн нүд (ирсэн цаг / хоцролт / тасалсан) */
export function ScheduleVsActual({ rows }: { rows: Rows }) {
  if (rows.length === 0) return <p className="text-[15px] text-ink-soft">Ажилтан алга.</p>;
  const days = rows[0]!.days.map((d) => d.day);
  return (
    <div className="space-y-6">
      <Table>
        <thead>
          <tr>
            <th className={thClass}>Ажилтан</th>
            <th className={`${thClass} text-right`}>Хуваарьтай өдөр</th>
            <th className={`${thClass} text-right`}>Ирсэн</th>
            <th className={`${thClass} text-right`}>Хоцорсон</th>
            <th className={`${thClass} text-right`}>Хоцролт (мин)</th>
            <th className={`${thClass} text-right`}>Тасалсан</th>
            <th className={`${thClass} text-right`}>Чөлөөтэй</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-canvas">
              <td className={tdClass}>
                <span className="font-medium">{r.name}</span>
                <span className="block text-[12px] text-ink-soft">{t.admin.nav.roles[r.role]}</span>
              </td>
              <td className={`${tdClass} text-right tabular-nums`}>{r.scheduled}</td>
              <td className={`${tdClass} text-right tabular-nums`}>{r.came}</td>
              <td className={`${tdClass} text-right tabular-nums ${r.late ? "text-warn" : ""}`}>{r.late}</td>
              <td className={`${tdClass} text-right tabular-nums ${r.lateMin ? "text-warn" : ""}`}>{r.lateMin}</td>
              <td className={`${tdClass} text-right tabular-nums ${r.absent ? "font-semibold text-err" : ""}`}>{r.absent}</td>
              <td className={`${tdClass} text-right tabular-nums`}>{r.leave}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <div className="overflow-x-auto rounded-2xl border border-hairline bg-white">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr>
              <th className="sticky left-0 bg-white px-3 py-2 text-left font-medium">Ажилтан</th>
              {days.map((d) => (
                <th key={d} className="px-1.5 py-2 text-center font-medium tabular-nums">
                  {d.slice(8)}
                  <span className="block font-normal text-ink-soft">{t.time.weekdaysShort[new Date(`${d}T12:00:00Z`).getUTCDay()]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-hairline">
                <td className="sticky left-0 bg-white px-3 py-2 font-medium whitespace-nowrap">{r.name}</td>
                {r.days.map((d) => (
                  <td
                    key={d.day}
                    className={`px-1 py-1.5 text-center tabular-nums ${CELL[d.state]}`}
                    title={`${d.day} · Хуваарь ${d.scheduled ?? "—"} · Ирсэн ${d.firstIn ?? "—"} · ${DAY_STATE_LABEL[d.state]}${d.lateMin ? ` ${d.lateMin} мин` : ""}`}
                  >
                    {d.state === "ABSENT" ? "Тас" : d.state === "LEAVE" ? "Чөл" : d.state === "OFF" ? "·" : d.state === "NOT_YET" ? "…" : d.lateMin ? `+${d.lateMin}` : (d.firstIn ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[13px] text-ink-soft">
        Ногоон — цагтаа (ирсэн цаг), шар «+N» — хоцорсон минут, улаан «Тас» — хуваарьтай өдөр «Ирлээ» дараагүй, цэнхэр «Чөл» — чөлөө/амралт. Хоцролтыг хуваарийн эхлэх цагаас тооцно.
      </p>
    </div>
  );
}
