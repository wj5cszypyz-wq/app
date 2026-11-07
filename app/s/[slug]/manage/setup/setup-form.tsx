"use client";
// The setup questions. Each section saves on its own; everything can be changed later here.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { StoreMark } from "@/components/store-look";
import { Spinner } from "@/components/status";
import { useToast } from "@/components/toast";
import { useStorePaths } from "@/components/use-store";
import { KIND_ORDER, UNIT_KINDS } from "@/lib/units";
import { uploadImage } from "../catalog/photo-picker";

type Profile = {
  name: string; niche: string; about: string; phone: string; email: string; address: string;
  look: string; accent: string | null; logoId: string | null; bannerId: string | null;
  fulfillment: string; unitKinds: string[]; done: boolean;
};

const LOOKS = [
  { id: "fresh", name: "Fresh market", colors: ["#f6f4ee", "#ffffff", "#2e7d4a"] },
  { id: "clean", name: "Clean", colors: ["#f6f6f6", "#ffffff", "#2f3437"] },
  { id: "craft", name: "Warm craft", colors: ["#f7f0e6", "#fffdf9", "#a84d26"] },
  { id: "classic", name: "Classic", colors: ["#f3f5f9", "#ffffff", "#1f3a68"] },
];

function Section(props: { n: number; title: string; done?: boolean; children: ReactNode }) {
  return (
    <section className="panel panel-pad stack setup-step">
      <div className="row" style={{ gap: 12 }}>
        <span className={`step-num ${props.done ? "done" : ""}`}>{props.done ? "✓" : props.n}</span>
        <h2>{props.title}</h2>
      </div>
      {props.children}
    </section>
  );
}

export function SetupForm({ profile, counts, isOwner }: { profile: Profile; counts: { products: number; customers: number; qbo: boolean }; isOwner: boolean }) {
  const router = useRouter();
  const paths = useStorePaths();
  const notify = useToast();
  const [p, setP] = useState(profile);
  const [saving, setSaving] = useState<string | null>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((x) => ({ ...x, [k]: v }));

  async function save(section: string, body: Record<string, unknown>, okText = "Saved") {
    setSaving(section);
    const res = await fetch(paths.api("/manage/store"), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    setSaving(null);
    if (!res.ok) return notify("error", "Couldn't save", json.error);
    notify("success", okText, json.accentAdjusted ? "We darkened your color a little so text on it stays easy to read." : undefined);
    router.refresh();
  }

  async function uploadTo(kind: "logo" | "banner", file: File | undefined) {
    if (!file) return;
    setSaving(kind);
    try {
      const id = await uploadImage(paths.api, file, kind);
      set(kind === "logo" ? "logoId" : "bannerId", id);
      await save(kind, { [kind === "logo" ? "logoId" : "bannerId"]: id }, kind === "logo" ? "Logo saved" : "Banner saved");
    } catch (e) {
      notify("error", "Upload failed", e instanceof Error ? e.message : undefined);
    }
    setSaving(null);
  }

  const disabled = !isOwner;
  const btn = (section: string, label = "Save") => (
    <div className="row" style={{ justifyContent: "flex-end" }}>
      <button className="btn btn-primary" disabled={disabled || saving === section}>{saving === section ? <Spinner /> : label}</button>
    </div>
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Store setup</h1>
          <p>{isOwner ? "Answer these once. You can change anything here later." : "Only the store owner can change these settings."}</p>
        </div>
      </div>

      <div className="stack" style={{ gap: 16, maxWidth: 820 }}>
        <Section n={1} title="Your store" done={Boolean(p.niche)}>
          <form className="stack" onSubmit={(e) => { e.preventDefault(); save("basics", { name: p.name, niche: p.niche, about: p.about, phone: p.phone, email: p.email, address: p.address, fulfillment: p.fulfillment }); }}>
            <fieldset disabled={disabled} className="grid-form plain-fieldset">
              <div className="field span-2"><label htmlFor="s-name">Store name</label><input id="s-name" className="input" required maxLength={120} value={p.name} onChange={(e) => set("name", e.target.value)} /></div>
              <div className="field span-3"><label htmlFor="s-niche">What do you sell?</label><input id="s-niche" className="input" maxLength={200} placeholder="e.g. fresh produce for restaurants, hand-made lamps, office paper" value={p.niche} onChange={(e) => set("niche", e.target.value)} /></div>
              <div className="field span-3"><label htmlFor="s-about">A line for your customers (optional)</label><textarea id="s-about" className="input" rows={2} maxLength={1000} value={p.about} onChange={(e) => set("about", e.target.value)} /></div>
              <div className="field"><label htmlFor="s-phone">Phone</label><input id="s-phone" className="input" maxLength={40} value={p.phone} onChange={(e) => set("phone", e.target.value)} /></div>
              <div className="field"><label htmlFor="s-email">Email for orders</label><input id="s-email" className="input" type="email" maxLength={254} value={p.email} onChange={(e) => set("email", e.target.value)} /></div>
              <div className="field span-3"><label htmlFor="s-address">Address (printed on invoices)</label><input id="s-address" className="input" maxLength={300} value={p.address} onChange={(e) => set("address", e.target.value)} /></div>
              <div className="field span-3">
                <label>How do customers get their orders?</label>
                <div className="choice-row">
                  {[["delivery", "We deliver"], ["pickup", "They pick up"], ["both", "Both"]].map(([v, l]) => (
                    <label key={v} className={`choice ${p.fulfillment === v ? "on" : ""}`}>
                      <input type="radio" name="fulfillment" value={v} checked={p.fulfillment === v} onChange={() => set("fulfillment", v)} />
                      {l}
                    </label>
                  ))}
                </div>
              </div>
            </fieldset>
            {btn("basics")}
          </form>
        </Section>

        <Section n={2} title="How it looks" done={Boolean(p.logoId) || p.look !== "fresh" || Boolean(p.accent)}>
          <fieldset disabled={disabled} className="stack plain-fieldset" style={{ gap: 14 }}>
            <div className="look-grid">
              {LOOKS.map((l) => (
                <button type="button" key={l.id} className={`look-card ${p.look === l.id ? "on" : ""}`} onClick={() => { set("look", l.id); save("look", { look: l.id }, `Look: ${l.name}`); }}>
                  <span className="look-swatch" aria-hidden>{l.colors.map((c) => <i key={c} style={{ background: c }} />)}</span>
                  <span>{l.name}</span>
                </button>
              ))}
            </div>
            <div className="row" style={{ flexWrap: "wrap", gap: 12 }}>
              <label className="row" style={{ gap: 8 }}>
                <input type="color" value={p.accent ?? "#2e7d4a"} onChange={(e) => set("accent", e.target.value)} aria-label="Accent color" className="color-input" />
                <span className="muted" style={{ fontSize: 13 }}>Button color</span>
              </label>
              <button type="button" className="btn btn-sm" onClick={() => save("accent", { accent: p.accent })}>Use this color</button>
              {p.accent && <button type="button" className="btn btn-sm btn-ghost" onClick={() => { set("accent", null); save("accent", { accent: null }, "Using the look's color"); }}>Use the look&apos;s color</button>}
            </div>
            <div className="row" style={{ flexWrap: "wrap", gap: 16 }}>
              <div className="row" style={{ gap: 10 }}>
                <StoreMark name={p.name} logoId={p.logoId} size={48} />
                <button type="button" className="btn btn-sm" onClick={() => logoInput.current?.click()}>{saving === "logo" ? <Spinner /> : p.logoId ? "Change logo" : "Upload logo"}</button>
                {p.logoId && <button type="button" className="btn btn-sm btn-ghost" onClick={() => { set("logoId", null); save("logo", { logoId: null }, "Logo removed"); }}>Remove</button>}
              </div>
              <div className="row" style={{ gap: 10 }}>
                <button type="button" className="btn btn-sm" onClick={() => bannerInput.current?.click()}>{saving === "banner" ? <Spinner /> : p.bannerId ? "Change banner photo" : "Add a banner photo"}</button>
                {p.bannerId && <button type="button" className="btn btn-sm btn-ghost" onClick={() => { set("bannerId", null); save("banner", { bannerId: null }, "Banner removed"); }}>Remove</button>}
              </div>
            </div>
            {p.bannerId && (
              // eslint-disable-next-line @next/next/no-img-element -- served by our access-checked route
              <img className="banner-preview" src={`/api/files/${p.bannerId}`} alt="Banner preview" />
            )}
            <input ref={logoInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => uploadTo("logo", e.target.files?.[0])} />
            <input ref={bannerInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => uploadTo("banner", e.target.files?.[0])} />
          </fieldset>
        </Section>

        <Section n={3} title="What you sell by" done={p.unitKinds.length > 0}>
          <form className="stack" onSubmit={(e) => { e.preventDefault(); save("units", { unitKinds: p.unitKinds }); }}>
            <p className="muted" style={{ margin: 0 }}>Pick everything that applies. New products start with the first one; every unit stays available.</p>
            <fieldset disabled={disabled} className="kind-grid plain-fieldset">
              {KIND_ORDER.map((k) => (
                <label key={k} className={`choice ${p.unitKinds.includes(k) ? "on" : ""}`}>
                  <input type="checkbox" checked={p.unitKinds.includes(k)} onChange={(e) => set("unitKinds", e.target.checked ? [...p.unitKinds, k] : p.unitKinds.filter((x) => x !== k))} />
                  <span><b>{UNIT_KINDS[k].label}</b><br /><span className="dim" style={{ fontSize: 12 }}>{UNIT_KINDS[k].units.join(", ")}</span></span>
                </label>
              ))}
            </fieldset>
            {btn("units")}
          </form>
        </Section>

        <Section n={4} title="Connect QuickBooks" done={counts.qbo}>
          <p className="muted" style={{ margin: 0 }}>{counts.qbo ? "Connected. Every order becomes an invoice." : "Optional, but it's what saves the most time: every order becomes a QuickBooks invoice."}</p>
          <Link className="btn" href={paths.manage("/settings")} style={{ alignSelf: "flex-start" }}>{counts.qbo ? "QuickBooks settings" : "Connect QuickBooks"}</Link>
        </Section>

        <Section n={5} title="Add your products" done={counts.products > 0}>
          <p className="muted" style={{ margin: 0 }}>{counts.products ? `${counts.products} products so far.` : "Add what you sell, with photos, units and prices."}</p>
          <Link className="btn" href={paths.manage("/catalog")} style={{ alignSelf: "flex-start" }}>Go to products</Link>
        </Section>

        <Section n={6} title="Invite your customers" done={counts.customers > 0}>
          <p className="muted" style={{ margin: 0 }}>{counts.customers ? `${counts.customers} customers so far.` : "Add customers and we email them an invite. You can also let new customers ask for an account."}</p>
          <Link className="btn" href={paths.manage("/customers")} style={{ alignSelf: "flex-start" }}>Go to customers</Link>
        </Section>

        {isOwner && !p.done && (
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn btn-primary btn-lg" disabled={saving === "done"} onClick={() => { set("done", true); save("done", { setupDone: true }, "Setup finished"); }}>
              I&apos;m done setting up
            </button>
          </div>
        )}
      </div>
    </>
  );
}
