import { AlertTriangle } from "lucide-react";
import { Badge, Table, tdClass, thClass } from "@/components/admin/ui";
import { t } from "@/i18n";
import type { dayAttendance } from "@/server/modules/attendance/service";
import { NoteCell } from "./NoteCell";

type Rows = Awaited<ReturnType<typeof dayAttendance>>;
const fmt = (min: number) => (min > 0 ? `${Math.floor(min / 60)}ц ${String(min % 60).padStart(2, "0")}м` : "—");

/** Өдрийн ирц: ирсэн-явсан цаг, нийт, ⚠ сэжигтэй, "Явлаа дараагүй", менежерийн гар засвар */
export function DayAttendance({ rows, day, canNote }: { rows: Rows; day: string; canNote: boolean }) {
  if (rows.length === 0) return <p className="text-[15px] text-ink-soft">Ажилтан алга.</p>;
  return (
    <Table>
      <thead>
        <tr>
          <th className={thClass}>Ажилтан</th>
          <th className={thClass}>Хуваарь</th>
          <th className={thClass}>Ирсэн – явсан</th>
          <th className={`${thClass} text-right`}>Нийт</th>
          <th className={thClass}>Ирц (цалинд)</th>
          <th className={thClass}>Анхааруулга</th>
          <th className={thClass}>Тайлбар</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="hover:bg-canvas">
            <td className={tdClass}>
              <span className="font-medium">{r.name}</span>
              <span className="block text-[12px] text-ink-soft">{t.admin.nav.roles[r.role]}</span>
            </td>
            <td className={`${tdClass} tabular-nums text-ink-soft`}>{r.scheduled ?? "—"}</td>
            <td className={`${tdClass} tabular-nums`}>
              {r.sessions.length === 0 ? <span className="text-ink-soft">Ирээгүй</span> : r.sessions.map((s) => `${s.in}–${s.out ?? "…"}`).join(", ")}
              {r.working && <span className="ml-2"><Badge tone="green">Ажиллаж байна</Badge></span>}
            </td>
            <td className={`${tdClass} text-right tabular-nums`}>{fmt(r.minutes)}</td>
            <td className={`${tdClass} tabular-nums`}>
              {r.workDay ? (
                <>
                  {r.workDay.hours ?? "—"} ц{r.workDay.manual && <span className="ml-2"><Badge tone="red">Гараар засагдсан</Badge></span>}
                  {r.workDay.note && <span className="block text-[12px] text-ink-soft">{r.workDay.note}</span>}
                </>
              ) : (
                <span className="text-ink-soft">—</span>
              )}
            </td>
            <td className={tdClass}>
              {r.missingCheckout && (
                <span className="flex items-center gap-1 text-[13px] text-warn">
                  <AlertTriangle className="size-4" aria-hidden /> «Явлаа» дараагүй
                </span>
              )}
              {r.flagged.filter((f) => !f.autoClosed).map((f, i) => (
                <span key={i} className="block text-[13px] text-warn">⚠ {f.at} · {f.note ?? "Сэжигтэй"}</span>
              ))}
            </td>
            <td className={tdClass}>
              {canNote ? <NoteCell staffId={r.id} date={day} initial={r.comment} name={r.name} /> : <span className="text-[13px] text-ink-soft">{r.comment ?? "—"}</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
