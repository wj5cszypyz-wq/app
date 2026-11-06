"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Spinner } from "@/components/status";

export function LoginForm({ next, demo }: { next: string; demo: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(url: string, body: object) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Sign-in failed.");
      setPassword("");
      router.replace(json.redirect);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    send("/api/auth/login", { email, password, next });
  }

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div>
        <h1>Sign in</h1>
        <p className="muted" style={{ margin: "6px 0 0" }}>For restaurants and suppliers.</p>
      </div>

      {demo && (
        <>
          <div className="demo-grid">
            <button className="demo" type="button" disabled={busy} onClick={() => send("/api/auth/demo", { role: "buyer" })}>
              <b>🍽️ Try as restaurant</b>
              <span>Juniper Bistro</span>
            </button>
            <button className="demo" type="button" disabled={busy} onClick={() => send("/api/auth/demo", { role: "supplier" })}>
              <b>🚚 Try as supplier</b>
              <span>Harbor Fresh</span>
            </button>
          </div>
          <div className="divider">or sign in with email</div>
        </>
      )}

      <form className="stack" onSubmit={onSubmit} style={{ gap: 14 }}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <div className="error-box" role="alert">{error}</div>}
        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
          {busy ? <Spinner /> : "Sign in"}
        </button>
      </form>
    </div>
  );
}
