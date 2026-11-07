import type { Metadata } from "next";
import Link from "next/link";
import { AuthFrame } from "@/components/auth-frame";
import { JsonForm } from "@/components/json-form";
import { peekToken } from "@/lib/tokens";

export const metadata: Metadata = { title: "Confirm your email" };

// The link only shows a button; confirming happens on click, so email scanners that open links can't use it up.
export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const row = await peekToken(token, "verify_email");
  return (
    <AuthFrame>
      <div className="stack" style={{ gap: 18 }}>
        <h1>Confirm your email</h1>
        {row ? (
          <>
            <p className="muted" style={{ margin: 0 }}>Confirm <b>{row.email}</b> to open your store to customers.</p>
            <JsonForm action="/api/auth/verify" submitLabel="Confirm my email" fields={[]} extra={{ token }} />
          </>
        ) : (
          <>
            <div className="error-box">This link has expired or was already used.</div>
            <Link className="btn btn-block" href="/login">Sign in to send a new one</Link>
          </>
        )}
      </div>
    </AuthFrame>
  );
}
