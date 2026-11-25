"use client";

import { useState } from "react";
import { Dialog } from "@/components/admin/Dialog";
import { useServerAction } from "@/components/admin/use-action";
import { Badge, Button, Checkbox, Field, Select, Textarea } from "@/components/admin/ui";
import { t } from "@/i18n";
import { sendVisitReportAction, setCustomerEmailConsentAction, unblockOnlineBookingAction } from "@/server/actions/notify";

type Skin = "DRY" | "OILY" | "COMBINATION" | "NORMAL" | "SENSITIVE";

/** Айлчлалын тайланг имэйлээр — илгээхээс өмнө арьсны төрөл, дүгнэлтийг засна (зураг хавсаргахгүй) */
export function SendVisitReportButton({ visitId, customerId, skinType, summary, disabledReason }: { visitId: string; customerId: string; skinType: Skin | null; summary: string | null; disabledReason: string | null }) {
  const [open, setOpen] = useState(false);
  const [skin, setSkin] = useState<Skin | "">(skinType ?? "");
  const [text, setText] = useState(summary ?? "");
  const { run, pending } = useServerAction(sendVisitReportAction);
  return (
    <>
      <Button size="sm" variant="secondary" disabled={Boolean(disabledReason)} title={disabledReason ?? undefined} onClick={() => setOpen(true)}>
        Имэйлээр илгээх
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Айлчлалын тайлан илгээх"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>{t.admin.cancel}</Button>
            <Button disabled={pending} onClick={() => run({ visitId, customerId, skinType: skin || null, summary: text || null }, { onSuccess: () => setOpen(false) })}>Илгээх</Button>
          </div>
        }
      >
        <p className="mb-4 text-[14px] text-ink-soft">Огноо, гоо сайханч, хийсэн үйлчилгээ, авсан бүтээгдэхүүн, санал болгосон бүтээгдэхүүн ба заавар, дараагийн цаг автоматаар орно. Зураг хавсаргахгүй.</p>
        <div className="space-y-4">
          <Field label="Арьсны төрөл" htmlFor="vr-skin">
            <Select id="vr-skin" value={skin} onChange={(e) => setSkin(e.target.value as Skin | "")}>
              <option value="">—</option>
              {(["DRY", "OILY", "COMBINATION", "NORMAL", "SENSITIVE"] as const).map((s) => <option key={s} value={s}>{t.admin.skinTypes[s]}</option>)}
            </Select>
          </Field>
          <Field label="Гол дүгнэлт (үйлчлүүлэгчид харагдана)" htmlFor="vr-sum">
            <Textarea id="vr-sum" className="min-h-28" maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
        </div>
      </Dialog>
    </>
  );
}

export function CustomerOnlinePanel({
  customerId,
  registeredVia,
  onlineRegisteredAt,
  lastLoginAt,
  emailConsentAt,
  blocked,
  canWrite,
  history,
}: {
  customerId: string;
  registeredVia: "ADMIN" | "ONLINE";
  onlineRegisteredAt: string | null;
  lastLoginAt: string | null;
  emailConsentAt: string | null;
  blocked: boolean;
  canWrite: boolean;
  history: { id: string; at: string; by: string | null; status: "QUEUED" | "SENT" | "FAILED"; error: string | null }[];
}) {
  const consent = useServerAction((x: { consent: boolean }) => setCustomerEmailConsentAction(customerId, x.consent));
  const unblock = useServerAction(unblockOnlineBookingAction);
  return (
    <div className="space-y-4 text-[14px]">
      <div className="flex flex-wrap items-center gap-2">
        {registeredVia === "ONLINE" ? <Badge tone="info">Сайтаас бүртгүүлсэн</Badge> : onlineRegisteredAt ? <Badge tone="info">Сайтаар нэвтэрдэг</Badge> : <Badge>Ресепшн бүртгэсэн</Badge>}
        {onlineRegisteredAt && <span className="text-ink-soft">Онлайн: {onlineRegisteredAt}</span>}
        {lastLoginAt && <span className="text-ink-soft">· Сүүлд нэвтэрсэн: {lastLoginAt}</span>}
      </div>
      {blocked && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-err-bg px-3 py-2 text-err">
          Ирээгүй 2+ удаа — онлайн захиалга түр хаагдсан.
          {canWrite && <Button size="sm" variant="secondary" disabled={unblock.pending} onClick={() => unblock.run(customerId)}>Нээх</Button>}
        </div>
      )}
      <Checkbox
        label={`Айлчлалын тайланг имэйлээр хүлээн авахыг зөвшөөрсөн${emailConsentAt ? ` (${emailConsentAt})` : ""}`}
        checked={Boolean(emailConsentAt)}
        disabled={!canWrite || consent.pending}
        onChange={(e) => consent.run({ consent: e.target.checked })}
      />
      <div>
        <p className="mb-1 font-medium">Илгээсэн тайлан</p>
        {history.length === 0 ? (
          <p className="text-ink-soft">Илгээгээгүй.</p>
        ) : (
          <ul className="space-y-1">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-2">
                <span className="tabular-nums">{h.at}</span>
                <span className="text-ink-soft">· {h.by ?? "Автомат"}</span>
                <Badge tone={h.status === "SENT" ? "green" : h.status === "FAILED" ? "red" : "neutral"}>{h.status === "SENT" ? "Илгээсэн" : h.status === "FAILED" ? "Алдаа" : "Дараалалд"}</Badge>
                {h.error && <span className="text-[12px] text-err">{h.error}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
