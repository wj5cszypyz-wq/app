"use client";

import { useRouter } from "next/navigation";
import { IconLogout } from "./icons";

/** Ends the session on the server and wipes anything this app saved in the browser. */
export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      className="btn btn-ghost btn-sm btn-icon"
      title="Sign out"
      aria-label="Sign out"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        try {
          Object.keys(localStorage)
            .filter((k) => k.startsWith("reorderpal_"))
            .forEach((k) => localStorage.removeItem(k));
        } catch {
          // storage blocked: nothing to clear
        }
        router.replace("/login");
        router.refresh();
      }}
    >
      <IconLogout />
    </button>
  );
}
