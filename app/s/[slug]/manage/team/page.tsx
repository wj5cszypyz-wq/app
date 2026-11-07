import type { Metadata } from "next";
import { JsonForm } from "@/components/json-form";
import { listTeam } from "@/lib/data/invites";
import { MANAGE, requireStorePage } from "@/lib/scope";
import { RemoveStaff } from "./remove-staff";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const ctx = await requireStorePage((await params).slug, MANAGE);
  const team = await listTeam(ctx);
  const isOwner = ctx.role === "owner";

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Team</h1>
          <p>People who can see orders and manage products and customers. Only the owner can add or remove people and change QuickBooks.</p>
        </div>
      </div>
      <div className="detail-grid">
        <div className="panel">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Name</th><th>Role</th><th /></tr></thead>
              <tbody>
                {team.members.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{m.name}</div>
                      <div className="dim" style={{ fontSize: 11.5, overflowWrap: "anywhere" }}>{m.email}</div>
                    </td>
                    <td>{m.role === "owner" ? "Owner" : "Staff"}</td>
                    <td className="right">{isOwner && m.role === "staff" && <RemoveStaff userId={m.id} name={m.name} />}</td>
                  </tr>
                ))}
                {team.pending.map((p) => (
                  <tr key={p.email}>
                    <td><div className="dim" style={{ overflowWrap: "anywhere" }}>{p.email}</div></td>
                    <td className="muted">Invited</td>
                    <td />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {isOwner && (
          <div className="panel panel-pad stack">
            <h2>Invite someone</h2>
            <JsonForm
              action={`/api/s/${ctx.slug}/manage/staff`}
              submitLabel="Send invite"
              fields={[{ name: "email", label: "Their email", type: "email", autoComplete: "off" }]}
            />
          </div>
        )}
      </div>
    </>
  );
}
