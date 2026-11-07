"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function StoreStatusButton({ id, name, suspended }: { id: string; name: string; suspended: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className={`btn btn-sm ${suspended ? "" : "btn-danger"}`}
      disabled={busy}
      onClick={async () => {
        if (!suspended && !confirm(`Suspend ${name}? Its owner, staff and customers lose access until you reopen it.`)) return;
        setBusy(true);
        await fetch(`/api/admin/stores/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: suspended ? "active" : "suspended" }),
        });
        setBusy(false);
        router.refresh();
      }}
    >
      {suspended ? "Reopen" : "Suspend"}
    </button>
  );
}
