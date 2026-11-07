// Second line of defense: data functions refuse a context with the wrong role, even if a route forgot.
import type { StoreCtx } from "../scope";

export function asManager(ctx: StoreCtx): StoreCtx {
  if (ctx.role !== "owner" && ctx.role !== "staff") throw new Error("Store data requested without a seller role.");
  return ctx;
}

export function asBuyer(ctx: StoreCtx): StoreCtx & { customerId: string } {
  if (ctx.role !== "buyer" || !ctx.customerId) throw new Error("Buyer data requested without a buyer role.");
  return ctx as StoreCtx & { customerId: string };
}
