"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { IconArrow, IconFile, IconLink, IconPrinter, IconSync } from "@/components/icons";
import { Spinner, SyncBadge } from "@/components/status";
import { useToast } from "@/components/toast";
import { nextStatus, STATUS_LABEL, type OrderStatus } from "@/lib/catalog";
import { useStorePaths } from "@/components/use-store";

type Sync = {
  status: string;
  docNumber: string | null;
  invoiceId: string | null;
  error: string | null;
  syncedAt: string | null;
  invoiceUrl: string | null;
};

const STEPS: OrderStatus[] = ["new", "packing", "ready", "delivered"];
const ACTION: Record<string, string> = { new: "Start packing", packing: "Mark ready", ready: "Mark delivered" };

export function OrderControls(props: { orderId: string; status: string; sync: Sync; connected: boolean }) {
  const router = useRouter();
  const paths = useStorePaths();
  const notify = useToast();
  const [status, setStatus] = useState(props.status);
  const [sync, setSync] = useState(props.sync);
  const [busy, setBusy] = useState<string | null>(null);

  // A brand-new order is still being sent to QuickBooks: keep checking for a few seconds.
  useEffect(() => {
    if (sync.status !== "pending") return;
    const t = setTimeout(() => router.refresh(), 2500);
    return () => clearTimeout(t);
  }, [sync.status, router]);
  useEffect(() => setSync(props.sync), [props.sync]);

  async function setOrderStatus(next: string) {
    setBusy(next);
    const res = await fetch(paths.api(`/manage/orders/${props.orderId}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setBusy(null);
    if (!res.ok) return notify("error", "Couldn't update the order", (await res.json()).error);
    setStatus(next);
    notify("success", `Order marked ${STATUS_LABEL[next as OrderStatus].toLowerCase()}`);
    router.refresh();
  }

  async function retrySync() {
    setBusy("sync");
    const res = await fetch(paths.api(`/manage/orders/${props.orderId}/sync`), { method: "POST" });
    const json = await res.json();
    setBusy(null);
    if (!res.ok) return notify("error", "Sync failed", json.error);
    if (json.qboSyncStatus === "synced") notify("success", "Invoice created in QuickBooks", json.qboDocNumber ?? undefined);
    else if (json.qboSyncStatus === "not_connected") notify("info", "QuickBooks isn't connected", "Connect it in Settings, then retry.");
    else notify("error", "QuickBooks rejected the invoice", json.qboError ?? undefined);
    router.refresh();
  }

  const current = STEPS.indexOf(status as OrderStatus);
  const next = nextStatus(status);
  const cancelled = status === "cancelled";

  return (
    <>
      <div className="panel panel-pad stack">
        <div className="row-between">
          <div className="eyebrow">Fulfillment</div>
          {!cancelled && status !== "delivered" && (
            <button className="btn btn-ghost btn-sm" disabled={busy !== null} onClick={() => setOrderStatus("cancelled")}>
              Cancel order
            </button>
          )}
        </div>
        {cancelled ? (
          <div className="note-box">
            This order was cancelled.{" "}
            <button className="btn btn-sm" style={{ marginLeft: 8 }} disabled={busy !== null} onClick={() => setOrderStatus("new")}>
              Reopen
            </button>
          </div>
        ) : (
          <div className="pipeline">
            {STEPS.map((st, i) => (
              <div key={st} className={`step ${i < current ? "done" : i === current ? "current" : ""}`}>
                <div className="eyebrow">{i < current ? "Done" : i === current ? "Now" : `Step ${i + 1}`}</div>
                <b>{STATUS_LABEL[st]}</b>
              </div>
            ))}
          </div>
        )}
        {next && !cancelled && (
          <button className="btn btn-primary btn-lg btn-block" disabled={busy !== null} onClick={() => setOrderStatus(next)}>
            {busy === next ? <Spinner /> : <>{ACTION[status]} <IconArrow /></>}
          </button>
        )}
        <div className="row">
          <Link className="btn grow" href={paths.shop(`/print/${props.orderId}?doc=packing`)} target="_blank">
            <IconPrinter /> Packing slip
          </Link>
          <Link className="btn grow" href={paths.shop(`/print/${props.orderId}?doc=invoice`)} target="_blank">
            <IconPrinter /> Invoice
          </Link>
        </div>
      </div>

      <div className={`panel panel-pad stack qbo-card ${sync.status}`}>
        <div className="row-between">
          <div className="eyebrow">QuickBooks invoice</div>
          <SyncBadge status={sync.status} />
        </div>

        {sync.status === "synced" && (
          <>
            <div>
              <div className="qbo-doc">{sync.docNumber ?? `ID ${sync.invoiceId}`}</div>
              <div className="muted" style={{ fontSize: 12.5 }}>
                Created {sync.syncedAt ? new Date(sync.syncedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : ""}
              </div>
            </div>
            <div className="row">
              {sync.invoiceUrl && (
                <a className="btn grow" href={sync.invoiceUrl} target="_blank" rel="noreferrer">
                  <IconLink /> Open in QuickBooks
                </a>
              )}
              <a className="btn grow" href={paths.api(`/manage/orders/${props.orderId}/invoice-pdf`)} target="_blank" rel="noreferrer">
                <IconFile /> QuickBooks PDF
              </a>
            </div>
          </>
        )}

        {sync.status === "pending" && <div className="muted">Sending this order to QuickBooks…</div>}

        {sync.status === "failed" && (
          <>
            <div className="error-box">{sync.error ?? "QuickBooks returned an error."}</div>
            <button className="btn btn-primary btn-block" disabled={busy !== null} onClick={retrySync}>
              {busy === "sync" ? <Spinner /> : <><IconSync /> Retry sync</>}
            </button>
          </>
        )}

        {sync.status === "not_connected" && (
          <>
            <div className="muted" style={{ fontSize: 13 }}>
              {props.connected
                ? "QuickBooks is connected now. Send this order across."
                : "Connect QuickBooks once and every order becomes an invoice automatically."}
            </div>
            {props.connected ? (
              <button className="btn btn-primary btn-block" disabled={busy !== null} onClick={retrySync}>
                {busy === "sync" ? <Spinner /> : <><IconSync /> Send to QuickBooks</>}
              </button>
            ) : (
              <Link className="btn btn-primary btn-block" href={paths.manage("/settings")}>
                <IconLink /> Connect QuickBooks
              </Link>
            )}
          </>
        )}
      </div>
    </>
  );
}
