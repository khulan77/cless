"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Button, Field, Input } from "@/components/admin/ui";
import { useServerAction } from "@/components/admin/use-action";
import { formatMNT } from "@/lib/money";
import { appointmentPackagesAction, attachPackageAction, reverseRedemptionAction } from "@/server/actions/packages";

type Data = Extract<Awaited<ReturnType<typeof appointmentPackagesAction>>, { ok: true }>["data"];

/**
 * Цагийн самбар — багц (PROMPT 27 §4): тохирох идэвхтэй багц байвал «Багцаас ашиглах (үлдэгдэл 7/11)».
 * Хасалт цаг «Орсон» болоход (нэг цагт нэг удаа). Буруу хассаныг шалтгаантай буцаана.
 */
export function PackageSection({ appointmentId, status, reloadKey, onChanged }: { appointmentId: string; status: string; reloadKey: number; onChanged: () => void }) {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [tick, setTick] = useState(0);
  const [reverse, setReverse] = useState(false);
  const [reason, setReason] = useState("");
  const attach = useServerAction(attachPackageAction);
  const rev = useServerAction(reverseRedemptionAction);
  useEffect(() => {
    let stale = false;
    void appointmentPackagesAction(appointmentId).then((r) => {
      if (!stale && r.ok) setData(r.data);
    });
    return () => {
      stale = true;
    };
  }, [appointmentId, reloadKey, tick]);

  const done = () => (setTick((x) => x + 1), onChanged(), router.refresh());
  if (!data || (!data.attached && data.usable.length === 0)) return null;
  const closed = status === "CANCELLED" || status === "NO_SHOW";

  return (
    <section>
      <h3 className="mb-1.5 text-[13px] font-medium uppercase tracking-[0.4px] text-ink-soft">Багц</h3>
      {data.attached ? (
        <div className="space-y-2 text-[14px]">
          <p>
            «{data.attached.name}» — <strong className="tabular-nums">Багц {data.attached.used}/{data.attached.total}</strong>
          </p>
          {data.redemption ? (
            <p className="flex flex-wrap items-center gap-2 text-ink-soft">
              Энэ цагт хасагдсан ({formatMNT(data.redemption.unitValue)})
              <Button size="sm" variant="ghost" onClick={() => setReverse(true)}>Буцаах</Button>
            </p>
          ) : (
            <p className="flex flex-wrap items-center gap-2 text-ink-soft">
              «Орсон» болоход 1 удаа хасагдана.
              {!closed && (
                <Button size="sm" variant="ghost" disabled={attach.pending} onClick={() => attach.run({ appointmentId, customerPackageId: null }, { onSuccess: done })}>
                  Салгах
                </Button>
              )}
            </p>
          )}
        </div>
      ) : (
        !closed && (
          <ul className="space-y-1.5">
            {data.usable.map((p) => (
              <li key={p.id}>
                <Button size="sm" variant="secondary" disabled={attach.pending} onClick={() => attach.run({ appointmentId, customerPackageId: p.id }, { onSuccess: done })}>
                  Багцаас ашиглах — {p.name} (үлдэгдэл {p.left}/{p.total})
                </Button>
              </li>
            ))}
          </ul>
        )
      )}
      <ConfirmDialog
        open={reverse}
        title="Багцын хасалтыг буцаах уу?"
        confirmLabel="Буцаах"
        danger
        pending={rev.pending}
        confirmDisabled={reason.trim().length < 5}
        onClose={() => setReverse(false)}
        onConfirm={() => data.redemption && rev.run({ redemptionId: data.redemption.id, reason }, { onSuccess: () => (setReverse(false), setReason(""), done()) })}
      >
        <Field label="Шалтгаан (заавал)" htmlFor="pk-rev">
          <Input id="pk-rev" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Буруу хассан" />
        </Field>
      </ConfirmDialog>
    </section>
  );
}
