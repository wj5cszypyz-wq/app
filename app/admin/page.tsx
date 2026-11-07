import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listAllStores } from "@/lib/data/admin";
import { StoreStatusButton } from "./status-button";

export const metadata: Metadata = { title: "Admin" };

const LABEL: Record<string, string> = { active: "Open", unverified: "Email not confirmed", suspended: "Suspended" };

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.isPlatformAdmin) notFound();
  const stores = await listAllStores();

  return (
    <div className="main" style={{ maxWidth: 1000, margin: "0 auto" }}>
      <div className="page-head">
        <div>
          <h1>All stores</h1>
          <p>{stores.length} stores. You can suspend a store; you can&apos;t see its orders or customers.</p>
        </div>
      </div>
      <div className="panel">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Store</th><th className="hide-sm">Owner</th><th className="hide-sm">Opened</th><th>Status</th><th /></tr></thead>
            <tbody>
              {stores.map((s) => (
                <tr key={s.id}>
                  <td><div style={{ fontWeight: 600, overflowWrap: "anywhere" }}>{s.name}</div><div className="dim mono" style={{ fontSize: 11.5 }}>/s/{s.slug}</div></td>
                  <td className="hide-sm" style={{ overflowWrap: "anywhere" }}>{s.ownerEmail ?? "—"}</td>
                  <td className="hide-sm muted">{s.createdAt.toLocaleDateString(undefined, { dateStyle: "medium" })}</td>
                  <td>{LABEL[s.status] ?? s.status}</td>
                  <td className="right"><StoreStatusButton id={s.id} name={s.name} suspended={s.status === "suspended"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
