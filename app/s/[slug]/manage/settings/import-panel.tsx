"use client";
// "Bring in from QuickBooks": preview items or customers, tick what to bring in, undo any run.
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Spinner } from "@/components/status";
import { useToast } from "@/components/toast";
import { useStorePaths } from "@/components/use-store";

type Row = { qboId: string; name: string; detail: string; status: "new" | "match" | "linked" };
type Batch = { id: string; kind: string; createdAt: string; undone: boolean; created: number; updated: number };

const STATUS = { new: "New", match: "Will link to your product", linked: "Already linked (will update)" } as const;
const KIND = { items: "Items", customers: "Customers", invoices: "Past invoices" } as const;

export function ImportPanel({ recent, connected }: { recent: Batch[]; connected: boolean }) {
  const router = useRouter();
  const paths = useStorePaths();
  const notify = useToast();
  const [kind, setKind] = useState<"items" | "customers" | "invoices">("items");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [since, setSince] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().slice(0, 10);
  });

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => !needle || `${r.name} ${r.detail}`.toLowerCase().includes(needle));
  }, [rows, q]);

  async function call(url: string, init?: RequestInit) {
    const res = await fetch(url, init);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? "QuickBooks didn't answer. Try again.");
    return json;
  }

  async function preview(k: "items" | "customers") {
    setBusy("preview");
    try {
      const json = await call(paths.api(`/manage/qbo/import?kind=${k}`));
      setRows(json.rows);
      setPicked(new Set((json.rows as Row[]).filter((r) => r.status !== "linked").map((r) => r.qboId)));
    } catch (e) {
      notify("error", "Couldn't load from QuickBooks", e instanceof Error ? e.message : undefined);
    }
    setBusy(null);
  }

  async function bringIn() {
    setBusy("import");
    try {
      const body = kind === "invoices" ? { kind, since } : { kind, ids: [...picked] };
      const r = await call(paths.api("/manage/qbo/import"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      notify("success", "Brought in from QuickBooks", [r.created && `${r.created} new`, r.linked && `${r.linked} linked`, r.updated && `${r.updated} updated`].filter(Boolean).join(", ") || "Nothing new");
      setRows(null);
      router.refresh();
    } catch (e) {
      notify("error", "Import failed", e instanceof Error ? e.message : undefined);
    }
    setBusy(null);
  }

  async function undo(id: string) {
    if (!confirm("Undo this import? Things it added are removed (or hidden if already ordered), and changes are put back. Nothing changes in QuickBooks.")) return;
    setBusy(id);
    try {
      await call(paths.api(`/manage/qbo/import/${id}/undo`), { method: "POST" });
      notify("success", "Import undone");
      router.refresh();
    } catch (e) {
      notify("error", "Couldn't undo", e instanceof Error ? e.message : undefined);
    }
    setBusy(null);
  }

  if (!connected) return null;
  const allShownPicked = shown.length > 0 && shown.every((r) => picked.has(r.qboId));

  return (
    <div className="panel panel-pad stack" style={{ marginTop: 16 }}>
      <div>
        <h2>Bring in from QuickBooks</h2>
        <p className="muted" style={{ margin: "4px 0 0" }}>Start your store from what&apos;s already in QuickBooks. You&apos;ll see a preview first, and you can undo any import.</p>
      </div>
      <div className="seg" role="tablist">
        {(["items", "customers", "invoices"] as const).map((k) => (
          <button key={k} role="tab" aria-selected={kind === k} className={kind === k ? "on" : ""} onClick={() => { setKind(k); setRows(null); }}>{KIND[k]}</button>
        ))}
      </div>

      {kind === "invoices" ? (
        <div className="stack" style={{ gap: 10 }}>
          <p className="muted" style={{ margin: 0 }}>Optional. Past invoices for customers already in your store appear in their order history (read-only, with a Reorder button). Bring in customers first.</p>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <label htmlFor="since" className="muted" style={{ fontSize: 13 }}>Invoices since</label>
            <input id="since" className="input" type="date" style={{ width: 180 }} value={since} onChange={(e) => setSince(e.target.value)} />
            <button className="btn btn-primary" disabled={busy === "import"} onClick={bringIn}>{busy === "import" ? <Spinner /> : "Bring in past invoices"}</button>
          </div>
        </div>
      ) : rows === null ? (
        <button className="btn" style={{ alignSelf: "flex-start" }} disabled={busy === "preview"} onClick={() => preview(kind)}>
          {busy === "preview" ? <Spinner /> : `Preview ${KIND[kind].toLowerCase()} in QuickBooks`}
        </button>
      ) : (
        <>
          <div className="row-between" style={{ flexWrap: "wrap" }}>
            <input className="input" style={{ maxWidth: 320 }} placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
            <span className="muted" style={{ fontSize: 13 }}>{picked.size} of {rows.length} selected</span>
          </div>
          <div className="table-wrap import-table">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input type="checkbox" aria-label="Select all shown" checked={allShownPicked} onChange={(e) => setPicked((p) => { const n = new Set(p); shown.forEach((r) => (e.target.checked ? n.add(r.qboId) : n.delete(r.qboId))); return n; })} />
                  </th>
                  <th>Name</th>
                  <th className="hide-sm">Details</th>
                  <th>What happens</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.qboId}>
                    <td><input type="checkbox" aria-label={`Bring in ${r.name}`} checked={picked.has(r.qboId)} onChange={(e) => setPicked((p) => { const n = new Set(p); if (e.target.checked) n.add(r.qboId); else n.delete(r.qboId); return n; })} /></td>
                    <td style={{ fontWeight: 550, overflowWrap: "anywhere" }}>{r.name}</td>
                    <td className="hide-sm muted" style={{ overflowWrap: "anywhere" }}>{r.detail}</td>
                    <td className="muted" style={{ fontSize: 12.5 }}>{STATUS[r.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <div className="empty"><h3>Nothing found</h3><p>QuickBooks has no {KIND[kind].toLowerCase()} to bring in.</p></div>}
          </div>
          <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
            <button className="btn" onClick={() => setRows(null)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy === "import" || picked.size === 0} onClick={bringIn}>{busy === "import" ? <Spinner /> : `Bring in ${picked.size}`}</button>
          </div>
        </>
      )}

      {recent.length > 0 && (
        <div className="stack" style={{ gap: 6 }}>
          <div className="eyebrow">Recent imports</div>
          {recent.map((b) => (
            <div key={b.id} className="row-between" style={{ fontSize: 13.5, flexWrap: "wrap" }}>
              <span>
                {KIND[b.kind as keyof typeof KIND] ?? b.kind} · {new Date(b.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} · {b.created} added, {b.updated} changed
              </span>
              {b.undone ? <span className="dim">Undone</span> : <button className="btn btn-sm" disabled={busy === b.id} onClick={() => undo(b.id)}>Undo</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
