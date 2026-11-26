"use client";

import { MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/admin/ui";
import { checkInAction, checkOutAction } from "@/server/actions/attendance";

export type TodayState = { working: boolean; since: string | null; minutes: number; sessions: { in: string; out: string | null }[] };

const CONSENT_KEY = "cless:attendance-geo-ok";

const fmt = (min: number) => `${Math.floor(min / 60)}ц ${String(Math.floor(min % 60)).padStart(2, "0")}м`;

function position(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject({ code: 0 });
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 });
  });
}

/**
 * "Ирлээ / Явлаа" (PROMPT 19). Байршлыг ЗӨВХӨН товч дарах үед нэг удаа авна — арын горимд хянахгүй.
 * Анх удаа: тайлбар + зөвшөөрөл. Зөвшөөрөл өгөөгүй бол iPhone / Android-ийн заавар.
 */
export function CheckInCard({ initial }: { initial: TodayState }) {
  const router = useRouter();
  const [state, setStateRaw] = useState(initial);
  const [loadedAt, setLoadedAt] = useState(() => Date.now());
  const [now, setNow] = useState(loadedAt);
  const setState = (s: TodayState) => {
    const t = Date.now();
    setStateRaw(s);
    setLoadedAt(t);
    setNow(t);
  };
  const [consent, setConsent] = useState<boolean | null>(null);
  const [denied, setDenied] = useState(false);
  const [locating, setLocating] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    // localStorage — зөвхөн клиент талд; гидрацийн дараа уншина
    const t = setTimeout(() => setConsent(localStorage.getItem(CONSENT_KEY) === "1"), 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!state.working) return;
    const i = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(i);
  }, [state.working]);

  const elapsed = state.working ? state.minutes + (now - loadedAt) / 60_000 : state.minutes;

  const go = async () => {
    setDenied(false);
    setLocating(true);
    let pos: GeolocationPosition;
    try {
      pos = await position();
    } catch (e) {
      setLocating(false);
      const code = (e as { code?: number }).code;
      if (code === 1) setDenied(true);
      else toast.error(code === 3 ? "Байршил тогтоох хугацаа дууслаа. Цонхны ойролцоо очоод дахин оролдоно уу." : "Байршил тогтоож чадсангүй. Дахин оролдоно уу.");
      return;
    }
    setLocating(false);
    const input = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyM: pos.coords.accuracy };
    start(async () => {
      const res = await (state.working ? checkOutAction(input) : checkInAction(input));
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message ?? "Бүртгэгдлээ.");
      if (res.data.flagged) toast.warning("Байршлын нарийвчлал муу эсвэл салоны Wi-Fi биш — менежер шалгана.");
      setState(res.data.today);
      router.refresh();
    });
  };

  const busy = locating || pending;
  return (
    <section aria-label="Ирц" className="mb-6 rounded-2xl border border-hairline bg-white p-5">
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-ink-soft">Ирц</p>
          <p className="mt-1 text-[18px] font-medium tabular-nums">
            {state.working ? `${state.since}-аас ажиллаж байна · ${fmt(elapsed)}` : state.sessions.length ? `Өнөөдөр ${fmt(state.minutes)} ажилласан` : "Өнөөдөр ирээгүй"}
          </p>
          {state.sessions.length > 0 && (
            <p className="mt-1 text-[13px] text-ink-soft tabular-nums">{state.sessions.map((s) => `${s.in}–${s.out ?? "…"}`).join(" · ")}</p>
          )}
        </div>
        {consent && (
          <Button onClick={go} disabled={busy} className="h-14 min-w-40 text-[17px]" variant={state.working ? "secondary" : "primary"}>
            <MapPin className="size-5" aria-hidden />
            {locating ? "Байршил шалгаж байна…" : pending ? "Бүртгэж байна…" : state.working ? "Явлаа" : "Ирлээ"}
          </Button>
        )}
      </div>

      {consent === false && (
        <div className="mt-4 rounded-xl bg-canvas p-4 text-[14px]">
          <p>Ирц бүртгэхийн тулд <strong>зөвхөн товч дарах үед</strong> байршлыг нэг удаа шалгана. Арын горимд хянахгүй, байршлыг 90 хоногийн дараа устгана.</p>
          <Button
            className="mt-3"
            onClick={() => {
              localStorage.setItem(CONSENT_KEY, "1");
              setConsent(true);
            }}
          >
            Ойлголоо
          </Button>
        </div>
      )}

      {denied && (
        <div role="alert" className="mt-4 rounded-xl bg-warn-bg p-4 text-[14px] text-warn">
          <p className="font-medium">Байршлын зөвшөөрөл өгөөгүй байна.</p>
          <p className="mt-1">iPhone: Тохиргоо → Нууцлал → Байршлын үйлчилгээ → Safari → «Ашиглах үед».</p>
          <p>Android: Chrome → ⋮ → Тохиргоо → Сайтын тохиргоо → Байршил → энэ сайтыг «Зөвшөөрөх».</p>
        </div>
      )}
    </section>
  );
}
