import type { Metadata } from "next";
import { listHistory } from "@/lib/data/history";
import { MANAGE, requireStorePage } from "@/lib/scope";
import { UndoButton } from "./undo-button";

export const metadata: Metadata = { title: "History" };

export default async function HistoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const ctx = await requireStorePage((await params).slug, MANAGE);
  const rows = await listHistory(ctx);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>History</h1>
          <p>Every change to products, special prices and store settings. Undo anything here; an undo can be undone too.</p>
        </div>
      </div>
      <div className="panel">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Change</th><th className="hide-sm">Who</th><th className="hide-sm">When</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ overflowWrap: "anywhere" }}>
                    <div style={{ fontWeight: 550 }}>{r.summary}</div>
                    <div className="dim show-sm" style={{ fontSize: 11.5 }}>{r.userName} · {r.createdAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</div>
                  </td>
                  <td className="hide-sm muted">{r.userName}</td>
                  <td className="hide-sm muted">{r.createdAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</td>
                  <td className="right">
                    {r.undoneAt ? (
                      <span className="dim" style={{ fontSize: 12.5 }}>{r.action === "undo" ? "Redone" : "Undone"}</span>
                    ) : r.entity === "store" && ctx.role !== "owner" ? null : (
                      <UndoButton id={r.id} label={r.action === "undo" ? "Redo" : "Undo"} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <div className="empty"><h3>No changes yet</h3><p>Changes to products, prices and settings show up here.</p></div>}
        </div>
      </div>
    </>
  );
}
