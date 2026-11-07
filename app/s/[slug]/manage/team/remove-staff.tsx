"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useStorePaths } from "@/components/use-store";

export function RemoveStaff({ userId, name }: { userId: string; name: string }) {
  const router = useRouter();
  const paths = useStorePaths();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn btn-sm btn-danger"
      disabled={busy}
      onClick={async () => {
        if (!confirm(`Remove ${name}? They lose access to this store right away.`)) return;
        setBusy(true);
        await fetch(paths.api(`/manage/staff/${userId}`), { method: "DELETE" });
        setBusy(false);
        router.refresh();
      }}
    >
      Remove
    </button>
  );
}
