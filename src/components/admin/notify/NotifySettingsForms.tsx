"use client";

import { useState } from "react";
import { useServerAction } from "@/components/admin/use-action";
import { Button, Card, Checkbox, Field, Textarea } from "@/components/admin/ui";
import { saveNotifySettingsAction, saveTemplatesAction } from "@/server/actions/notify";

export function AutoVisitEmailToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const { run, pending } = useServerAction(saveNotifySettingsAction);
  return (
    <Checkbox
      label="Айлчлал дуусахад (төлбөр төлөгдөхөд) тайланг автоматаар имэйлээр илгээх — зөвхөн зөвшөөрсөн үйлчлүүлэгчид"
      checked={on}
      disabled={pending}
      onChange={(e) => {
        setOn(e.target.checked);
        run({ autoVisitEmail: e.target.checked });
      }}
    />
  );
}

export function TemplatesForm({ templates, defaults, labels }: { templates: Record<string, string>; defaults: Record<string, string>; labels: Record<string, string> }) {
  const [v, setV] = useState(templates);
  const { run, pending, fieldErrors } = useServerAction(saveTemplatesAction);
  return (
    <Card title="Загварууд" description="Хувьсагч: {name} {service} {date} {time} {salon} {link} {reason} {staff}. Кирилл SMS-ийн 1 хэсэг 65 тэмдэгт — богино байлгана.">
      <form className="space-y-4" onSubmit={(e) => (e.preventDefault(), run(v))}>
        {Object.keys(labels).map((k) => (
          <Field key={k} label={labels[k]} htmlFor={`tpl-${k}`} error={fieldErrors[k]} hint={`${v[k]?.length ?? 0} тэмдэгт${v[k] !== defaults[k] ? " · өөрчилсөн" : ""}`}>
            <Textarea id={`tpl-${k}`} className="min-h-20" maxLength={600} value={v[k] ?? ""} onChange={(e) => setV((x) => ({ ...x, [k]: e.target.value }))} />
          </Field>
        ))}
        <div className="flex justify-between gap-2">
          <Button variant="ghost" onClick={() => setV(defaults)}>Анхдагч руу буцаах</Button>
          <Button type="submit" disabled={pending}>{pending ? "Хадгалж байна…" : "Хадгалах"}</Button>
        </div>
      </form>
    </Card>
  );
}
