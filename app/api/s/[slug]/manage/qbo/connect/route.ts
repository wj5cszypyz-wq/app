import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { Params } from "@/lib/api-input";
import { authorizeUrl, qboConfigured } from "@/lib/qbo";
import { OWNER, storeApi } from "@/lib/scope";

// Step 1 of connecting: send the store owner to Intuit to approve access.
// The state cookie remembers which store asked; the callback re-checks ownership before using it.
export async function GET(req: Request, { params }: Params) {
  const ctx = await storeApi((await params).slug, OWNER);
  if (ctx instanceof Response) return ctx;
  const settings = new URL(`/s/${ctx.slug}/manage/settings`, req.url);
  if (!qboConfigured()) {
    settings.searchParams.set("qbo", "missing_keys");
    return NextResponse.redirect(settings);
  }

  const state = randomBytes(24).toString("base64url");
  const jar = await cookies();
  jar.set("qbo_state", `${state}.${ctx.slug}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/qbo",
    maxAge: 600,
  });
  return NextResponse.redirect(authorizeUrl(state));
}
