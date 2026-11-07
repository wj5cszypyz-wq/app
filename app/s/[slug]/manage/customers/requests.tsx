"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/toast";
import { useStorePaths } from "@/components/use-store";

type Req = { id: string; businessName: string; contactName: string; email: string; phone: string | null; message: string | null };

/** Pending "request an account" submissions, with Approve / Decline. */
export function AccountRequests({ requests }: { requests: Req[] }) {
  const router = useRouter();
  const paths = useStorePaths();
  const notify = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  if (requests.length === 0) return null;

  async function act(id: string, action: "approve" | "decline") {
    setBusy(id);
    const res = await fetch(paths.api(`/manage/requests/${id}`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return notify("error", "Couldn't update the request", json.error);
    notify("success", action === "approve" ? "Approved. Invite sent." : "Request declined");
    router.refresh();
  }

  return (
    <div className="panel" style={{ marginBottom: 18 }}>
      <div className="panel-head"><h2>Account requests</h2><span className="muted" style={{ fontSize: 12.5 }}>{requests.length} waiting</span></div>
      <div className="stack" style={{ gap: 0 }}>
        {requests.map((r) => (
          <div key={r.id} className="row-between request-row">
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, overflowWrap: "anywhere" }}>{r.businessName}</div>
              <div className="dim" style={{ fontSize: 12, overflowWrap: "anywhere" }}>{[r.contactName, r.email, r.phone].filter(Boolean).join(" · ")}</div>
              {r.message && <div className="muted" style={{ fontSize: 13, marginTop: 4, overflowWrap: "anywhere" }}>{r.message}</div>}
            </div>
            <div className="row" style={{ flexShrink: 0 }}>
              <button className="btn btn-sm" disabled={busy === r.id} onClick={() => act(r.id, "decline")}>Decline</button>
              <button className="btn btn-sm btn-primary" disabled={busy === r.id} onClick={() => act(r.id, "approve")}>Approve</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Owner switch for the public request page, with its link to share. */
export function RequestsToggle({ initial, slug }: { initial: boolean; slug: string }) {
  const paths = useStorePaths();
  const notify = useToast();
  const [on, setOn] = useState(initial);
  const [origin] = useState(() => (typeof window === "undefined" ? "" : window.location.origin));
  return (
    <div className="panel panel-pad row-between" style={{ marginBottom: 18, flexWrap: "wrap" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>Let new customers ask for an account</div>
        <div className="muted" style={{ fontSize: 13, overflowWrap: "anywhere" }}>
          {on ? <>Share this link: <span className="mono">{origin}/join/{slug}</span></> : "Off. Only people you invite can order."}
        </div>
      </div>
      <button
        className="switch"
        role="switch"
        aria-checked={on}
        aria-label="Let new customers ask for an account"
        onClick={async () => {
          const next = !on;
          setOn(next);
          const res = await fetch(paths.api("/manage/store"), {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ allowAccountRequests: next }),
          });
          if (!res.ok) {
            setOn(!next);
            notify("error", "Couldn't change the setting");
          }
        }}
      />
    </div>
  );
}
