import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { completeConnection } from "@/lib/qbo";

// Step 2 of connecting: Intuit sends the supplier back here with a one-time code.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (result: string) => NextResponse.redirect(new URL(`/supplier/settings?qbo=${result}`, req.url));

  const session = await getSession();
  if (!session || session.role !== "supplier") return NextResponse.redirect(new URL("/login", req.url));

  const jar = await cookies();
  const expected = jar.get("qbo_state")?.value;
  jar.delete({ name: "qbo_state", path: "/api/qbo" });

  if (url.searchParams.get("error")) return back("denied");
  const code = url.searchParams.get("code");
  const realmId = url.searchParams.get("realmId");
  const state = url.searchParams.get("state");
  if (!code || !realmId || !state || !expected || state !== expected) return back("invalid");

  try {
    await completeConnection(session.supplierId, code, realmId);
    return back("connected");
  } catch (err) {
    console.error("[qbo] connect failed:", err instanceof Error ? err.message : err);
    return back("failed");
  }
}
