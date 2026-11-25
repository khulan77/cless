"use client";

import { useState, useTransition } from "react";
import { completeCustomerProfileAction, requestCustomerCodeAction, verifyCustomerCodeAction } from "@/server/actions/customer";

const input =
  "h-12 w-full border border-line bg-white px-4 text-[16px] outline-none transition-colors focus:border-navy aria-[invalid=true]:border-[#9b2c2c]";
const primary = "inline-flex h-12 w-full items-center justify-center rounded-full bg-navy px-6 text-button tracking-[0.4px] text-white transition-colors hover:bg-navy/90 disabled:opacity-60";

/**
 * Нууц үггүй нэвтрэлт: утас (эсвэл имэйл) → 6 оронтой код → (шинэ бол нэр + зөвшөөрөл) → onDone.
 * Ажилтны нэвтрэлтээс тусдаа (өөр cookie).
 */
export function CustomerLogin({ onDone, compact = false }: { onDone: () => void; compact?: boolean }) {
  const [step, setStep] = useState<"to" | "code" | "profile">("to");
  const [byEmail, setByEmail] = useState(false);
  const [to, setTo] = useState("");
  const [id, setId] = useState("");
  const [code, setCode] = useState("");
  const [verificationId, setVerificationId] = useState("");
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [emailConsent, setEmailConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const go = (fn: () => Promise<void>) =>
    start(async () => {
      setError(null);
      try {
        await fn();
      } catch {
        setError("Сервертэй холбогдож чадсангүй. Дахин оролдоно уу.");
      }
    });

  const send = () =>
    go(async () => {
      const r = await requestCustomerCodeAction(to);
      if (!r.ok) return setError(r.error);
      setId(r.data.id);
      setInfo(r.data.message);
      setStep("code");
    });

  return (
    <div className={compact ? "space-y-4" : "space-y-5"}>
      {step === "to" && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <label className="block">
            <span className="text-micro mb-2 block text-muted">{byEmail ? "Имэйл" : "Утасны дугаар"}</span>
            <input
              className={input}
              type={byEmail ? "email" : "tel"}
              inputMode={byEmail ? "email" : "tel"}
              autoComplete={byEmail ? "email" : "tel"}
              placeholder={byEmail ? "name@example.mn" : "9911 2233"}
              required
              value={to}
              onChange={(e) => setTo(e.target.value)}
              aria-invalid={Boolean(error)}
            />
          </label>
          <button type="submit" className={primary} disabled={pending}>{pending ? "Илгээж байна…" : "Код авах"}</button>
          <button type="button" className="link-underline text-[14px] text-muted" onClick={() => { setByEmail(!byEmail); setTo(""); setError(null); }}>
            {byEmail ? "Утсаар код авах" : "Имэйлээр код авах"}
          </button>
        </form>
      )}

      {step === "code" && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            go(async () => {
              const r = await verifyCustomerCodeAction({ id, to, code });
              if (!r.ok) return setError(r.error);
              if (r.data.status === "signed-in") onDone();
              else {
                setVerificationId(r.data.verificationId);
                setStep("profile");
              }
            });
          }}
        >
          {info && <p className="text-[14px] text-muted">{info} ({to})</p>}
          <label className="block">
            <span className="text-micro mb-2 block text-muted">6 оронтой код</span>
            <input className={`${input} text-[22px] tracking-[0.4em]`} inputMode="numeric" autoComplete="one-time-code" maxLength={8} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} aria-invalid={Boolean(error)} />
          </label>
          <button type="submit" className={primary} disabled={pending || code.length < 4}>{pending ? "Шалгаж байна…" : "Нэвтрэх"}</button>
          <div className="flex justify-between text-[14px] text-muted">
            <button type="button" className="link-underline" onClick={() => { setStep("to"); setCode(""); }}>Дугаар солих</button>
            <button type="button" className="link-underline" disabled={pending} onClick={send}>Код дахин авах</button>
          </div>
        </form>
      )}

      {step === "profile" && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            go(async () => {
              const r = await completeCustomerProfileAction({ verificationId, to, name, consent: consent as true, emailConsent });
              if (!r.ok) return setError(r.fieldErrors?.consent?.[0] ?? r.error);
              onDone();
            });
          }}
        >
          <p className="text-[14px] text-muted">Анх удаа нэвтэрч байна. Нэрээ оруулна уу.</p>
          <label className="block">
            <span className="text-micro mb-2 block text-muted">Нэр</span>
            <input className={input} autoComplete="name" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="flex items-start gap-3 text-[14px]">
            <input type="checkbox" className="mt-1 size-[18px] accent-navy" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />
            <span>Цаг захиалах, үйлчилгээ үзүүлэхэд миний нэр, утас, арьсны мэдээллийг ашиглахыг зөвшөөрч байна. <a href="/privacy" className="link-underline" target="_blank">Нууцлалын бодлого</a></span>
          </label>
          <label className="flex items-start gap-3 text-[14px]">
            <input type="checkbox" className="mt-1 size-[18px] accent-navy" checked={emailConsent} onChange={(e) => setEmailConsent(e.target.checked)} />
            <span>Айлчлалын тайлан, арчилгааны зөвлөмжийг имэйлээр хүлээн авна (заавал биш).</span>
          </label>
          <button type="submit" className={primary} disabled={pending || !consent}>{pending ? "Хадгалж байна…" : "Үргэлжлүүлэх"}</button>
        </form>
      )}

      {error && <p role="alert" className="text-[14px] text-[#9b2c2c]">{error}</p>}
    </div>
  );
}
