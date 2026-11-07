import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { IconBack } from "@/components/icons";
import { JsonForm } from "@/components/json-form";
import { SignOutButton } from "@/components/sign-out";
import { getSession } from "@/lib/auth";
import { accountSummary } from "@/lib/data/account";

export const metadata: Metadata = { title: "Your account" };

export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const me = await accountSummary(session.userId);

  return (
    <div className="main" style={{ maxWidth: 720, margin: "0 auto" }}>
      <div className="row-between" style={{ marginBottom: 14 }}>
        <Link href="/" className="btn btn-ghost btn-sm" style={{ marginLeft: -10 }}><IconBack /> Back</Link>
        <SignOutButton />
      </div>
      <div className="page-head">
        <div>
          <h1>Your account</h1>
          <p style={{ overflowWrap: "anywhere" }}>{me.name} · {me.email}</p>
        </div>
      </div>

      <div className="stack">
        <section className="panel panel-pad stack">
          <h2>Change password</h2>
          <JsonForm
            action="/api/account/password"
            submitLabel="Change password"
            fields={[
              { name: "current", label: "Current password", type: "password", autoComplete: "current-password", maxLength: 200 },
              { name: "password", label: "New password", type: "password", autoComplete: "new-password", hint: "At least 10 characters. Other devices will be signed out.", maxLength: 200 },
            ]}
          />
        </section>

        <section className="panel panel-pad stack" id="two-step">
          <h2>Two-step sign-in</h2>
          <p className="muted" style={{ margin: 0 }}>
            {me.totpEnabledAt ? "On. You'll enter a code from your authenticator app when you sign in." : "Off."}
          </p>
        </section>

        <section className="panel panel-pad stack">
          <h2>Devices</h2>
          <p className="muted" style={{ margin: 0 }}>
            You&apos;re signed in on {me.sessions} {me.sessions === 1 ? "device" : "devices"}, including this one.
          </p>
          <JsonForm action="/api/account/sign-out-others" submitLabel="Sign out everywhere else" fields={[]} />
        </section>
      </div>
    </div>
  );
}
