// Calls a Next.js route handler directly, as a browser with the given session cookie would.
import { vi } from "vitest";
import { SESSION_COOKIE } from "../../lib/cookie-name";

let currentToken: string | undefined;
const setCookies = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      if (setCookies.has(name)) return { name, value: setCookies.get(name)! };
      return name === SESSION_COOKIE && currentToken ? { name, value: currentToken } : undefined;
    },
    set: (name: string | { name: string; value: string }, value?: string) => {
      if (typeof name === "string") setCookies.set(name, value ?? "");
      else setCookies.set(name.name, name.value);
    },
    delete: (name: string | { name: string }) => {
      setCookies.delete(typeof name === "string" ? name : name.name);
    },
  }),
  headers: async () => new Headers(),
}));

export type RouteHandler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

export type CallOptions = {
  method: string;
  url: string;
  token?: string;
  body?: unknown;
  params?: Record<string, string>;
  origin?: string;
  cookies?: Record<string, string>;
};

export async function callRoute(handler: RouteHandler, opts: CallOptions): Promise<Response> {
  currentToken = opts.token;
  setCookies.clear();
  for (const [k, v] of Object.entries(opts.cookies ?? {})) setCookies.set(k, v);
  const headers = new Headers({ origin: opts.origin ?? "http://localhost" });
  if (opts.body !== undefined) headers.set("content-type", "application/json");
  const req = new Request(new URL(opts.url, "http://localhost"), {
    method: opts.method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  return handler(req, { params: Promise.resolve(opts.params ?? {}) });
}

export function signedCookie(name: string): string | undefined {
  return setCookies.get(name);
}
