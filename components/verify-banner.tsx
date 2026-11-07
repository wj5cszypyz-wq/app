"use client";
import { useState } from "react";

/** Shown to sellers until the owner confirms their email; customers can't order before then. */
export function VerifyBanner({ isOwner }: { isOwner: boolean }) {
  const [state, setState] = useState<"idle" | "sent" | "error">("idle");
  return (
    <div className="notice-bar" role="status">
      <span className="grow" style={{ minWidth: 200 }}>
        <b>Your store isn&apos;t open to customers yet.</b>{" "}
        {isOwner ? "Confirm your email to open it. You can set everything up in the meantime." : "The owner needs to confirm their email to open it."}
      </span>
      {isOwner &&
        (state === "sent" ? (
          <span className="muted">Sent. Check your inbox.</span>
        ) : (
          <button
            className="btn btn-sm"
            onClick={async () => {
              const res = await fetch("/api/auth/resend-verification", { method: "POST" });
              setState(res.ok ? "sent" : "error");
            }}
          >
            {state === "error" ? "Try again later" : "Send the email again"}
          </button>
        ))}
    </div>
  );
}
