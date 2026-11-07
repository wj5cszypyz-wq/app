"use client";
// "Saved. [Undo]" toasts: one call after any change that returned a changeId.
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useToast } from "./toast";
import { useStorePaths } from "./use-store";

export function useUndoToast(onUndone?: () => void) {
  const notify = useToast();
  const paths = useStorePaths();
  const router = useRouter();
  return useCallback(
    (title: string, body: string | undefined, changeId: string | undefined) => {
      notify("success", title, body, changeId ? {
        label: "Undo",
        onClick: async () => {
          const res = await fetch(paths.api(`/manage/history/${changeId}/undo`), { method: "POST" });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) return notify("error", "Couldn't undo", json.error);
          notify("success", "Undone", undefined, {
            label: "Redo",
            onClick: async () => {
              const again = await fetch(paths.api(`/manage/history/${json.changeId}/undo`), { method: "POST" });
              if (!again.ok) return notify("error", "Couldn't redo", (await again.json().catch(() => ({}))).error);
              notify("success", "Redone");
              onUndone?.();
              router.refresh();
            },
          });
          onUndone?.();
          router.refresh();
        },
      } : undefined);
    },
    [notify, paths, router, onUndone],
  );
}
