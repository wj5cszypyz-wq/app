"use client";
import { useState } from "react";
import { useStorePaths } from "@/components/use-store";

/** "Invited · Resend" for customers who haven't set up their login yet. */
export function ResendInvite({ customerId }: { customerId: string }) {
  const paths = useStorePaths();
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">("idle");
  if (state === "sent") return <span className="muted" style={{ fontSize: 12.5 }}>Invite sent</span>;
  return (
    <button
      className="btn btn-sm"
      disabled={state === "busy"}
      onClick={async () => {
        setState("busy");
        const res = await fetch(paths.api(`/manage/customers/${customerId}/invite`), { method: "POST" });
        setState(res.ok ? "sent" : "error");
      }}
    >
      {state === "error" ? "Couldn't send. Retry" : "Resend invite"}
    </button>
  );
}
