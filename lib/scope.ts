// The one place that decides which store a request may touch.
// The store always comes from the signed-in user's membership for the store named in the URL,
// checked against the database on every request. Nothing from the URL, body or browser is trusted
// beyond "which store did they ask for"; if they're not a member, the answer is "not found".
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { getSession } from "./auth";
import { db } from "./db";

export type Role = "owner" | "staff" | "buyer";
export const MANAGE: Role[] = ["owner", "staff"];
export const OWNER: Role[] = ["owner"];
export const BUY: Role[] = ["buyer"];

export type StoreCtx = {
  userId: string;
  storeId: string;
  slug: string;
  storeName: string;
  role: Role;
  customerId: string | null;
};

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;

/** Lowercases a store web-address name; null if it isn't a valid one. */
export function normalizeSlug(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const slug = raw.toLowerCase();
  return SLUG_RE.test(slug) ? slug : null;
}

function isRole(v: string): v is Role {
  return v === "owner" || v === "staff" || v === "buyer";
}

/** The user's verified access to one store, or null. Never cached beyond a single request. */
export const resolveMembership = cache(async (userId: string, rawSlug: string): Promise<StoreCtx | null> => {
  const slug = normalizeSlug(rawSlug);
  if (!slug) return null;
  const m = await db.membership.findFirst({
    where: { userId, store: { slug } },
    include: { store: { select: { id: true, slug: true, name: true, status: true } }, customer: { select: { storeId: true } } },
  });
  if (!m || m.store.status !== "active" || !isRole(m.role)) return null;
  if (m.role === "buyer") {
    // A buyer must be tied to a customer of this same store.
    if (!m.customerId || !m.customer || m.customer.storeId !== m.store.id) return null;
  }
  return {
    userId,
    storeId: m.store.id,
    slug: m.store.slug,
    storeName: m.store.name,
    role: m.role,
    customerId: m.role === "buyer" ? m.customerId : null,
  };
});

export function homeFor(ctx: StoreCtx): string {
  return ctx.role === "buyer" ? `/s/${ctx.slug}` : `/s/${ctx.slug}/manage`;
}

/** For pages: signed-out → sign in; no access or wrong role → the normal 404 page. */
export async function requireStorePage(rawSlug: string, roles: Role[]): Promise<StoreCtx> {
  const session = await getSession();
  const slug = normalizeSlug(rawSlug);
  if (!session) redirect(slug ? `/login?next=${encodeURIComponent(`/s/${slug}`)}` : "/login");
  const ctx = await resolveMembership(session.userId, rawSlug);
  if (!ctx || !roles.includes(ctx.role)) notFound();
  return ctx;
}

/** For API routes: the store context, or the response to send back (401 signed out, 404 otherwise). */
export async function storeApi(rawSlug: string, roles: Role[]): Promise<StoreCtx | Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "Please sign in again." }, { status: 401 });
  const ctx = await resolveMembership(session.userId, rawSlug);
  if (!ctx || !roles.includes(ctx.role)) return Response.json({ error: "Not found." }, { status: 404 });
  return ctx;
}
