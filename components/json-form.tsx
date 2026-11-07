"use client";
// A plain form that posts JSON to one of our API routes and shows the result.
// On success the route returns { redirect } (we go there) or { message } (we show it in place).
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { Spinner } from "./status";

export type Field = {
  name: string;
  label: string;
  type?: "text" | "email" | "password" | "tel" | "textarea";
  autoComplete?: string;
  required?: boolean;
  hint?: string;
  maxLength?: number;
  prefix?: string;
};

export function JsonForm(props: {
  action: string;
  method?: "POST" | "PUT" | "PATCH";
  fields: Field[];
  submitLabel: string;
  extra?: Record<string, unknown>;
  footer?: ReactNode;
  onSuccess?: (json: Record<string, unknown>) => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(props.action, {
        method: props.method ?? "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...props.extra, ...values }),
      });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Something went wrong. Please try again.");
      setValues((v) => Object.fromEntries(Object.entries(v).map(([k, val]) => [k, props.fields.find((f) => f.name === k)?.type === "password" ? "" : val])));
      props.onSuccess?.(json);
      if (typeof json.redirect === "string") {
        router.replace(json.redirect);
        router.refresh();
        return;
      }
      if (typeof json.message === "string") setMessage(json.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
    setBusy(false);
  }

  if (message) return <div className="note-box" role="status">{message}</div>;

  return (
    <form className="stack" onSubmit={submit} style={{ gap: 14 }}>
      {props.fields.map((f) => (
        <div className="field" key={f.name}>
          <label htmlFor={`f-${f.name}`}>{f.label}</label>
          {f.type === "textarea" ? (
            <textarea id={`f-${f.name}`} className="input" rows={3} maxLength={f.maxLength ?? 1000} required={f.required} value={values[f.name] ?? ""} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />
          ) : (
            <div className={f.prefix ? "input-prefix" : undefined}>
              {f.prefix && <span>{f.prefix}</span>}
              <input
                id={`f-${f.name}`}
                className="input"
                type={f.type ?? "text"}
                autoComplete={f.autoComplete}
                required={f.required ?? true}
                maxLength={f.maxLength ?? 254}
                value={values[f.name] ?? ""}
                onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
              />
            </div>
          )}
          {f.hint && <div className="dim" style={{ fontSize: 12 }}>{f.hint}</div>}
        </div>
      ))}
      {error && <div className="error-box" role="alert">{error}</div>}
      <button className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? <Spinner /> : props.submitLabel}</button>
      {props.footer}
    </form>
  );
}
