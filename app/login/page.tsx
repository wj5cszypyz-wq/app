import type { Metadata } from "next";
import { AuthFrame } from "@/components/auth-frame";
import { demoEnabled } from "@/lib/demo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <AuthFrame>
      <LoginForm next={next ?? ""} demo={demoEnabled()} />
    </AuthFrame>
  );
}
