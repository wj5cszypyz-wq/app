// Small helpers for reading JSON request bodies safely.
export async function readJson(req: Request): Promise<Record<string, unknown>> {
  const body = (await req.json().catch(() => null)) as unknown;
  return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
}

export const str = (b: Record<string, unknown>, k: string) => (typeof b[k] === "string" ? (b[k] as string).trim() : "");

export const moneyInput = (v: unknown) => (typeof v === "string" || typeof v === "number" ? v : "");

export type Params<T extends object = object> = { params: Promise<{ slug: string } & T> };
