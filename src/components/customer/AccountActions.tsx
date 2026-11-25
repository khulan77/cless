"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelMyAppointmentAction, confirmEmailAction, requestEmailCodeAction, setEmailConsentAction, signOutCustomerAction, updateMyNameAction } from "@/server/actions/customer";

const input = "h-11 w-full border border-line bg-white px-3 text-[15px] outline-none focus:border-navy";
const btn = "inline-flex h-11 items-center justify-center rounded-full border border-navy px-5 text-button text-navy transition-colors hover:bg-navy hover:text-white disabled:opacity-50";

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = <T,>(fn: () => Promise<{ ok: true; data: T; message?: string } | { ok: false; error: string }>, after?: (d: T) => void) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        setMsg(r.message ? { ok: true, text: r.message } : null);
        after?.(r.data);
        router.refresh();
      } else setMsg({ ok: false, text: r.error });
    });
  return { run, pending, msg };
}

const Msg = ({ m }: { m: { ok: boolean; text: string } | null }) =>
  m ? <p role={m.ok ? "status" : "alert"} className={`mt-2 text-[14px] ${m.ok ? "text-[#2f6b3a]" : "text-[#9b2c2c]"}`}>{m.text}</p> : null;

export function CancelAppointmentButton({ id }: { id: string }) {
  const { run, pending, msg } = useRun();
  const [ask, setAsk] = useState(false);
  return (
    <div>
      {ask ? (
        <span className="flex flex-wrap items-center gap-3 text-[14px]">
          Цаг цуцлах уу?
          <button type="button" className="link-underline text-[#9b2c2c]" disabled={pending} onClick={() => run(() => cancelMyAppointmentAction(id))}>Тийм, цуцлах</button>
          <button type="button" className="link-underline" onClick={() => setAsk(false)}>Үгүй</button>
        </span>
      ) : (
        <button type="button" className="link-underline text-[14px]" onClick={() => setAsk(true)}>Цуцлах</button>
      )}
      <Msg m={msg} />
    </div>
  );
}

export function NameForm({ initial }: { initial: string }) {
  const [name, setName] = useState(initial);
  const { run, pending, msg } = useRun();
  return (
    <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => (e.preventDefault(), run(() => updateMyNameAction(name)))}>
      <label className="min-w-56 flex-1">
        <span className="text-micro mb-2 block text-muted">Нэр</span>
        <input className={input} value={name} onChange={(e) => setName(e.target.value)} minLength={2} required />
      </label>
      <button type="submit" className={btn} disabled={pending}>Хадгалах</button>
      <div className="w-full"><Msg m={msg} /></div>
    </form>
  );
}

/** Имэйл нэмэх/солих — кодоор баталгаажуулна; тайлан хүлээн авах зөвшөөрөл */
export function EmailForm({ email, verified, consent }: { email: string | null; verified: boolean; consent: boolean }) {
  const [value, setValue] = useState(email ?? "");
  const [id, setId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [agree, setAgree] = useState(consent || !email);
  const { run, pending, msg } = useRun();
  return (
    <div className="space-y-3">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!id) run(() => requestEmailCodeAction(value), (d) => setId(d.id));
          else run(() => confirmEmailAction({ id, email: value, code, consent: agree }), () => (setId(null), setCode("")));
        }}
      >
        <label className="min-w-56 flex-1">
          <span className="text-micro mb-2 block text-muted">Имэйл {email && verified ? "· баталгаажсан" : ""}</span>
          <input className={input} type="email" value={value} disabled={Boolean(id)} onChange={(e) => setValue(e.target.value)} required />
        </label>
        {id && (
          <label className="w-36">
            <span className="text-micro mb-2 block text-muted">Код</span>
            <input className={input} inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} required />
          </label>
        )}
        <button type="submit" className={btn} disabled={pending || (!id && value === email && verified)}>{id ? "Баталгаажуулах" : email && verified ? "Солих" : "Код авах"}</button>
      </form>
      {id && (
        <label className="flex items-start gap-3 text-[14px]">
          <input type="checkbox" className="mt-1 size-[18px] accent-navy" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          Айлчлалын тайлан, арчилгааны зөвлөмжийг энэ имэйлээр хүлээн авна.
        </label>
      )}
      {!id && email && verified && (
        <label className="flex items-start gap-3 text-[14px]">
          <input type="checkbox" className="mt-1 size-[18px] accent-navy" checked={consent} disabled={pending} onChange={(e) => run(() => setEmailConsentAction(e.target.checked))} />
          Айлчлалын тайлан, арчилгааны зөвлөмжийг имэйлээр хүлээн авах
        </label>
      )}
      <Msg m={msg} />
    </div>
  );
}

export function SignOutButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button type="button" className="link-underline text-[14px] text-muted" disabled={pending} onClick={() => start(async () => { await signOutCustomerAction(); router.replace("/"); router.refresh(); })}>
      Гарах
    </button>
  );
}
