import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { authorizeUrl, qboConfigured } from "@/lib/qbo";

// Step 1 of connecting: send the supplier to Intuit to approve access.
export async function GET(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "supplier") return NextResponse.redirect(new URL("/login", req.url));
  if (!qboConfigured()) return NextResponse.redirect(new URL("/supplier/settings?qbo=missing_keys", req.url));

  const state = randomBytes(24).toString("base64url");
  const jar = await cookies();
  jar.set("qbo_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/qbo",
    maxAge: 600,
  });
  return NextResponse.redirect(authorizeUrl(state));
}
