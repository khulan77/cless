"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Badge, Button, Field, Input, Select } from "@/components/admin/ui";
import { useServerAction } from "@/components/admin/use-action";
import { formatMNT } from "@/lib/money";
import { ubDateKey } from "@/lib/time";
import { refundPackageAction, reverseRedemptionAction } from "@/server/actions/packages";

export type CustomerPackageView = {
  id: string;
  name: string;
  status: "ACTIVE" | "USED_UP" | "EXPIRED" | "REFUNDED";
  totalSessions: number;
  usedSessions: number;
  paidAmount: number;
  purchasedAt: Date;
  expiresAt: Date | null;
  refundAmount: number | null;
  /** Буцаалт хийвэл: үлдэгдэл, торгууль, буцаах дүн */
  refund: { remaining: number; penalty: number; refund: number } | null;
  redemptions: { id: string; createdAt: Date; unitValue: number; reversedAt: Date | null; reverseReason: string | null; service: string; staff: string | null }[];
};

const STATUS: Record<CustomerPackageView["status"], { label: string; tone: "green" | "neutral" | "amber" | "red" }> = {
  ACTIVE: { label: "Идэвхтэй", tone: "green" },
  USED_UP: { label: "Дууссан", tone: "neutral" },
  EXPIRED: { label: "Хугацаа дууссан", tone: "amber" },
  REFUNDED: { label: "Цуцалсан", tone: "red" },
};

/** Үйлчлүүлэгчийн карт — багц бүр: 7/11, дуусах огноо, ашигласан огноонууд (PROMPT 27 §4) */
export function CustomerPackages({ packages, canReverse, canRefund }: { packages: CustomerPackageView[]; canReverse: boolean; canRefund: boolean }) {
  const router = useRouter();
  const [reverseId, setReverseId] = useState<string | null>(null);
  const [refundPkg, setRefundPkg] = useState<CustomerPackageView | null>(null);
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState<"CASH" | "CARD" | "TRANSFER" | "QPAY">("CASH");
  const rev = useServerAction(reverseRedemptionAction);
  const ref = useServerAction(refundPackageAction);
  const close = () => (setReverseId(null), setRefundPkg(null), setReason(""), router.refresh());

  if (packages.length === 0) return <p className="text-[14px] text-ink-soft">Багц алга. Багцыг POS-оос худалдана.</p>;

  return (
    <div className="space-y-4">
      {packages.map((p) => {
        const s = STATUS[p.status];
        return (
          <div key={p.id} className="rounded-xl border border-hairline p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[15px] font-medium">{p.name}</p>
                <p className="text-[13px] text-ink-soft">
                  Авсан {ubDateKey(p.purchasedAt)} · {formatMNT(p.paidAmount)} · {p.expiresAt ? `Дуусах ${ubDateKey(p.expiresAt)}` : "Хугацаагүй"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[18px] tabular-nums">
                  {p.usedSessions}/{p.totalSessions} <span className="text-[13px] text-ink-soft">ашигласан</span>
                </span>
                <Badge tone={s.tone}>{s.label}</Badge>
                {canRefund && p.status === "ACTIVE" && p.refund && (
                  <Button size="sm" variant="ghost" onClick={() => setRefundPkg(p)}>
                    Цуцлах / буцаах
                  </Button>
                )}
              </div>
            </div>
            {p.status === "REFUNDED" && p.refundAmount !== null && <p className="mt-1 text-[13px] text-ink-soft">Буцаасан: {formatMNT(p.refundAmount)}</p>}
            {p.redemptions.length > 0 && (
              <ul className="mt-3 divide-y divide-hairline text-[14px]">
                {p.redemptions.map((r) => (
                  <li key={r.id} className={`flex flex-wrap items-center justify-between gap-2 py-1.5 ${r.reversedAt ? "text-ink-soft line-through" : ""}`}>
                    <span className="tabular-nums">{ubDateKey(r.createdAt)}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {r.service}
                      {r.staff ? ` · ${r.staff}` : ""}
                    </span>
                    <span className="tabular-nums">{formatMNT(r.unitValue)}</span>
                    {r.reversedAt ? (
                      <span className="text-[12px] no-underline">Буцаасан: {r.reverseReason}</span>
                    ) : (
                      canReverse && (
                        <Button size="sm" variant="ghost" onClick={() => setReverseId(r.id)}>
                          Буцаах
                        </Button>
                      )
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}

      <ConfirmDialog
        open={reverseId !== null}
        title="Багцын хасалтыг буцаах уу?"
        confirmLabel="Буцаах"
        danger
        pending={rev.pending}
        confirmDisabled={reason.trim().length < 5}
        onClose={() => (setReverseId(null), setReason(""))}
        onConfirm={() => reverseId && rev.run({ redemptionId: reverseId, reason }, { onSuccess: close })}
      >
        <Field label="Шалтгаан (заавал)" htmlFor="cp-rev">
          <Input id="cp-rev" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Буруу хассан" />
        </Field>
      </ConfirmDialog>

      <ConfirmDialog
        open={refundPkg !== null}
        title="Багцыг цуцалж мөнгө буцаах уу?"
        confirmLabel="Буцаах"
        danger
        pending={ref.pending}
        confirmDisabled={reason.trim().length < 5}
        onClose={() => (setRefundPkg(null), setReason(""))}
        onConfirm={() => refundPkg && ref.run({ customerPackageId: refundPkg.id, method, reason }, { onSuccess: close })}
      >
        {refundPkg?.refund && (
          <dl className="mb-3 grid grid-cols-2 gap-1 text-[14px]">
            <dt className="text-ink-soft">Үлдэгдэл өртөг</dt>
            <dd className="text-right tabular-nums">{formatMNT(refundPkg.refund.remaining)}</dd>
            <dt className="text-ink-soft">Торгууль</dt>
            <dd className="text-right tabular-nums">−{formatMNT(refundPkg.refund.penalty)}</dd>
            <dt className="font-medium">Буцаах дүн</dt>
            <dd className="text-right font-medium tabular-nums">{formatMNT(refundPkg.refund.refund)}</dd>
          </dl>
        )}
        <Field label="Буцаах арга" htmlFor="cp-method">
          <Select id="cp-method" value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
            <option value="CASH">Бэлэн</option>
            <option value="CARD">Карт</option>
            <option value="TRANSFER">Шилжүүлэг</option>
            <option value="QPAY">QPay</option>
          </Select>
        </Field>
        <Field label="Шалтгаан (заавал)" htmlFor="cp-ref">
          <Input id="cp-ref" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </ConfirmDialog>
    </div>
  );
}
