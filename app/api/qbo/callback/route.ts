import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { completeConnection } from "@/lib/qbo";
import { resolveMembership } from "@/lib/scope";

// Step 2 of connecting: Intuit sends the owner back here (one fixed address, as Intuit requires).
// The store comes from the state cookie set in step 1 and is re-checked: only that store's owner
// can finish connecting it.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.url));

  const jar = await cookies();
  const cookie = jar.get("qbo_state")?.value ?? "";
  jar.delete({ name: "qbo_state", path: "/api/qbo" });

  const dot = cookie.lastIndexOf(".");
  const expected = dot > 0 ? cookie.slice(0, dot) : "";
  const slug = dot > 0 ? cookie.slice(dot + 1) : "";
  const ctx = slug ? await resolveMembership(session.userId, slug) : null;
  if (!ctx || ctx.role !== "owner") return NextResponse.redirect(new URL("/stores?qbo=invalid", req.url));

  const back = (result: string) => NextResponse.redirect(new URL(`/s/${ctx.slug}/manage/settings?qbo=${result}`, req.url));
  if (url.searchParams.get("error")) return back("denied");

  const code = url.searchParams.get("code");
  const realmId = url.searchParams.get("realmId");
  const state = url.searchParams.get("state") ?? "";
  const same =
    expected.length > 0 &&
    state.length === expected.length &&
    timingSafeEqual(Buffer.from(state), Buffer.from(expected));
  if (!code || !realmId || !/^\d{1,30}$/.test(realmId) || !same) return back("invalid");

  try {
    await completeConnection(ctx.storeId, code, realmId);
    return back("connected");
  } catch (err) {
    console.error("[qbo] connect failed:", err instanceof Error ? err.message : err);
    return back("failed");
  }
}
