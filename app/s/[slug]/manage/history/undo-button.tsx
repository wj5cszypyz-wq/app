"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/toast";
import { useStorePaths } from "@/components/use-store";

export function UndoButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const paths = useStorePaths();
  const notify = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn btn-sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const res = await fetch(paths.api(`/manage/history/${id}/undo`), { method: "POST" });
        const json = await res.json().catch(() => ({}));
        setBusy(false);
        if (!res.ok) return notify("error", `Couldn't ${label.toLowerCase()}`, json.error);
        notify("success", label === "Redo" ? "Redone" : "Undone");
        router.refresh();
      }}
    >
      {label}
    </button>
  );
}
