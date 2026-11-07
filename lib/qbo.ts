// QuickBooks Online: OAuth 2.0 connection + the few accounting calls this app needs.
// Docs: https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/invoice
import type { Customer, Product, Store } from "@prisma/client";
import { db } from "./db";
import { decrypt, encrypt } from "./crypto";
import { qboItemName, qboQuote } from "./invoice";

const AUTHORIZE_URL = "https://appcenter.intuit.com/connect/oauth2";
const TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const REVOKE_URL = "https://developer.api.intuit.com/v2/oauth2/tokens/revoke";
const SCOPE = "com.intuit.quickbooks.accounting";
const MINOR_VERSION = "75";

export class QboError extends Error {
  constructor(message: string, readonly status?: number, readonly code?: string) {
    super(message);
  }
}

export function qboConfigured(): boolean {
  return Boolean(process.env.QBO_CLIENT_ID && process.env.QBO_CLIENT_SECRET && process.env.QBO_REDIRECT_URI);
}

export function qboEnvironment(): "sandbox" | "production" {
  return process.env.QBO_ENV === "production" ? "production" : "sandbox";
}

function apiBase(): string {
  return qboEnvironment() === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com";
}

/** Link that opens an invoice inside the QuickBooks web app. */
export function qboInvoiceUrl(invoiceId: string): string {
  const host = qboEnvironment() === "production" ? "https://app.qbo.intuit.com" : "https://app.sandbox.qbo.intuit.com";
  return `${host}/app/invoice?txnId=${encodeURIComponent(invoiceId)}`;
}

export function authorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.QBO_CLIENT_ID!,
    response_type: "code",
    scope: SCOPE,
    redirect_uri: process.env.QBO_REDIRECT_URI!,
    state,
  });
  return `${AUTHORIZE_URL}?${params}`;
}

function basicAuth(): string {
  return "Basic " + Buffer.from(`${process.env.QBO_CLIENT_ID}:${process.env.QBO_CLIENT_SECRET}`).toString("base64");
}

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  x_refresh_token_expires_in: number;
};

async function tokenRequest(body: URLSearchParams): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuth(),
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    if (text.includes("invalid_grant")) {
      throw new QboError("QuickBooks access expired or was revoked. Reconnect QuickBooks in Settings.", res.status);
    }
    throw new QboError(`QuickBooks sign-in failed (${res.status}).`, res.status);
  }
  return (await res.json()) as TokenResponse;
}

function tokenFields(t: TokenResponse) {
  const now = Date.now();
  return {
    qboAccessToken: encrypt(t.access_token),
    qboRefreshToken: encrypt(t.refresh_token),
    qboAccessExpiresAt: new Date(now + t.expires_in * 1000),
    qboRefreshExpiresAt: new Date(now + t.x_refresh_token_expires_in * 1000),
  };
}

/** Step 2 of OAuth: trade the one-time code for tokens and save the connection. */
export async function completeConnection(storeId: string, code: string, realmId: string): Promise<void> {
  const tokens = await tokenRequest(
    new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: process.env.QBO_REDIRECT_URI! }),
  );
  const before = await db.store.findUniqueOrThrow({ where: { id: storeId }, select: { qboRealmId: true } });
  const sameCompany = before.qboRealmId === realmId;
  if (!sameCompany) {
    // A different QuickBooks company invalidates every stored QuickBooks id.
    await db.customer.updateMany({ where: { storeId }, data: { qboCustomerId: null } });
    await db.product.updateMany({ where: { storeId }, data: { qboItemId: null } });
  }
  const store = await db.store.update({
    where: { id: storeId },
    data: {
      qboRealmId: realmId,
      ...(sameCompany ? {} : { qboIncomeAccountId: null }),
      ...tokenFields(tokens),
    },
  });

  try {
    const res = await qboRequest(store, `companyinfo/${encodeURIComponent(realmId)}`);
    const json = (await res.json()) as { CompanyInfo?: { CompanyName?: string } };
    await db.store.update({
      where: { id: storeId },
      data: { qboCompanyName: json.CompanyInfo?.CompanyName ?? null },
    });
  } catch {
    // Company name is cosmetic; the connection itself succeeded.
  }
}

export async function disconnect(store: Store): Promise<void> {
  if (store.qboRefreshToken && qboConfigured()) {
    try {
      await fetch(REVOKE_URL, {
        method: "POST",
        headers: { Authorization: basicAuth(), Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ token: decrypt(store.qboRefreshToken) }),
      });
    } catch {
      // Revoking is best-effort; we drop our copy of the tokens either way.
    }
  }
  await db.store.update({
    where: { id: store.id },
    data: {
      qboRealmId: null,
      qboCompanyName: null,
      qboAccessToken: null,
      qboRefreshToken: null,
      qboAccessExpiresAt: null,
      qboRefreshExpiresAt: null,
    },
  });
}

const refreshing = new Map<string, Promise<string>>();

/**
 * Returns a valid access token, refreshing it when needed. Refreshes are serialized per store:
 * concurrent requests in this server share one refresh, and a version check in the database stops
 * two servers from both saving (and so losing) a rotated refresh token.
 */
async function accessToken(store: Store): Promise<string> {
  if (!store.qboRealmId || !store.qboRefreshToken) throw new QboError("QuickBooks is not connected.");
  const fresh = (s: Store) =>
    s.qboAccessToken && s.qboAccessExpiresAt && s.qboAccessExpiresAt.getTime() - Date.now() > 5 * 60_000;
  if (fresh(store)) return decrypt(store.qboAccessToken!);

  const inFlight = refreshing.get(store.id);
  if (inFlight) return inFlight;

  const job = (async () => {
    const current = await db.store.findUniqueOrThrow({ where: { id: store.id } });
    if (fresh(current)) {
      Object.assign(store, current);
      return decrypt(current.qboAccessToken!);
    }
    if (!current.qboRefreshToken) throw new QboError("QuickBooks is not connected.");
    const tokens = await tokenRequest(
      new URLSearchParams({ grant_type: "refresh_token", refresh_token: decrypt(current.qboRefreshToken) }),
    );
    const fields = tokenFields(tokens);
    const saved = await db.store.updateMany({
      where: { id: store.id, qboTokenVersion: current.qboTokenVersion },
      data: { ...fields, qboTokenVersion: { increment: 1 } },
    });
    if (saved.count === 0) {
      // Another server refreshed at the same moment; use what it saved.
      const latest = await db.store.findUniqueOrThrow({ where: { id: store.id } });
      Object.assign(store, latest);
      return decrypt(latest.qboAccessToken!);
    }
    Object.assign(store, fields, { qboTokenVersion: current.qboTokenVersion + 1 });
    return tokens.access_token;
  })();
  refreshing.set(store.id, job);
  try {
    return await job;
  } finally {
    refreshing.delete(store.id);
  }
}

function parseFault(text: string): { message: string; code?: string } | null {
  try {
    const json = JSON.parse(text);
    const e = json?.Fault?.Error?.[0];
    if (e) return { message: [e.Message, e.Detail].filter(Boolean).join(": "), code: e.code ? String(e.code) : undefined };
  } catch {
    // not JSON
  }
  return null;
}

type RequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  accept?: string;
  query?: Record<string, string>;
};

async function qboRequest(store: Store, path: string, opts: RequestOptions = {}): Promise<Response> {
  const token = await accessToken(store);
  const url = new URL(`${apiBase()}/v3/company/${encodeURIComponent(store.qboRealmId!)}/${path}`);
  url.searchParams.set("minorversion", MINOR_VERSION);
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v);

  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: opts.accept ?? "application/json",
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    const f = parseFault(text);
    throw new QboError(f?.message ?? `QuickBooks returned an error (${res.status}).`, res.status, f?.code);
  }
  return res;
}

/** Reads every row of a query, 1000 at a time (QuickBooks' page limit). */
async function queryAll<T>(store: Store, sql: string, cap = 20_000): Promise<T[]> {
  const out: T[] = [];
  for (let start = 1; out.length < cap; start += 1000) {
    const page = await query<T>(store, `${sql} STARTPOSITION ${start} MAXRESULTS 1000`);
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

export type QboItem = {
  Id: string;
  Name: string;
  FullyQualifiedName?: string;
  Sku?: string;
  Description?: string;
  UnitPrice?: number;
  Type?: string;
  QtyOnHand?: number;
  Active?: boolean;
};

export type QboCustomer = {
  Id: string;
  DisplayName: string;
  CompanyName?: string;
  GivenName?: string;
  FamilyName?: string;
  PrimaryEmailAddr?: { Address?: string };
  PrimaryPhone?: { FreeFormNumber?: string };
  BillAddr?: { Line1?: string; City?: string; CountrySubDivisionCode?: string; PostalCode?: string };
};

/** Every active sellable item (Inventory, Non-inventory, Service). Categories and bundles are skipped. */
export async function listAllItems(store: Store): Promise<QboItem[]> {
  const rows = await queryAll<QboItem>(store, "select * from Item");
  return rows.filter((i) => i.Type === "Inventory" || i.Type === "NonInventory" || i.Type === "Service");
}

export async function listAllCustomers(store: Store): Promise<QboCustomer[]> {
  return queryAll<QboCustomer>(store, "select * from Customer");
}

export type QboInvoice = {
  Id: string;
  DocNumber?: string;
  TxnDate: string;
  TotalAmt?: number;
  Line?: { DetailType?: string; Amount?: number; Description?: string; SalesItemLineDetail?: { ItemRef?: { value?: string; name?: string }; Qty?: number; UnitPrice?: number } }[];
};

/** A customer's invoices dated on or after `sinceIso` (YYYY-MM-DD). */
export async function listInvoicesSince(store: Store, customerQboId: string, sinceIso: string): Promise<QboInvoice[]> {
  return queryAll<QboInvoice>(
    store,
    `select * from Invoice where CustomerRef = ${qboQuote(customerQboId)} and TxnDate >= ${qboQuote(sinceIso)}`,
    5000,
  );
}

async function query<T>(store: Store, sql: string): Promise<T[]> {
  const res = await qboRequest(store, "query", { query: { query: sql } });
  const json = (await res.json()) as { QueryResponse?: Record<string, unknown> };
  const qr = json.QueryResponse ?? {};
  const list = Object.values(qr).find(Array.isArray);
  return (list ?? []) as T[];
}

type Ref = { Id: string; Name?: string; DisplayName?: string; DocNumber?: string };

/** Picks the income account new items post to (prefers "Sales of Product Income"). */
export async function ensureIncomeAccount(store: Store): Promise<string> {
  if (store.qboIncomeAccountId) return store.qboIncomeAccountId;
  const accounts = await query<Ref>(store, "select * from Account where AccountType = 'Income' MAXRESULTS 100");
  if (accounts.length === 0) throw new QboError("No Income account found in QuickBooks. Add one, then retry.");
  const pick =
    accounts.find((a) => a.Name === "Sales of Product Income") ??
    accounts.find((a) => /sales/i.test(a.Name ?? "")) ??
    accounts[0];
  await db.store.update({ where: { id: store.id }, data: { qboIncomeAccountId: pick.Id } });
  store.qboIncomeAccountId = pick.Id;
  return pick.Id;
}

/** Finds the customer in QuickBooks by name (active or not), or creates it. Never makes a duplicate. */
export async function ensureCustomer(store: Store, r: Customer): Promise<string> {
  if (r.qboCustomerId) return r.qboCustomerId;
  const displayName = r.name.replace(/:/g, "-").slice(0, 500);
  const found = await query<Ref & { Active?: boolean }>(
    store,
    `select * from Customer where DisplayName = ${qboQuote(displayName)} and Active IN (true, false)`,
  );
  if (found[0] && found[0].Active === false) {
    throw new QboError(`"${displayName}" is inactive in QuickBooks. Make the customer active in QuickBooks, then press Retry.`);
  }
  let id = found[0]?.Id;
  if (!id) {
    try {
      const res = await qboRequest(store, "customer", {
        method: "POST",
        body: {
          DisplayName: displayName,
          CompanyName: r.name.slice(0, 100),
          ...(r.contactName ? { GivenName: r.contactName.slice(0, 100) } : {}),
          ...(r.email ? { PrimaryEmailAddr: { Address: r.email } } : {}),
          ...(r.phone ? { PrimaryPhone: { FreeFormNumber: r.phone } } : {}),
          ...(r.address ? { BillAddr: { Line1: r.address.slice(0, 500) } } : {}),
        },
      });
      id = ((await res.json()) as { Customer: Ref }).Customer.Id;
    } catch (err) {
      if (err instanceof QboError && err.code === "6240") {
        throw new QboError(
          `QuickBooks already has a customer, vendor or employee named "${displayName}". Press Retry first (another order may have just added this customer). If it still fails, rename this customer here or in QuickBooks.`,
          err.status,
          err.code,
        );
      }
      throw err;
    }
  }
  await db.customer.update({ where: { id: r.id }, data: { qboCustomerId: id } });
  return id;
}

/** Finds the product in QuickBooks by name, or creates it as a Non-inventory item. */
export async function ensureItem(store: Store, p: Product, incomeAccountId: string): Promise<string> {
  if (p.qboItemId) return p.qboItemId;
  const name = qboItemName(p.name, p.sku);
  const found = await query<Ref & { Active?: boolean }>(store, `select * from Item where Name = ${qboQuote(name)} and Active IN (true, false)`);
  if (found[0] && found[0].Active === false) {
    throw new QboError(`The item "${name}" is inactive in QuickBooks. Make it active in QuickBooks (or link this product to another item), then press Retry.`);
  }
  let id = found[0]?.Id;
  if (!id) {
    const res = await qboRequest(store, "item", {
      method: "POST",
      body: {
        Name: name,
        Type: "NonInventory",
        Sku: p.sku.slice(0, 100),
        Description: [p.name, p.packSize].filter(Boolean).join(" · "),
        UnitPrice: p.priceCents / 100,
        IncomeAccountRef: { value: incomeAccountId },
      },
    });
    id = ((await res.json()) as { Item: Ref }).Item.Id;
  }
  await db.product.update({ where: { id: p.id }, data: { qboItemId: id } });
  return id;
}

/** Creates the invoice. requestId makes retries safe: QuickBooks won't create a duplicate. */
export async function createInvoice(store: Store, payload: unknown, requestId: string): Promise<Ref> {
  const res = await qboRequest(store, "invoice", { method: "POST", body: payload, query: { requestid: requestId } });
  return ((await res.json()) as { Invoice: Ref }).Invoice;
}

/** Voids an invoice (QuickBooks keeps it for the record with a zero amount). */
export async function voidInvoice(store: Store, invoiceId: string): Promise<void> {
  const res = await qboRequest(store, `invoice/${encodeURIComponent(invoiceId)}`);
  const { Invoice } = (await res.json()) as { Invoice: { Id: string; SyncToken: string } };
  await qboRequest(store, "invoice", { method: "POST", body: { Id: Invoice.Id, SyncToken: Invoice.SyncToken }, query: { operation: "void" } });
}

export async function invoicePdf(store: Store, invoiceId: string): Promise<ArrayBuffer> {
  const res = await qboRequest(store, `invoice/${encodeURIComponent(invoiceId)}/pdf`, { accept: "application/pdf" });
  return res.arrayBuffer();
}
