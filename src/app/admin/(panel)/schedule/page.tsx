import { CalendarHeart } from "lucide-react";
import Link from "next/link";
import { MeTabs } from "@/components/admin/me/MeTabs";
import { Badge, EmptyState, PageHeader } from "@/components/admin/ui";
import { statusTone } from "@/components/admin/calendar/status";
import { t } from "@/i18n";
import { addDays, formatDateLabel, formatTime, ubDateKey } from "@/lib/time";
import { can } from "@/server/auth/permissions";
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
      {can(user.role, "me:read") && (
        <div className="mb-5">
          <MeTabs active="schedule" />
        </div>
      )}
      <PageHeader title="Миний хуваарь" description={m.subtitle(list.length)} />
      <div className="max-w-[720px] space-y-8">
        {days.map((d, i) => {
          const items = byDay.get(d) ?? [];
          if (i > 0 && items.length === 0) return null;
          return (
            <section key={d}>
              <h2 className={`mb-3 font-display font-semibold ${i === 0 ? "text-[26px]" : "text-[20px] text-ink-soft"}`}>
                {i === 0 ? `${m.today} · ${formatDateLabel(d)}` : formatDateLabel(d)}
              </h2>
              {items.length === 0 ? (
                <EmptyState icon={CalendarHeart} title={m.empty} />
              ) : (
                <ul className="space-y-3">
                  {items.map((a) => (
                    <li key={a.id} className={`rounded-2xl border bg-white p-4 ${i === 0 ? "border-champagne/40" : "border-hairline"}`}>
                      <div className="flex items-start gap-4">
                        <div className="w-[72px] shrink-0 border-r border-hairline pr-3">
                          <p className="font-display text-[24px] font-semibold leading-none tabular-nums">{formatTime(a.startsAt)}</p>
                          <p className="mt-1 text-[13px] text-ink-soft tabular-nums">–{formatTime(a.endsAt)}</p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[17px] font-semibold">
                            {can(user.role, "me:read") ? (
                              <Link href={`/admin/me/customers/${a.customerId}`} className="hover:underline">
                                {a.customer.name}
                              </Link>
                            ) : (
                              a.customer.name
                            )}
                          </p>
                          <p className="text-[15px] text-ink-soft">
                            {a.service.name}
                            {a.room ? ` · ${a.room.name}` : ""}
                          </p>
                          <p className="mt-2">
                            <Badge tone={statusTone(a.status)}>{t.admin.apptStatus[a.status]}</Badge>
                          </p>
                        </div>
                      </div>
                      {a.note && (
                        <p className="mt-3 whitespace-pre-line rounded-xl bg-canvas px-3.5 py-2.5 text-[14px]">
                          <span className="text-ink-soft">{m.note}: </span>
                          {a.note}
                        </p>
                      )}
                      {a.lastVisit && (a.lastVisit.skinType || a.lastVisit.diagnosisNotes) && (
                        <p className="mt-2 text-[14px] text-ink-soft">
                          <span className="font-medium text-ink">
                            {m.lastVisit} ({ubDateKey(a.lastVisit.createdAt)}):{" "}
                          </span>
                          {[a.lastVisit.skinType && t.admin.skinTypes[a.lastVisit.skinType], a.lastVisit.diagnosisNotes].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      {a.notes.length > 0 && (
                        <div className="mt-3 rounded-xl border border-champagne/30 bg-champagne/[0.06] px-3.5 py-2.5">
                          <p className="mb-1 text-[13px] font-medium text-champagne-ink">{t.admin.notes.recent}</p>
                          <ul className="space-y-1 text-[14px]">
                            {a.notes.map((n) => (
                              <li key={n.id}>
                                <span className="text-ink-soft">{formatDateLabel(n.createdAt)} · {n.author.name}: </span>
                                <span className="whitespace-pre-line">{n.body}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
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
