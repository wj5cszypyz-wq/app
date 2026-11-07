"use client";
// Up to 4 photos per product: upload, preview in square frames, remove, first one is the cover.
import { useRef, useState } from "react";
import { IconX } from "@/components/icons";
import { Spinner } from "@/components/status";
import { useStorePaths } from "@/components/use-store";

export async function uploadImage(api: (p: string) => string, file: File, kind: "product" | "logo" | "banner") {
  const fd = new FormData();
  fd.set("kind", kind);
  fd.set("file", file);
  const res = await fetch(api("/manage/uploads"), { method: "POST", body: fd });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Upload failed.");
  return json.id as string;
}

export function PhotoPicker({ ids, onChange }: { ids: string[]; onChange: (ids: string[]) => void }) {
  const paths = useStorePaths();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    const next = [...ids];
    for (const file of Array.from(files).slice(0, 4 - ids.length)) {
      try {
        next.push(await uploadImage(paths.api, file, "product"));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed.");
      }
    }
    onChange(next);
    setBusy(false);
    if (input.current) input.current.value = "";
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="photo-row">
        {ids.map((id, i) => (
          <div key={id} className="photo-thumb">
            {/* eslint-disable-next-line @next/next/no-img-element -- served by our access-checked route */}
            <img src={`/api/files/${id}`} alt={i === 0 ? "Cover photo" : `Photo ${i + 1}`} />
            <button type="button" className="photo-remove" aria-label="Remove photo" onClick={() => onChange(ids.filter((x) => x !== id))}><IconX /></button>
            {i === 0 && <span className="photo-cover">Cover</span>}
          </div>
        ))}
        {ids.length < 4 && (
          <button type="button" className="photo-add" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? <Spinner /> : <><span aria-hidden>＋</span><span>Add photo</span></>}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => pick(e.target.files)} />
      {error && <div className="error-box" role="alert">{error}</div>}
      <div className="dim" style={{ fontSize: 12 }}>JPEG, PNG or WebP, up to 8 MB. Shown in square frames; the first photo is the cover.</div>
    </div>
  );
}
