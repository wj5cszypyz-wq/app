import type { Metadata } from "next";
import Link from "next/link";
import { AuthFrame } from "@/components/auth-frame";
import { JsonForm } from "@/components/json-form";
import { SignOutButton } from "@/components/sign-out";
import { getSession } from "@/lib/auth";
import { inviteDetails } from "@/lib/data/invites";

export const metadata: Metadata = { title: "Accept invite" };

export default async function InvitePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const [invite, session] = await Promise.all([inviteDetails(token), getSession()]);
  const here = `/invite?token=${encodeURIComponent(token)}`;

  let body: React.ReactNode;
  if (!invite) {
    body = <div className="error-box">This invite has expired or was already used. Ask the store for a new one.</div>;
  } else if (session) {
    body = (
      <>
        <p className="muted" style={{ margin: 0 }}>This invite is for <b>{invite.email}</b>.</p>
        <JsonForm action="/api/invites/accept" submitLabel="Accept invite" fields={[]} extra={{ token }} />
        <div className="auth-links"><span className="muted">Not you?</span><SignOutButton /></div>
      </>
    );
  } else if (invite.hasAccount) {
    body = (
      <>
        <p className="muted" style={{ margin: 0 }}><b>{invite.email}</b> already has an account. Sign in to accept.</p>
        <Link className="btn btn-primary btn-lg btn-block" href={`/login?next=${encodeURIComponent(here)}`}>Sign in to accept</Link>
      </>
    );
  } else {
    body = (
      <>
        <p className="muted" style={{ margin: 0 }}>Create your login for <b>{invite.email}</b>.</p>
        <JsonForm
          action="/api/invites/accept"
          submitLabel="Create login and accept"
          extra={{ token }}
          fields={[
            { name: "name", label: "Your name", autoComplete: "name", maxLength: 120 },
            { name: "password", label: "Choose a password", type: "password", autoComplete: "new-password", hint: "At least 10 characters.", maxLength: 200 },
          ]}
        />
      </>
    );
  }

  return (
    <AuthFrame>
      <div className="stack" style={{ gap: 18 }}>
        <div>
          <h1>{invite ? `Join ${invite.storeName}` : "Invite"}</h1>
          {invite && (
            <p className="muted" style={{ margin: "6px 0 0" }}>
              {invite.role === "staff" ? "You've been invited to help run this store." : "You've been invited to order from this store."}
            </p>
          )}
        </div>
        {body}
      </div>
    </AuthFrame>
  );
}
