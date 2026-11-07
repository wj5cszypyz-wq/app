import { badRequest } from "@/lib/auth";
import { readJson, type Params } from "@/lib/api-input";
import { DataError } from "@/lib/data/errors";
import { importFromQbo, previewImport, type ImportKind } from "@/lib/data/qbo-import";
import { importPastInvoices } from "@/lib/data/past-invoices";
import { QboError } from "@/lib/qbo";
import { MANAGE, storeApi } from "@/lib/scope";

async function run<T>(fn: () => Promise<T>, status = 200): Promise<Response> {
  try {
    return Response.json(await fn(), { status });
  } catch (err) {
    if (err instanceof DataError) return Response.json({ error: err.message }, { status: err.status });
    if (err instanceof QboError) return Response.json({ error: err.message }, { status: 502 });
    throw err;
  }
}

const kindOf = (v: unknown): ImportKind | "invoices" | null => (v === "items" || v === "customers" || v === "invoices" ? v : null);

// Preview what would come in from QuickBooks (?kind=items|customers).
export async function GET(req: Request, { params }: Params) {
  const ctx = await storeApi((await params).slug, MANAGE);
  if (ctx instanceof Response) return ctx;
  const kind = kindOf(new URL(req.url).searchParams.get("kind"));
  if (kind !== "items" && kind !== "customers") return badRequest("Choose items or customers.");
  return run(async () => ({ rows: await previewImport(ctx, kind) }));
}

// Bring in the chosen rows: { kind: "items"|"customers", ids: [...] } or { kind: "invoices", since: "YYYY-MM-DD" }.
export async function POST(req: Request, { params }: Params) {
  const ctx = await storeApi((await params).slug, MANAGE);
  if (ctx instanceof Response) return ctx;
  const b = await readJson(req);
  const kind = kindOf(b.kind);
  if (!kind) return badRequest("Choose what to bring in.");
  if (kind === "invoices") {
    const since = typeof b.since === "string" ? b.since : "";
    return run(() => importPastInvoices(ctx, since), 201);
  }
  const ids = Array.isArray(b.ids) ? b.ids.filter((x): x is string => typeof x === "string") : [];
  return run(() => importFromQbo(ctx, kind, ids), 201);
}
