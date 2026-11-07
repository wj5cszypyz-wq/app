"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Spinner } from "@/components/status";

type Setup = { secret: string; qrSvg: string };

async function post(body: object) {
  const res = await fetch("/api/account/two-step", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Something went wrong.");
  return json;
}

/** Turn two-step sign-in on (scan, confirm, save recovery codes) or off. */
export function TwoStep({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
    setBusy(false);
  }

  if (codes) {
    return (
      <div className="stack" style={{ gap: 12 }}>
        <div className="note-box">Two-step sign-in is on. Save these recovery codes somewhere safe. Each works once if you lose your phone. They won&apos;t be shown again.</div>
        <div className="recovery-grid mono">{codes.map((c) => <span key={c}>{c}</span>)}</div>
        <button className="btn" onClick={() => { setCodes(null); router.refresh(); }}>I&apos;ve saved them</button>
      </div>
    );
  }

  const codeField = (
    <div className="field">
      <label htmlFor="ts-code">6-digit code from your app</label>
      <input id="ts-code" className="input" inputMode="numeric" autoComplete="one-time-code" maxLength={20} value={code} onChange={(e) => setCode(e.target.value)} />
    </div>
  );

  if (enabled) {
    return (
      <form className="stack" style={{ gap: 12 }} onSubmit={(e) => { e.preventDefault(); run(async () => { await post({ action: "disable", code }); setCode(""); router.refresh(); }); }}>
        <p className="muted" style={{ margin: 0 }}>On. You&apos;ll enter a code from your authenticator app when you sign in.</p>
        {codeField}
        {error && <div className="error-box" role="alert">{error}</div>}
        <button className="btn btn-danger" disabled={busy}>{busy ? <Spinner /> : "Turn off two-step sign-in"}</button>
      </form>
    );
  }

  if (!setup) {
    return (
      <div className="stack" style={{ gap: 12 }}>
        <p className="muted" style={{ margin: 0 }}>Off. Turn it on so a stolen password alone can&apos;t open your account. You&apos;ll need an authenticator app such as Google Authenticator, 1Password or Authy.</p>
        {error && <div className="error-box" role="alert">{error}</div>}
        <button className="btn btn-primary" disabled={busy} onClick={() => run(async () => setSetup(await post({ action: "start" })))}>
          {busy ? <Spinner /> : "Turn on two-step sign-in"}
        </button>
      </div>
    );
  }

  return (
    <form className="stack" style={{ gap: 12 }} onSubmit={(e) => { e.preventDefault(); run(async () => { const r = await post({ action: "enable", code }); setCodes(r.recoveryCodes); setSetup(null); setCode(""); }); }}>
      <p className="muted" style={{ margin: 0 }}>1. Scan this with your authenticator app (or type the key).</p>
      <div className="qr-box" dangerouslySetInnerHTML={{ __html: setup.qrSvg }} />
      <div className="mono" style={{ fontSize: 12.5, overflowWrap: "anywhere" }}>{setup.secret.replace(/(.{4})/g, "$1 ").trim()}</div>
      <p className="muted" style={{ margin: 0 }}>2. Enter the code it shows.</p>
      {codeField}
      {error && <div className="error-box" role="alert">{error}</div>}
      <button className="btn btn-primary" disabled={busy}>{busy ? <Spinner /> : "Confirm and turn on"}</button>
    </form>
  );
}
