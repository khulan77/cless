import { Badge, EmptyState, PageHeader } from "@/components/admin/ui";
import { statusTone } from "@/components/admin/calendar/status";
import { t } from "@/i18n";
import { addDays, formatDateLabel, formatTime, ubDateKey } from "@/lib/time";
import { requirePagePermission } from "@/server/auth/session";
import { mySchedule } from "@/server/modules/appointments/queries";

export const metadata = { title: "Миний хуваарь" };
// Нэвтэрсэн хэрэглэгчийн динамик хуудас — request бүрт render (Cache Components validation-аас гаргана)
export const instant = false;

const m = t.admin.mySchedule;

/** Зөвхөн өөрийн цагууд (server-side шүүлт), үйлчлүүлэгчийн утас/имэйлгүй */
export default async function MySchedulePage() {
  const user = await requirePagePermission("schedule:own");
  const today = ubDateKey();
  const list = await mySchedule(user.id, today, 7);
  const byDay = new Map<string, typeof list>();
  for (const a of list) {
    const key = ubDateKey(a.startsAt);
    byDay.set(key, [...(byDay.get(key) ?? []), a]);
  }
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  return (
    <>
      <PageHeader title="Миний хуваарь" description={formatDateLabel(today)} />
      <div className="space-y-6">
        {days.map((d, i) => {
          const items = byDay.get(d) ?? [];
          if (i > 0 && items.length === 0) return null;
          return (
            <section key={d}>
              <h2 className="mb-2 text-[13px] font-medium uppercase tracking-[0.4px] text-navy/55">
                {i === 0 ? `${m.today} · ${formatDateLabel(d)}` : formatDateLabel(d)}
              </h2>
              {items.length === 0 ? (
                <EmptyState title={m.empty} />
              ) : (
                <ul className="space-y-2">
                  {items.map((a) => (
                    <li key={a.id} className="rounded-lg border border-line bg-white p-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[15px] font-medium tabular-nums">
                            {formatTime(a.startsAt)}–{formatTime(a.endsAt)}
                          </p>
                          <p className="truncate text-[14px]">{a.customer.name}</p>
                          <p className="text-[13px] text-navy/65">
                            {a.service.name}
                            {a.room ? ` · ${a.room.name}` : ""}
                          </p>
                        </div>
                        <Badge tone={statusTone(a.status)}>{t.admin.apptStatus[a.status]}</Badge>
                      </div>
                      {a.note && (
                        <p className="mt-2 whitespace-pre-line rounded bg-navy/[0.04] px-2.5 py-1.5 text-[13px]">
                          <span className="text-navy/55">{m.note}: </span>
                          {a.note}
                        </p>
                      )}
                      {a.lastVisit && (a.lastVisit.skinType || a.lastVisit.diagnosisNotes) && (
                        <p className="mt-2 text-[12.5px] text-navy/70">
                          <span className="text-navy/50">
                            {m.lastVisit} ({ubDateKey(a.lastVisit.createdAt)}):{" "}
                          </span>
                          {[a.lastVisit.skinType && t.admin.skinTypes[a.lastVisit.skinType], a.lastVisit.diagnosisNotes].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
