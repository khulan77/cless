"use client";

import { LocateFixed } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useServerAction } from "@/components/admin/use-action";
import { Button, Field, Input, Textarea } from "@/components/admin/ui";
import { saveBranchLocationAction } from "@/server/actions/attendance";

type Loc = { latitude: number | null; longitude: number | null; geoRadiusM: number; allowedIps: string[] };

export function BranchLocationForm({ initial }: { initial: Loc }) {
  const [lat, setLat] = useState(initial.latitude?.toString() ?? "");
  const [lng, setLng] = useState(initial.longitude?.toString() ?? "");
  const [radius, setRadius] = useState(initial.geoRadiusM);
  const [ips, setIps] = useState(initial.allowedIps.join("\n"));
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const { run, pending, fieldErrors } = useServerAction(saveBranchLocationAction);

  const useHere = () => {
    if (!("geolocation" in navigator)) return void toast.error("Энэ хөтөч байршил дэмждэггүй.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        setLat(p.coords.latitude.toFixed(6));
        setLng(p.coords.longitude.toFixed(6));
        setAccuracy(Math.round(p.coords.accuracy));
      },
      (e) => {
        setLocating(false);
        toast.error(e.code === 1 ? "Байршлын зөвшөөрөл өгөөгүй байна." : "Байршил тогтоож чадсангүй.");
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  };

  const has = lat !== "" && lng !== "";
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        run({ latitude: has ? Number(lat) : null, longitude: has ? Number(lng) : null, geoRadiusM: radius, allowedIps: ips.split(/[\s,]+/) });
      }}
    >
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Өргөрөг (latitude)" htmlFor="lat" error={fieldErrors.latitude} className="w-48">
          <Input id="lat" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="47.918" />
        </Field>
        <Field label="Уртраг (longitude)" htmlFor="lng" error={fieldErrors.longitude} className="w-48">
          <Input id="lng" inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="106.917" />
        </Field>
        <Button variant="secondary" onClick={useHere} disabled={locating}>
          <LocateFixed className="size-4" aria-hidden /> {locating ? "Байршил тогтоож байна…" : "Одоогийн байршлаа ашиглах"}
        </Button>
      </div>
      <p className="text-[13px] text-ink-soft">
        Салон дотор байхдаа «Одоогийн байршлаа ашиглах» дарна уу{accuracy !== null ? ` (нарийвчлал ~${accuracy} м)` : ""}.
        {has && (
          <>
            {" "}
            <a className="underline" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`}>
              Газрын зураг дээр шалгах
            </a>
          </>
        )}
      </p>
      <Field label={`Зөвшөөрөх радиус: ${radius} м`} htmlFor="radius" error={fieldErrors.geoRadiusM} hint="Барилга дотор GPS 20–100 м алдаатай байж болно. Ажилтнууд «зайтай байна» гэж байвал нэмнэ.">
        <input id="radius" type="range" min={50} max={300} step={10} value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full max-w-md accent-navy" />
      </Field>
      <Field label="Салоны Wi-Fi-ийн гадаад IP (заавал биш)" htmlFor="ips" error={fieldErrors.allowedIps} hint="Тохируулбал өөр сүлжээнээс дарсныг ⚠ тэмдэглэнэ (хаахгүй — утасны дата ашиглаж болно). Мөр бүрт нэг IP.">
        <Textarea id="ips" rows={3} value={ips} onChange={(e) => setIps(e.target.value)} className="max-w-md font-mono" />
      </Field>
      <Button type="submit" disabled={pending}>{pending ? "Хадгалж байна…" : "Хадгалах"}</Button>
    </form>
  );
}
