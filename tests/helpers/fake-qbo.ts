// An in-memory QuickBooks Online for tests. It answers the same HTTP calls lib/qbo.ts makes and
// enforces the QuickBooks rules that matter to us:
// - names are unique across Customers, Vendors and Employees (and across Items), active or not
// - queries only return active records unless "Active IN (true, false)" is asked for
// - an invoice line's Amount must equal Qty × UnitPrice (to the cent)
// - a repeated requestid returns the first result instead of creating a second record
// - refresh tokens rotate and the old one stops working
import { vi } from "vitest";

type Rec = Record<string, unknown> & { Id: string; Active?: boolean; SyncToken?: string };
type Fault = { status: number; code: string; message: string; detail?: string };

export type FakeQbo = {
  items: Rec[];
  customers: Rec[];
  vendors: Rec[];
  invoices: Rec[];
  calls: { method: string; path: string }[];
  count: (pred: (c: { method: string; path: string }) => boolean) => number;
  failNext: (path: RegExp, fault: Fault) => void;
  refreshToken: string;
  accessToken: string;
  restore: () => void;
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const fault = (f: Fault) => json(f.status, { Fault: { Error: [{ Message: f.message, Detail: f.detail ?? "", code: f.code }], type: "ValidationFault" } });

function unquote(v: string): string {
  return v.slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, "\\");
}

export function installFakeQbo(): FakeQbo {
  let nextId = 100;
  const id = () => String(nextId++);
  const byRequest = new Map<string, Response>();
  const failures: { path: RegExp; fault: Fault }[] = [];
  const state: FakeQbo = {
    items: [],
    customers: [],
    vendors: [],
    invoices: [],
    calls: [],
    count: (pred) => state.calls.filter(pred).length,
    failNext: (path, f) => failures.push({ path, fault: f }),
    refreshToken: "refresh-0",
    accessToken: "access-0",
    restore: () => vi.unstubAllGlobals(),
  };
  state.items.push({ Id: "1", Name: "Services", Type: "Service", Active: true }); // every company has one
  const accounts = [{ Id: "79", Name: "Sales of Product Income", AccountType: "Income" }];
  let tokenSeq = 0;

  const nameTaken = (name: string) =>
    [...state.customers, ...state.vendors].some((r) => String(r.DisplayName).toLowerCase() === name.toLowerCase());

  function query(sql: string): Rec[] | null {
    const table = /from\s+(\w+)/i.exec(sql)?.[1]?.toLowerCase();
    const src: Rec[] =
      table === "item" ? state.items : table === "customer" ? state.customers : table === "invoice" ? state.invoices : table === "account" ? (accounts as Rec[]) : [];
    let rows = [...src];
    if (table !== "invoice" && table !== "account" && !/Active\s+IN\s*\(\s*true\s*,\s*false\s*\)/i.test(sql)) rows = rows.filter((r) => r.Active !== false);
    for (const m of sql.matchAll(/(\w+)\s*(=|>=)\s*('(?:[^'\\]|\\.)*')/g)) {
      const [, field, op, raw] = m;
      const value = unquote(raw);
      rows = rows.filter((r) => {
        const v = field === "CustomerRef" ? (r.CustomerRef as { value: string })?.value : String(r[field] ?? "");
        return op === "=" ? v === value : v >= value;
      });
    }
    const start = Number(/STARTPOSITION\s+(\d+)/i.exec(sql)?.[1] ?? 1);
    const max = Number(/MAXRESULTS\s+(\d+)/i.exec(sql)?.[1] ?? 100);
    return rows.slice(start - 1, start - 1 + max);
  }

  async function handle(url: URL, init: RequestInit): Promise<Response> {
    const method = (init.method ?? "GET").toUpperCase();
    const path = url.pathname;
    state.calls.push({ method, path: path + url.search });
    const failure = failures.findIndex((f) => f.path.test(path));
    if (failure >= 0) return fault(failures.splice(failure, 1)[0].fault);

    if (url.host === "oauth.platform.intuit.com") {
      const body = new URLSearchParams(String(init.body));
      if (body.get("grant_type") === "refresh_token" && body.get("refresh_token") !== state.refreshToken) {
        return json(400, { error: "invalid_grant" });
      }
      tokenSeq++;
      state.refreshToken = `refresh-${tokenSeq}`;
      state.accessToken = `access-${tokenSeq}`;
      return json(200, { access_token: state.accessToken, refresh_token: state.refreshToken, expires_in: 3600, x_refresh_token_expires_in: 8_640_000 });
    }
    if (url.host === "developer.api.intuit.com") return json(200, {});

    const auth = new Headers(init.headers).get("authorization");
    if (auth !== `Bearer ${state.accessToken}`) return json(401, { fault: { error: [{ message: "AuthenticationFailed" }] } });

    const m = /^\/v3\/company\/(\d+)\/(.+)$/.exec(path);
    if (!m) return json(404, {});
    const rest = m[2];
    const requestId = url.searchParams.get("requestid");
    if (requestId && byRequest.has(requestId)) return byRequest.get(requestId)!.clone();
    const remember = (res: Response) => {
      if (requestId) byRequest.set(requestId, res.clone());
      return res;
    };
    const body = init.body ? JSON.parse(String(init.body)) : {};

    if (rest.startsWith("companyinfo/")) return json(200, { CompanyInfo: { CompanyName: "Sandbox Company_US_1" } });
    if (rest === "query") {
      const rows = query(url.searchParams.get("query") ?? "");
      const table = /from\s+(\w+)/i.exec(url.searchParams.get("query") ?? "")?.[1] ?? "Item";
      const key = table[0].toUpperCase() + table.slice(1).toLowerCase();
      return json(200, { QueryResponse: rows && rows.length ? { [key]: rows, startPosition: 1, maxResults: rows.length } : {} });
    }
    if (rest === "customer" && method === "POST") {
      if (nameTaken(String(body.DisplayName))) {
        return fault({ status: 400, code: "6240", message: "Duplicate Name Exists Error", detail: `The name supplied already exists. : Another customer, vendor or employee is already using this name.` });
      }
      const rec = { ...body, Id: id(), Active: true, SyncToken: "0" };
      state.customers.push(rec);
      return remember(json(200, { Customer: rec }));
    }
    if (rest === "item" && method === "POST") {
      if (state.items.some((i) => String(i.Name).toLowerCase() === String(body.Name).toLowerCase())) {
        return fault({ status: 400, code: "6240", message: "Duplicate Name Exists Error", detail: "The name supplied already exists." });
      }
      const rec = { ...body, Id: id(), Active: true, SyncToken: "0", FullyQualifiedName: body.Name };
      state.items.push(rec);
      return remember(json(200, { Item: rec }));
    }
    if (rest === "invoice" && method === "POST" && url.searchParams.get("operation") === "void") {
      const inv = state.invoices.find((i) => i.Id === body.Id);
      if (!inv || inv.SyncToken !== body.SyncToken) return fault({ status: 400, code: "5010", message: "Stale Object Error" });
      Object.assign(inv, { Voided: true, TotalAmt: 0, SyncToken: String(Number(inv.SyncToken) + 1), PrivateNote: "Voided" });
      return json(200, { Invoice: inv });
    }
    if (rest === "invoice" && method === "POST") {
      for (const line of body.Line ?? []) {
        const d = line.SalesItemLineDetail;
        if (Math.round(d.Qty * d.UnitPrice * 100) !== Math.round(line.Amount * 100)) {
          return fault({ status: 400, code: "6070", message: "Amount is not equal to UnitPrice * Qty", detail: `Supplied value: ${line.Amount}` });
        }
        if (!state.items.some((i) => i.Id === d.ItemRef.value)) return fault({ status: 400, code: "2500", message: "Invalid Reference Id" });
      }
      if (!state.customers.some((c) => c.Id === body.CustomerRef.value)) return fault({ status: 400, code: "2500", message: "Invalid Reference Id" });
      const total = (body.Line ?? []).reduce((s: number, l: { Amount: number }) => s + l.Amount, 0);
      const rec = { ...body, Id: id(), SyncToken: "0", TotalAmt: Math.round(total * 100) / 100 };
      state.invoices.push(rec);
      return remember(json(200, { Invoice: rec }));
    }
    const inv = /^invoice\/(\d+)(\/pdf)?$/.exec(rest);
    if (inv && method === "GET") {
      const rec = state.invoices.find((i) => i.Id === inv[1]);
      if (!rec) return fault({ status: 400, code: "610", message: "Object Not Found" });
      if (inv[2]) return new Response(new Uint8Array(Buffer.from("%PDF-1.4 fake")), { headers: { "content-type": "application/pdf" } });
      return json(200, { Invoice: rec });
    }
    return json(404, { Fault: { Error: [{ Message: `fake QBO: unhandled ${method} ${rest}` }] } });
  }

  const realFetch = globalThis.fetch;
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (/intuit\.com$/.test(url.host)) return handle(url, init);
    return realFetch(input, init);
  });
  return state;
}

/** Connects a test store to the fake company (tokens encrypted as the app stores them). */
export async function connectStore(storeId: string, fake: FakeQbo, opts: { expired?: boolean } = {}) {
  const { db } = await import("../../lib/db");
  const { encrypt } = await import("../../lib/crypto");
  await db.store.update({
    where: { id: storeId },
    data: {
      qboRealmId: "9130350000000001",
      qboAccessToken: encrypt(fake.accessToken),
      qboRefreshToken: encrypt(fake.refreshToken),
      qboAccessExpiresAt: new Date(Date.now() + (opts.expired ? -60_000 : 3_600_000)),
      qboRefreshExpiresAt: new Date(Date.now() + 86_400_000 * 90),
    },
  });
}
