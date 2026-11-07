import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuthFrame } from "@/components/auth-frame";
import { JsonForm } from "@/components/json-form";
import { joinPageInfo } from "@/lib/data/requests";

export const metadata: Metadata = { title: "Request an account" };

export default async function JoinPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const info = await joinPageInfo(slug);
  if (!info) notFound();
  return (
    <AuthFrame>
      <div className="stack" style={{ gap: 22 }}>
        <div>
          <h1>Order from {info.storeName}</h1>
          <p className="muted" style={{ margin: "6px 0 0" }}>Ask for an account. If they approve, you&apos;ll get an email invite to sign in.</p>
        </div>
        <JsonForm
          action={`/api/join/${encodeURIComponent(slug)}`}
          submitLabel="Send request"
          fields={[
            { name: "businessName", label: "Business or your name", maxLength: 120 },
            { name: "contactName", label: "Contact name", autoComplete: "name", maxLength: 120 },
            { name: "email", label: "Email", type: "email", autoComplete: "email" },
            { name: "phone", label: "Phone (optional)", type: "tel", autoComplete: "tel", required: false, maxLength: 40 },
            { name: "message", label: "Anything they should know? (optional)", type: "textarea", required: false, maxLength: 1000 },
          ]}
        />
      </div>
    </AuthFrame>
  );
}
