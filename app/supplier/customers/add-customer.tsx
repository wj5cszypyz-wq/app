"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { IconPlus, IconX } from "@/components/icons";
import { Spinner } from "@/components/status";
import { useToast } from "@/components/toast";

const EMPTY = { name: "", contactName: "", email: "", phone: "", address: "", password: "" };

export function AddCustomer() {
  const router = useRouter();
  const notify = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [showPw, setShowPw] = useState(false);
  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/supplier/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return notify("error", "Couldn't add customer", json.error);
    notify("success", `${form.name} added`, `They can sign in with ${form.email}.`);
    setForm(EMPTY);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        <IconPlus /> Add customer
      </button>
    );
  }

  return (
    <form className="panel panel-pad stack" style={{ width: "100%" }} onSubmit={submit}>
      <div className="row-between">
        <h2>New restaurant</h2>
        <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label="Close" onClick={() => setOpen(false)}><IconX /></button>
      </div>
      <div className="grid-form">
        <div className="field"><label>Restaurant name</label><input className="input" required value={form.name} onChange={set("name")} /></div>
        <div className="field"><label>Contact name</label><input className="input" required value={form.contactName} onChange={set("contactName")} /></div>
        <div className="field"><label>Login email</label><input className="input" type="email" required value={form.email} onChange={set("email")} /></div>
        <div className="field"><label>Phone</label><input className="input" value={form.phone} onChange={set("phone")} /></div>
        <div className="field" style={{ gridColumn: "span 2" }}><label>Delivery address</label><input className="input" value={form.address} onChange={set("address")} /></div>
        <div className="field">
          <label>Temporary password (8+ characters)</label>
          <div className="row" style={{ gap: 6 }}>
            <input className="input" type={showPw ? "text" : "password"} minLength={8} maxLength={200} required value={form.password} onChange={set("password")} autoComplete="new-password" />
            <button type="button" className="btn btn-sm" onClick={() => setShowPw((v) => !v)}>{showPw ? "Hide" : "Show"}</button>
          </div>
        </div>
      </div>
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <span className="muted grow" style={{ fontSize: 12.5 }}>Give the restaurant this email and password. They'll see your catalog with their prices.</span>
        <button className="btn btn-primary" disabled={busy}>{busy ? <Spinner /> : "Create account"}</button>
      </div>
    </form>
  );
}
