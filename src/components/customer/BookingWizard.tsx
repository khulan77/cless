"use client";

import { Check, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { formatMNT } from "@/lib/money";
import { bookOnlineAction, onlineSlotsAction, onlineStaffAction } from "@/server/actions/customer";
import { CustomerLogin } from "./CustomerLogin";

export type WizardService = { id: string; slug: string; name: string; category: string | null; price: number; priceFrom: boolean; durationMin: number; shortDescription: string | null };

const WD = ["Ня", "Да", "Мя", "Лх", "Пү", "Ба", "Бя"];
const STEPS = ["Үйлчилгээ", "Гоо сайханч", "Огноо, цаг", "Баталгаажуулах"] as const;
const primary = "inline-flex h-12 items-center justify-center rounded-full bg-navy px-8 text-button tracking-[0.4px] text-white transition-colors hover:bg-navy/90 disabled:opacity-50";
const card = (on: boolean) => `w-full border p-4 text-left transition-colors ${on ? "border-navy bg-navy/[0.03]" : "border-line bg-white hover:border-navy/50"}`;

const tz = "Asia/Ulaanbaatar";
const hm = (iso: string) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz }).format(new Date(iso));
const dayParts = (d: string) => {
  const dt = new Date(`${d}T00:00:00Z`);
  return { wd: WD[dt.getUTCDay()]!, day: dt.getUTCDate(), month: dt.getUTCMonth() + 1 };
};

export function BookingWizard({
  services,
  dates,
  loggedIn: initialLoggedIn,
  initialServiceId,
  approval,
  customerName,
}: {
  services: WizardService[];
  dates: string[];
  loggedIn: boolean;
  initialServiceId: string | null;
  approval: boolean;
  customerName: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState(initialServiceId ? 1 : 0);
  const [serviceId, setServiceId] = useState<string | null>(initialServiceId);
  const [staff, setStaff] = useState<{ id: string; name: string }[] | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [date, setDate] = useState(dates[0] ?? "");
  const [slots, setSlots] = useState<{ startsAt: string; staffIds: string[] }[] | null>(null);
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [loggedIn, setLoggedIn] = useState(initialLoggedIn);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | "PENDING" | "CONFIRMED">(null);
  const [pending, start] = useTransition();
  const service = services.find((s) => s.id === serviceId) ?? null;
  const staffName = staffId ? staff?.find((s) => s.id === staffId)?.name : "Хэн ч болно";

  const groups = useMemo(() => {
    const m = new Map<string, WizardService[]>();
    for (const s of services) m.set(s.category ?? "Бусад", [...(m.get(s.category ?? "Бусад") ?? []), s]);
    return [...m.entries()];
  }, [services]);

  useEffect(() => {
    if (!serviceId) return;
    let stale = false;
    onlineStaffAction(serviceId).then((r) => !stale && setStaff(r.ok ? r.data : []));
    return () => void (stale = true);
  }, [serviceId]);

  useEffect(() => {
    if (!serviceId || step !== 2 || !date) return;
    let stale = false;
    setSlots(null);
    onlineSlotsAction({ serviceId, staffId, date }).then((r) => {
      if (stale) return;
      if (r.ok) setSlots(r.data);
      else (setSlots([]), setError(r.error));
    });
    return () => void (stale = true);
  }, [serviceId, staffId, date, step]);

  if (done) {
    return (
      <div className="mx-auto max-w-[560px] text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-navy text-white"><Check className="size-7" aria-hidden /></span>
        <h2 className="text-h2 mt-6">{done === "PENDING" ? "Захиалгын хүсэлт хүлээн авлаа" : "Цаг баталгаажлаа"}</h2>
        <p className="mt-4 text-muted">
          {service?.name} · {startsAt && `${date} ${hm(startsAt)}`}
          <br />
          {done === "PENDING" ? "Ресепшн баталгаажуулмагц танд SMS ирнэ." : "Цагийн өмнөх өдөр SMS сануулга ирнэ."}
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/account" className={primary}>Миний цагууд</Link>
        </div>
      </div>
    );
  }

  const confirm = () =>
    start(async () => {
      setError(null);
      const r = await bookOnlineAction({ serviceId: serviceId!, staffId, startsAt: startsAt!, note });
      if (r.ok) setDone(r.data.status === "PENDING" ? "PENDING" : "CONFIRMED");
      else {
        setError(r.error);
        if (r.code === "APPT_OVERLAP") (setStartsAt(null), setStep(2));
      }
    });

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div>
        <ol className="mb-8 flex flex-wrap gap-x-6 gap-y-2 text-[13px] uppercase tracking-[0.12em]" aria-label="Алхам">
          {STEPS.map((s, i) => (
            <li key={s} aria-current={i === step ? "step" : undefined} className={i === step ? "text-navy" : i < step ? "text-navy/60" : "text-muted"}>
              {i + 1}. {s}
            </li>
          ))}
        </ol>
        {step > 0 && (
          <button type="button" className="mb-6 inline-flex items-center gap-1 text-[14px] text-muted hover:text-navy" onClick={() => (setError(null), setStep(step - 1))}>
            <ChevronLeft className="size-4" aria-hidden /> Буцах
          </button>
        )}

        {step === 0 && (
          <div className="space-y-8">
            {groups.map(([cat, list]) => (
              <section key={cat}>
                <h2 className="text-micro mb-3 text-muted">{cat}</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {list.map((s) => (
                    <button key={s.id} type="button" className={card(s.id === serviceId)} onClick={() => (setServiceId(s.id), setStaffId(null), setStartsAt(null), setStep(1))}>
                      <span className="block font-medium">{s.name}</span>
                      <span className="mt-1 block text-[14px] text-muted">{s.durationMin} мин · {formatMNT(s.price)}{s.priceFrom ? "-с" : ""}</span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" className={card(staffId === null)} onClick={() => (setStaffId(null), setStartsAt(null), setStep(2))}>
              <span className="block font-medium">Хэн ч болно</span>
              <span className="mt-1 block text-[14px] text-muted">Хамгийн олон сул цаг</span>
            </button>
            {(staff ?? []).map((s) => (
              <button key={s.id} type="button" className={card(staffId === s.id)} onClick={() => (setStaffId(s.id), setStartsAt(null), setStep(2))}>
                <span className="block font-medium">{s.name}</span>
                <span className="mt-1 block text-[14px] text-muted">Гоо сайханч</span>
              </button>
            ))}
            {staff === null && <p className="text-muted">Ачаалж байна…</p>}
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-3" role="listbox" aria-label="Огноо">
              {dates.map((d) => {
                const p = dayParts(d);
                return (
                  <button
                    key={d}
                    type="button"
                    role="option"
                    aria-selected={d === date}
                    onClick={() => (setDate(d), setStartsAt(null), setError(null))}
                    className={`flex w-16 shrink-0 snap-start flex-col items-center border py-3 ${d === date ? "border-navy bg-navy text-white" : "border-line bg-white"}`}
                  >
                    <span className="text-[12px] uppercase">{p.wd}</span>
                    <span className="text-[20px] font-medium tabular-nums">{p.day}</span>
                    <span className="text-[11px] opacity-70">{p.month}-р сар</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-6">
              {slots === null ? (
                <p className="text-muted">Сул цаг хайж байна…</p>
              ) : slots.length === 0 ? (
                <p className="text-muted">Энэ өдөр сул цаг алга. Өөр өдөр сонгоно уу.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {slots.map((s) => (
                    <button key={s.startsAt} type="button" className={`h-12 border text-[15px] tabular-nums ${s.startsAt === startsAt ? "border-navy bg-navy text-white" : "border-line bg-white hover:border-navy"}`} onClick={() => (setStartsAt(s.startsAt), setStep(3))}>
                      {hm(s.startsAt)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            {!loggedIn ? (
              <div className="max-w-[420px]">
                <h2 className="text-h3 mb-2">Нэвтрэх</h2>
                <p className="mb-5 text-[14px] text-muted">Захиалгыг баталгаажуулахын тулд утсандаа ирсэн кодоор нэвтэрнэ үү.</p>
                <CustomerLogin compact onDone={() => (setLoggedIn(true), router.refresh())} />
              </div>
            ) : (
              <>
                {customerName && <p className="text-muted">Захиалагч: {customerName}</p>}
                <label className="block max-w-[560px]">
                  <span className="text-micro mb-2 block text-muted">Тэмдэглэл (заавал биш)</span>
                  <textarea className="min-h-24 w-full border border-line bg-white p-3 text-[15px] outline-none focus:border-navy" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Жишээ нь: анх удаа ирж байна, арьс мэдрэг" />
                </label>
                <button type="button" className={primary} disabled={pending} onClick={confirm}>
                  {pending ? "Илгээж байна…" : approval ? "Захиалгын хүсэлт илгээх" : "Цаг баталгаажуулах"}
                </button>
                {approval && <p className="text-[13px] text-muted">Ресепшн баталгаажуулсны дараа цаг таных болно. Хүлээх хугацаанд цаг тань түр баригдана.</p>}
              </>
            )}
          </div>
        )}

        {error && <p role="alert" className="mt-6 text-[14px] text-[#9b2c2c]">{error}</p>}
      </div>

      <aside className="h-fit border border-line bg-white p-6 lg:sticky lg:top-24" aria-label="Таны сонголт">
        <h2 className="text-micro mb-4 text-muted">Таны сонголт</h2>
        <dl className="space-y-3 text-[15px]">
          <div><dt className="text-[13px] text-muted">Үйлчилгээ</dt><dd>{service ? `${service.name} · ${service.durationMin} мин` : "—"}</dd></div>
          <div><dt className="text-[13px] text-muted">Гоо сайханч</dt><dd>{step >= 2 ? staffName : "—"}</dd></div>
          <div><dt className="text-[13px] text-muted">Огноо, цаг</dt><dd className="tabular-nums">{startsAt ? `${date} · ${hm(startsAt)}` : "—"}</dd></div>
          {service && <div><dt className="text-[13px] text-muted">Үнэ</dt><dd className="tabular-nums">{formatMNT(service.price)}{service.priceFrom ? "-с" : ""}</dd></div>}
        </dl>
      </aside>
    </div>
  );
}
