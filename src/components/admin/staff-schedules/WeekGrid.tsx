import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { btnClass } from "@/components/admin/ui";
import { t } from "@/i18n";

export type WeekGridRow = {
  id: string;
  name: string;
  roleLabel: string;
  /** долоо хоногийн өдөр бүр (Да–Ня): хуваарь эсвэл чөлөө */
  cells: { day: string; intervals: string[]; leave: string | null }[];
};

/** Бүх ажилтны 7 хоногийн хүснэгт (PROMPT 27 §5): Да–Ня, эхлэх–дуусах + чөлөө/амралтын өдөр. Засвар — доорх карт. */
export function WeekGrid({ rows, days, prevHref, nextHref, todayKey }: { rows: WeekGridRow[]; days: string[]; prevHref: string; nextHref: string; todayKey: string }) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="font-display text-[22px] font-semibold">7 хоногийн хуваарь</h2>
        <Link href={prevHref} className={btnClass("secondary", "sm")} aria-label="Өмнөх 7 хоног">
          <ChevronLeft className="size-4" />
        </Link>
        <span className="tabular-nums text-[15px]">
          {days[0]} — {days[6]}
        </span>
        <Link href={nextHref} className={btnClass("secondary", "sm")} aria-label="Дараагийн 7 хоног">
          <ChevronRight className="size-4" />
        </Link>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-hairline bg-white">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-hairline">
              <th className="sticky left-0 bg-white px-3 py-2.5 text-left font-medium">Ажилтан</th>
              {days.map((d) => (
                <th key={d} className={`px-2 py-2.5 text-center font-medium ${d === todayKey ? "bg-champagne/15" : ""}`}>
                  {t.time.weekdaysShort[new Date(`${d}T12:00:00Z`).getUTCDay()]}
                  <span className="block font-normal tabular-nums text-ink-soft">{d.slice(5)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-hairline last:border-0">
                <td className="sticky left-0 bg-white px-3 py-2 whitespace-nowrap">
                  <a href={`#staff-${r.id}`} className="font-medium hover:underline">
                    {r.name}
                  </a>
                  <span className="block text-[12px] text-ink-soft">{r.roleLabel}</span>
                </td>
                {r.cells.map((c) => (
                  <td key={c.day} className={`px-2 py-2 text-center tabular-nums ${c.day === todayKey ? "bg-champagne/10" : ""}`}>
                    {c.leave ? (
                      <span className="inline-block rounded bg-info-bg px-1.5 py-0.5 text-info">{c.leave}</span>
                    ) : c.intervals.length ? (
                      c.intervals.map((iv) => (
                        <span key={iv} className="block">
                          {iv}
                        </span>
                      ))
                    ) : (
                      <span className="text-ink-faint">Амралт</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[13px] text-ink-soft">Хуваарь, чөлөөг доорх ажилтны картаас засна (нэрэн дээр дарвал очно). Хуваарьтай өдөр «Ирлээ» дараагүй бол ирцэд «Тасалсан» гэж тооцогдоно.</p>
    </section>
  );
}
