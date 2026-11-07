import type { Metadata } from "next";
import Link from "next/link";
import { AuthFrame } from "@/components/auth-frame";
import { JsonForm } from "@/components/json-form";

export const metadata: Metadata = { title: "Open a store" };

export default function SignupPage() {
  return (
    <AuthFrame>
      <div className="stack" style={{ gap: 22 }}>
        <div>
          <h1>Open your store</h1>
          <p className="muted" style={{ margin: "6px 0 0" }}>Free to set up. Your customers order from their phone; every order becomes a QuickBooks invoice.</p>
        </div>
        <JsonForm
          action="/api/auth/signup"
          submitLabel="Create my store"
          fields={[
            { name: "name", label: "Your name", autoComplete: "name", maxLength: 120 },
            { name: "email", label: "Email", type: "email", autoComplete: "email" },
            { name: "password", label: "Password", type: "password", autoComplete: "new-password", hint: "At least 10 characters.", maxLength: 200 },
            { name: "storeName", label: "Store name", maxLength: 120, hint: "What your customers will see, e.g. Brightline Lamps." },
            { name: "slug", label: "Store web address", prefix: "/s/", maxLength: 48, hint: "Letters, numbers and dashes, e.g. brightline-lamps." },
          ]}
          footer={<div className="auth-links"><span className="muted">Already have an account?</span><Link href="/login">Sign in</Link></div>}
        />
      </div>
    </AuthFrame>
  );
}
