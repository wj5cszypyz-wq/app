import type { Params } from "@/lib/api-input";
import { notFoundResponse, respond } from "@/lib/data/errors";
import { inviteCustomerLogin } from "@/lib/data/invites";
import { MANAGE, storeApi } from "@/lib/scope";

// Sends the customer's login invite again.
export async function POST(_req: Request, { params }: Params<{ id: string }>) {
  const { slug, id } = await params;
  const ctx = await storeApi(slug, MANAGE);
  if (ctx instanceof Response) return ctx;
  return respond(() => inviteCustomerLogin(ctx, id), (ok) => (ok ? Response.json({ ok: true }) : notFoundResponse("Customer not found.")));
}
