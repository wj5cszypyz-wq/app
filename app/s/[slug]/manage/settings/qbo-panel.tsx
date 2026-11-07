"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { IconCheck, IconLink } from "@/components/icons";
import { Spinner } from "@/components/status";
import { useToast } from "@/components/toast";
import { useStorePaths } from "@/components/use-store";

type Props = {
  isOwner: boolean;
  result: { kind: "success" | "error"; text: string } | null;
  configured: boolean;
  environment: "sandbox" | "production";
  connected: boolean;
  companyName: string | null;
  realmId: string | null;
  refreshExpires: string | null;
  syncedCount: number;
  waitingCount: number;
  redirectUri: string;
};

export function QboPanel(p: Props) {
  const router = useRouter();
  const paths = useStorePaths();
  const notify = useToast();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (p.result) notify(p.result.kind, p.result.text);
    // Only on first render for this result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.result?.text]);

  async function disconnect() {
    if (!confirm("Disconnect QuickBooks? Orders will still come in, but won't become invoices until you reconnect.")) return;
    setBusy(true);
    await fetch(paths.api("/manage/qbo/disconnect"), { method: "POST" });
    setBusy(false);
    notify("success", "QuickBooks disconnected");
    router.refresh();
  }

  return (
    <div className="detail-grid">
      <div className="stack">
        <div className={`panel panel-pad stack qbo-card ${p.connected ? "synced" : ""}`} style={{ gap: 18 }}>
          <div className="row-between">
            <div className="row" style={{ gap: 14 }}>
              <span className="brand-mark" style={{ width: 44, height: 44, borderRadius: 14 }}>
                {p.connected ? <IconCheck style={{ color: "var(--green)" }} /> : <IconLink />}
              </span>
              <div>
                <h2>{p.connected ? p.companyName ?? "QuickBooks company" : "Not connected"}</h2>
                <div className="muted" style={{ fontSize: 13 }}>
                  {p.connected ? `Company ID ${p.realmId} · ${p.environment}` : "QuickBooks Online"}
                </div>
              </div>
            </div>
            <span className={`live ${p.connected ? "" : "off"}`}><i />{p.connected ? "Linked" : "Offline"}</span>
          </div>

          {p.connected ? (
            <>
              <div className="stats" style={{ gridTemplateColumns: "1fr 1fr", margin: 0 }}>
                <div className="panel stat"><div className="eyebrow">Invoices created</div><span className="num">{p.syncedCount}</span></div>
                <div className={`panel stat ${p.waitingCount ? "warn" : ""}`}><div className="eyebrow">Waiting to send</div><span className="num">{p.waitingCount}</span><div className="sub">{p.waitingCount ? "open each order to send it" : "nothing pending"}</div></div>
              </div>
              {p.refreshExpires && (
                <div className="muted" style={{ fontSize: 12.5 }}>
                  Connection stays active as long as orders keep flowing. It must be renewed by{" "}
                  {new Date(p.refreshExpires).toLocaleDateString(undefined, { dateStyle: "medium" })} if no orders sync before then.
                </div>
              )}
              {p.isOwner ? (
                <div className="row">
                  <a className="btn btn-primary" href={paths.api("/manage/qbo/connect")}>Reconnect</a>
                  <button className="btn btn-danger" disabled={busy} onClick={disconnect}>{busy ? <Spinner /> : "Disconnect"}</button>
                </div>
              ) : (
                <div className="muted" style={{ fontSize: 13 }}>Only the store owner can reconnect or disconnect QuickBooks.</div>
              )}
            </>
          ) : !p.isOwner ? (
            <p className="muted" style={{ margin: 0 }}>Ask the store owner to connect QuickBooks.</p>
          ) : p.configured ? (
            <>
              <p className="muted" style={{ margin: 0 }}>
                You'll sign in to QuickBooks and approve access. We only ask for accounting access: customers, items and invoices.
              </p>
              <a className="btn btn-primary btn-lg" href={paths.api("/manage/qbo/connect")} style={{ alignSelf: "flex-start" }}>
                <IconLink /> Connect QuickBooks
              </a>
            </>
          ) : (
            <div className="error-box">
              This server has no Intuit app keys yet. Follow the setup steps on the right, then restart the app.
            </div>
          )}
        </div>

        <div className="panel panel-pad stack">
          <div className="eyebrow">What happens on every order</div>
          <ol className="muted" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
            <li>The customer is matched to a QuickBooks <b>Customer</b> by name, or created.</li>
            <li>Each product is matched to a QuickBooks <b>Item</b> (Non-inventory), or created.</li>
            <li>An <b>Invoice</b> is created with that customer's prices, numbered <span className="mono">ORD-####</span>.</li>
            <li>If QuickBooks is down or rejects it, the order is kept and flagged so you can retry. Retries never make duplicates.</li>
          </ol>
        </div>
      </div>

      <div className="panel panel-pad stack">
        <div className="eyebrow">One-time setup ({p.environment})</div>
        <ol style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 10, fontSize: 13.5 }}>
          <li>Sign in at <a href="https://developer.intuit.com" target="_blank" rel="noreferrer" style={{ color: "var(--green)" }}>developer.intuit.com</a> and create an app with the <b>Accounting</b> scope.</li>
          <li>Under <b>Keys &amp; credentials</b>, add this Redirect URI exactly:
            <div className="note-box mono" style={{ marginTop: 6, fontSize: 12, wordBreak: "break-all" }}>{p.redirectUri}</div>
          </li>
          <li>Copy the Client ID and Client Secret into <span className="mono">.env</span> as <span className="mono">QBO_CLIENT_ID</span> and <span className="mono">QBO_CLIENT_SECRET</span>.</li>
          <li>Restart the app and click <b>Connect QuickBooks</b>. In sandbox, pick the free test company Intuit gives you.</li>
          <li>To go live: complete Intuit's production questionnaire, switch to production keys and set <span className="mono">QBO_ENV=&quot;production&quot;</span>.</li>
        </ol>
      </div>
    </div>
  );
}
