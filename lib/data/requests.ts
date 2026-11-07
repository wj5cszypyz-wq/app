// Optional "request an account" page for new customers. Off unless the store owner turns it on.
import { db } from "../db";
import { emailProblem } from "../passwords";
import { normalizeSlug, type StoreCtx } from "../scope";
import { createCustomer } from "./customers";
import { DataError } from "./errors";
import { asManager } from "./guard";

export type RequestInput = { businessName: string; contactName: string; email: string; phone: string; message: string };

async function openStore(rawSlug: string) {
  const slug = normalizeSlug(rawSlug);
  if (!slug) return null;
  const store = await db.store.findUnique({ where: { slug }, select: { id: true, name: true, status: true, allowAccountRequests: true } });
  return store && store.status === "active" && store.allowAccountRequests ? store : null;
}

/** Public: what the join page may show. Null (→ 404) unless the store is open and accepting requests. */
export async function joinPageInfo(rawSlug: string) {
  const store = await openStore(rawSlug);
  return store ? { storeName: store.name } : null;
}

export async function submitAccountRequest(
  rawSlug: string,
  input: RequestInput,
): Promise<{ ok: true } | { ok: false; notFound: true } | { ok: false; error: string }> {
  const store = await openStore(rawSlug);
  if (!store) return { ok: false, notFound: true };
  const businessName = input.businessName.trim();
  const contactName = input.contactName.trim();
  const email = input.email.trim().toLowerCase();
  if (!businessName || businessName.length > 120) return { ok: false, error: "Add your business or name." };
  if (!contactName || contactName.length > 120) return { ok: false, error: "Add a contact name." };
  const bad = emailProblem(email);
  if (bad) return { ok: false, error: bad };
  const pending = await db.accountRequest.count({ where: { storeId: store.id, status: "pending" } });
  if (pending >= 200) return { ok: false, error: "This store has too many open requests right now. Please contact them directly." };
  const dup = await db.accountRequest.findFirst({ where: { storeId: store.id, email, status: "pending" }, select: { id: true } });
  if (!dup) {
    await db.accountRequest.create({
      data: {
        storeId: store.id,
        businessName,
        contactName,
        email,
        phone: input.phone.trim().slice(0, 40) || null,
        message: input.message.trim().slice(0, 1000) || null,
      },
    });
  }
  return { ok: true };
}

export async function listAccountRequests(ctx: StoreCtx) {
  const { storeId } = asManager(ctx);
  return db.accountRequest.findMany({ where: { storeId, status: "pending" }, orderBy: { createdAt: "asc" } });
}

/** Approve: creates the customer and emails them an invite. False if not a pending request of this store. */
export async function approveRequest(ctx: StoreCtx, id: string): Promise<boolean> {
  const { storeId } = asManager(ctx);
  const claimed = await db.accountRequest.updateMany({ where: { id, storeId, status: "pending" }, data: { status: "approved" } });
  if (claimed.count !== 1) return false;
  const r = await db.accountRequest.findUniqueOrThrow({ where: { id } });
  try {
    await createCustomer(ctx, { name: r.businessName, contactName: r.contactName, email: r.email, phone: r.phone ?? "", address: "" });
  } catch (err) {
    await db.accountRequest.update({ where: { id }, data: { status: "pending" } });
    throw err;
  }
  return true;
}

export async function declineRequest(ctx: StoreCtx, id: string): Promise<boolean> {
  const { storeId } = asManager(ctx);
  const r = await db.accountRequest.updateMany({ where: { id, storeId, status: "pending" }, data: { status: "declined" } });
  return r.count === 1;
}

export async function setAllowAccountRequests(ctx: StoreCtx, allow: boolean) {
  const { storeId } = asManager(ctx);
  if (ctx.role !== "owner") throw new DataError("Only the store owner can change this.");
  await db.store.update({ where: { id: storeId }, data: { allowAccountRequests: allow } });
}

export async function storeSettings(ctx: StoreCtx) {
  const { storeId } = asManager(ctx);
  return db.store.findUniqueOrThrow({ where: { id: storeId }, select: { allowAccountRequests: true, status: true } });
}
