// Placeholder until Task 4.
import type { StoreCtx } from "../scope";
import { DataError } from "./errors";

export async function importPastInvoices(_ctx: StoreCtx, _since: string): Promise<never> {
  throw new DataError("Not available yet.");
}
