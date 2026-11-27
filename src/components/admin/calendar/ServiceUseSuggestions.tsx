"use client";

import { useEffect, useState } from "react";
import { ServiceUseButton } from "@/components/admin/inventory/ServiceUseButton";
import { serviceUseSuggestionsAction } from "@/server/actions/stock";

type Data = Extract<Awaited<ReturnType<typeof serviceUseSuggestionsAction>>, { ok: true }>["data"];

/**
 * «Орсон» цаг (PROMPT 27 §3): үйлчилгээний ServiceConsumable-аас материал санал болгоно — менежер «Олгох» дарж
 * батална (автоматаар үлдэгдлээс хасахгүй). Аль хэдийн олгосныг харуулна.
 */
export function ServiceUseSuggestions({ appointmentId, reloadKey }: { appointmentId: string; reloadKey: number }) {
  const [data, setData] = useState<Data | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let stale = false;
    void serviceUseSuggestionsAction(appointmentId).then((r) => {
      if (!stale && r.ok) setData(r.data);
    });
    return () => {
      stale = true;
    };
  }, [appointmentId, reloadKey, tick]);

  if (!data || data.items.length === 0) return null;
  return (
    <section>
      <h3 className="mb-1.5 text-[13px] font-medium uppercase tracking-[0.4px] text-ink-soft">Үйлчилгээнд зарцуулах материал</h3>
      <ul className="space-y-1.5 text-[14px]">
        {data.items.map((i) => (
          <li key={i.variantId} className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 flex-1">
              {i.name}
              <span className="block text-[12px] text-ink-soft tabular-nums">
                Норм {i.norm} · олгосон {i.issued} · үлдэгдэл {i.stock}
              </span>
            </span>
            {i.suggested > 0 ? (
              <ServiceUseButton
                variantId={i.variantId}
                label={i.name}
                staff={[]}
                appointmentId={appointmentId}
                defaultQty={i.suggested}
                buttonLabel={`Олгох (${i.suggested})`}
                onDone={() => setTick((x) => x + 1)}
              />
            ) : (
              <span className="text-[12px] text-ok">Олгосон ✓</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
