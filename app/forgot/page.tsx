import type { Metadata } from "next";
import Link from "next/link";
import { AuthFrame } from "@/components/auth-frame";
import { JsonForm } from "@/components/json-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPage() {
  return (
    <AuthFrame>
      <div className="stack" style={{ gap: 22 }}>
        <div>
          <h1>Forgot your password?</h1>
          <p className="muted" style={{ margin: "6px 0 0" }}>Enter your email and we&apos;ll send you a link to choose a new one.</p>
        </div>
        <JsonForm
          action="/api/auth/forgot"
          submitLabel="Send reset link"
          fields={[{ name: "email", label: "Email", type: "email", autoComplete: "email" }]}
          footer={<div className="auth-links"><Link href="/login">Back to sign in</Link></div>}
        />
      </div>
    </AuthFrame>
  );
}
