"use client";

import { ChevronLeft, ChevronRight, ImagePlus, Loader2, X } from "lucide-react";
import Image from "next/image";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { uploadImages } from "@/server/actions/upload";
import { t } from "@/i18n";

export type UploadFolder = "products" | "services" | "collections" | "content";
export type GalleryImage = { id?: string; url: string; alt: string };

async function uploadFiles(files: File[], folder: UploadFolder): Promise<string[]> {
  const urls: string[] = [];
  // One file per request (server action body limit)
  for (const file of files) {
    const fd = new FormData();
    fd.set("folder", folder);
    fd.append("files", file);
    const res = await uploadImages(fd);
    if (!res.ok) {
      toast.error(res.error);
      continue;
    }
    urls.push(...res.data);
  }
  return urls;
}

function Thumb({ url, alt }: { url: string; alt: string }) {
  return (
    <Image
      src={url}
      alt={alt}
      fill
      sizes="160px"
      unoptimized={url.endsWith(".svg")}
      className="object-contain"
    />
  );
}

/** Multiple images: upload, alt text, drag to reorder (arrow buttons for keyboard) */
export function GalleryUploader({
  value,
  onChange,
  folder,
  defaultAlt,
}: {
  value: GalleryImage[];
  onChange: (v: GalleryImage[]) => void;
  folder: UploadFolder;
  defaultAlt: string;
}) {
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const dragFrom = useRef<number | null>(null);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= value.length || from === to) return;
    const next = [...value];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    onChange(next);
  };

  const onFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true);
    const urls = await uploadFiles(Array.from(list), folder);
    setBusy(false);
    if (urls.length) onChange([...value, ...urls.map((url) => ({ url, alt: defaultAlt }))]);
  };

  return (
    <div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {value.map((img, i) => (
          <li
            key={img.id ?? img.url}
            draggable
            onDragStart={() => (dragFrom.current = i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragFrom.current !== null) move(dragFrom.current, i);
              dragFrom.current = null;
            }}
            className="group rounded-xl border border-hairline bg-white p-2"
          >
            <div className="relative aspect-square cursor-grab overflow-hidden rounded bg-card active:cursor-grabbing">
              <Thumb url={img.url} alt={img.alt} />
              {i === 0 && (
                <span className="absolute left-1 top-1 rounded bg-navy px-1.5 text-[13px] text-white">{t.admin.upload.primary}</span>
              )}
              <button
                type="button"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                aria-label={t.admin.upload.removeImage}
                className="absolute right-1 top-1 grid size-6 place-items-center rounded bg-white/90 text-navy hover:bg-white"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <input
              value={img.alt}
              onChange={(e) => onChange(value.map((v, j) => (j === i ? { ...v, alt: e.target.value } : v)))}
              placeholder={t.admin.upload.altPlaceholder}
              aria-label={t.admin.upload.altFor(i + 1)}
              className="mt-2 h-7 w-full rounded border border-hairline px-2 text-[13px]"
            />
            <div className="mt-1 flex justify-between">
              <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={t.admin.upload.moveLeft} className="rounded p-1 hover:bg-ink/[0.05] disabled:opacity-30">
                <ChevronLeft className="size-4" />
              </button>
              <button type="button" onClick={() => move(i, i + 1)} disabled={i === value.length - 1} aria-label={t.admin.upload.moveRight} className="rounded p-1 hover:bg-ink/[0.05] disabled:opacity-30">
                <ChevronRight className="size-4" />
              </button>
            </div>
          </li>
        ))}
        <li>
          <label
            htmlFor={inputId}
            className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-hairline text-[13px] text-ink-soft hover:bg-canvas"
          >
            {busy ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" strokeWidth={1.25} />}
            {busy ? t.admin.upload.uploading : t.admin.upload.addImage}
          </label>
          <input
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            multiple
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              void onFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </li>
      </ul>
      <p className="mt-2 text-[13px] text-ink-soft">{t.admin.upload.hint}</p>
    </div>
  );
}

/** Single image */
export function SingleImageUploader({
  value,
  onChange,
  folder,
  label = t.admin.image,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  folder: UploadFolder;
  label?: string;
}) {
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-start gap-3">
      <div className="relative size-24 shrink-0 overflow-hidden rounded-xl border border-hairline bg-card">
        {value ? <Thumb url={value} alt={label} /> : null}
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor={inputId} className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-xl border border-hairline px-2.5 text-[13px] hover:bg-ink/[0.05]">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" strokeWidth={1.25} />}
          {value ? t.admin.upload.replace : t.admin.upload.upload}
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="sr-only"
          disabled={busy}
          onChange={async (e) => {
            const files = e.target.files ? Array.from(e.target.files) : [];
            e.target.value = "";
            if (!files.length) return;
            setBusy(true);
            const [url] = await uploadFiles(files.slice(0, 1), folder);
            setBusy(false);
            if (url) onChange(url);
          }}
        />
        {value && (
          <button type="button" onClick={() => onChange(null)} className="text-left text-[13px] text-danger hover:underline">
            {t.admin.remove}
          </button>
        )}
      </div>
    </div>
  );
}
