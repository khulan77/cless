"use client";

import { Camera, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useServerAction } from "@/components/admin/use-action";
import { Checkbox, Select } from "@/components/admin/ui";
import { t } from "@/i18n";
import { formatDateLabel, formatTime } from "@/lib/time";
import { visitPhotoDelete, visitPhotoUpload } from "@/server/actions/visit-photos";

const P = t.admin.photos;

export type PhotoView = { id: string; note: string | null; by: string; canDelete: boolean };
export type PhotoGroupView = { key: string; at: string; title: string | null; appointmentId: string | null; visitId: string | null; before: PhotoView[]; after: PhotoView[] };
export type PhotoTarget = { appointmentId: string; label: string };

/** Phone photos can be 5–10 MB: scale to ≤2560px JPEG in the browser (also drops EXIF); the server makes the final 2048px webp */
async function shrink(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, 2560 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    return await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("blob"))), "image/jpeg", 0.88));
  } catch {
    return file; // e.g. HEIC the browser cannot decode — the server tries
  }
}

/**
 * Өмнө / дараа зураг: бүлэг (цаг эсвэл айлчлал) бүрт хоёр багана хажуу хажуудаа. Утаснаас шууд
 * камераар (capture="environment"). Зөвшөөрөлгүй үйлчлүүлэгчид эхлээд checkbox заавал.
 */
export function VisitPhotos({
  customerId,
  consented,
  groups,
  targets,
  canWrite,
}: {
  customerId: string;
  consented: boolean;
  groups: PhotoGroupView[];
  /** Шинэ зургийг аль цагт холбох (өнөөдрийн/сүүлийн цагууд) */
  targets: PhotoTarget[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [consent, setConsent] = useState(false);
  const [target, setTarget] = useState(targets[0]?.appointmentId ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const remove = useServerAction(visitPhotoDelete);
  const allowed = consented || consent;

  const upload = async (files: FileList | null, kind: "BEFORE" | "AFTER", link: { appointmentId: string | null; visitId: string | null }, slot: string) => {
    if (!files || files.length === 0) return;
    setBusy(slot);
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.set("customerId", customerId);
      fd.set("kind", kind);
      if (link.appointmentId) fd.set("appointmentId", link.appointmentId);
      if (link.visitId) fd.set("visitId", link.visitId);
      fd.set("consent", allowed ? "1" : "0");
      fd.set("file", await shrink(file), "photo.jpg");
      const res = await visitPhotoUpload(fd);
      if (!res.ok) {
        toast.error(res.error);
        break;
      }
    }
    setBusy(null);
    router.refresh();
  };

  const picker = (kind: "BEFORE" | "AFTER", link: { appointmentId: string | null; visitId: string | null }, slot: string) =>
    canWrite && (
      <label
        className={`inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-dashed px-3.5 text-[14px] ${
          allowed ? "border-ink/25 text-ink hover:border-navy hover:bg-canvas" : "pointer-events-none border-hairline text-ink-faint"
        }`}
        aria-disabled={!allowed}
      >
        <Camera className="size-4" strokeWidth={1.75} aria-hidden />
        {busy === slot ? P.uploading : kind === "BEFORE" ? P.addBefore : P.addAfter}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          disabled={!allowed || busy !== null}
          className="sr-only"
          onChange={(e) => (void upload(e.target.files, kind, link, slot), (e.target.value = ""))}
        />
      </label>
    );

  const column = (label: string, list: PhotoView[]) => (
    <div>
      <p className="mb-2 text-[13px] font-medium uppercase tracking-[0.4px] text-ink-soft">{label}</p>
      {list.length === 0 ? (
        <p className="text-[14px] text-ink-faint">—</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {list.map((p) => (
            <figure key={p.id} className="relative overflow-hidden rounded-xl border border-hairline bg-canvas">
              <a href={`/api/media/visit/${p.id}`} target="_blank" rel="noopener">
                {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-checked route; never through the image optimizer */}
                <img src={`/api/media/visit/${p.id}`} alt={`${label} — ${p.by}`} loading="lazy" className="aspect-[3/4] w-full object-cover" />
              </a>
              <figcaption className="px-2 py-1 text-[12px] text-ink-soft">{p.by}</figcaption>
              {p.canDelete && (
                <button type="button" aria-label={P.delete} onClick={() => setRemoving(p.id)} className="absolute right-1.5 top-1.5 grid size-8 place-items-center rounded-lg bg-white/90 text-ink-soft hover:text-danger">
                  <Trash2 className="size-4" strokeWidth={1.75} />
                </button>
              )}
            </figure>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      {canWrite && (
        <div className="space-y-3 rounded-2xl border border-hairline bg-white p-4">
          {!consented && <Checkbox label={P.consent} checked={consent} onChange={(e) => setConsent(e.target.checked)} />}
          {targets.length > 0 && (
            <label className="block text-[14px]">
              <span className="mb-1 block text-ink-soft">{P.linkTo}</span>
              <Select value={target} onChange={(e) => setTarget(e.target.value)} className="w-full min-w-0 max-w-md truncate">
                {targets.map((x) => (
                  <option key={x.appointmentId} value={x.appointmentId}>
                    {x.label}
                  </option>
                ))}
                <option value="">{P.noAppointment}</option>
              </Select>
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            {picker("BEFORE", { appointmentId: target || null, visitId: null }, "new-before")}
            {picker("AFTER", { appointmentId: target || null, visitId: null }, "new-after")}
          </div>
          <p className="text-[13px] text-ink-soft">{P.privacy}</p>
        </div>
      )}

      {groups.length === 0 ? (
        <p className="text-[14px] text-ink-soft">{P.empty}</p>
      ) : (
        groups.map((g) => (
          <section key={g.key} className="rounded-2xl border border-hairline bg-white p-4">
            <h3 className="mb-3 text-[15px] font-semibold">
              {formatDateLabel(new Date(g.at))} {g.appointmentId ? formatTime(new Date(g.at)) : ""}
              {g.title ? <span className="font-normal text-ink-soft"> · {g.title}</span> : null}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                {column(P.before, g.before)}
                {picker("BEFORE", { appointmentId: g.appointmentId, visitId: g.visitId }, `${g.key}-before`)}
              </div>
              <div className="space-y-2">
                {column(P.after, g.after)}
                {picker("AFTER", { appointmentId: g.appointmentId, visitId: g.visitId }, `${g.key}-after`)}
              </div>
            </div>
          </section>
        ))
      )}

      <ConfirmDialog
        open={removing !== null}
        title={P.deleteTitle}
        confirmLabel={P.delete}
        danger
        pending={remove.pending}
        onClose={() => setRemoving(null)}
        onConfirm={() => remove.run(removing!, { onSuccess: () => (setRemoving(null), router.refresh()) })}
      >
        <p className="text-[14px]">{P.deleteHint}</p>
      </ConfirmDialog>
    </div>
  );
}
