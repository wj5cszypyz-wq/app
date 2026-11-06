import type { Metadata } from "next";
import { IconMark } from "@/components/icons";
import { APP_NAME } from "@/lib/brand";
import { demoEnabled } from "@/lib/demo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="auth">
      <section className="auth-hero">
        <div className="brand" style={{ padding: 0 }}>
          <span className="brand-mark"><IconMark /></span>
          <span className="brand-name">{APP_NAME}</span>
        </div>

        <div>
          <div className="produce-row" aria-hidden>🥬🍅🧀🥩🍞</div>
          <h1 style={{ marginTop: 14 }}>Order your kitchen supplies in minutes.</h1>
          <p>Produce, dairy, meat and everyday supplies from your wholesaler, with your prices. No phone calls, no texts.</p>
          <div className="steps">
            <div><span>1</span>Pick what you need</div>
            <div><span>2</span>Place the order</div>
            <div><span>3</span>Your supplier gets it instantly, with the invoice ready</div>
          </div>
        </div>

        <div style={{ fontSize: 13, opacity: 0.75 }}>© {new Date().getFullYear()} {APP_NAME}</div>
      </section>

      <section className="auth-form">
        <div className="auth-card">
          <LoginForm next={next ?? ""} demo={demoEnabled()} />
        </div>
      </section>
    </div>
  );
}
