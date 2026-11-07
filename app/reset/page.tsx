import type { Metadata } from "next";
import Link from "next/link";
import { AuthFrame } from "@/components/auth-frame";
import { JsonForm } from "@/components/json-form";
import { peekToken } from "@/lib/tokens";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const row = await peekToken(token, "reset_password");
  return (
    <AuthFrame>
      <div className="stack" style={{ gap: 22 }}>
        <h1>Choose a new password</h1>
        {row ? (
          <JsonForm
            action="/api/auth/reset"
            submitLabel="Save new password"
            extra={{ token }}
            fields={[{ name: "password", label: "New password", type: "password", autoComplete: "new-password", hint: "At least 10 characters.", maxLength: 200 }]}
            footer={<div className="auth-links"><Link href="/login">Go to sign in</Link></div>}
          />
        ) : (
          <>
            <div className="error-box">This link has expired or was already used.</div>
            <Link className="btn btn-block" href="/forgot">Send a new link</Link>
          </>
        )}
      </div>
    </AuthFrame>
  );
}
