// QuickBooks Online: OAuth 2.0 connection + the few accounting calls this app needs.
// Docs: https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/invoice
import type { Product, Restaurant, Supplier } from "@prisma/client";
import { db } from "./db";
import { decrypt, encrypt } from "./crypto";
import { qboItemName, qboQuote } from "./invoice";

const AUTHORIZE_URL = "https://appcenter.intuit.com/connect/oauth2";
const TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const REVOKE_URL = "https://developer.api.intuit.com/v2/oauth2/tokens/revoke";
const SCOPE = "com.intuit.quickbooks.accounting";
const MINOR_VERSION = "75";

export class QboError extends Error {
  constructor(message: string, readonly status?: number) {
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
export async function completeConnection(supplierId: string, code: string, realmId: string): Promise<void> {
  const tokens = await tokenRequest(
    new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: process.env.QBO_REDIRECT_URI! }),
  );
  const before = await db.supplier.findUniqueOrThrow({ where: { id: supplierId }, select: { qboRealmId: true } });
  const sameCompany = before.qboRealmId === realmId;
  if (!sameCompany) {
    // A different QuickBooks company invalidates every stored QuickBooks id.
    await db.restaurant.updateMany({ where: { supplierId }, data: { qboCustomerId: null } });
    await db.product.updateMany({ where: { supplierId }, data: { qboItemId: null } });
  }
  const supplier = await db.supplier.update({
    where: { id: supplierId },
    data: {
      qboRealmId: realmId,
      ...(sameCompany ? {} : { qboIncomeAccountId: null }),
      ...tokenFields(tokens),
    },
  });

  try {
    const res = await qboRequest(supplier, `companyinfo/${encodeURIComponent(realmId)}`);
    const json = (await res.json()) as { CompanyInfo?: { CompanyName?: string } };
    await db.supplier.update({
      where: { id: supplierId },
      data: { qboCompanyName: json.CompanyInfo?.CompanyName ?? null },
    });
  } catch {
    // Company name is cosmetic; the connection itself succeeded.
  }
}

export async function disconnect(supplier: Supplier): Promise<void> {
  if (supplier.qboRefreshToken && qboConfigured()) {
    try {
      await fetch(REVOKE_URL, {
        method: "POST",
        headers: { Authorization: basicAuth(), Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ token: decrypt(supplier.qboRefreshToken) }),
      });
    } catch {
      // Revoking is best-effort; we drop our copy of the tokens either way.
    }
  }
  await db.supplier.update({
    where: { id: supplier.id },
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

/** Returns a valid access token, refreshing it (and saving the rotated refresh token) when needed. */
async function accessToken(supplier: Supplier): Promise<string> {
  if (!supplier.qboRealmId || !supplier.qboRefreshToken) throw new QboError("QuickBooks is not connected.");
  const fresh =
    supplier.qboAccessToken &&
    supplier.qboAccessExpiresAt &&
    supplier.qboAccessExpiresAt.getTime() - Date.now() > 5 * 60_000;
  if (fresh) return decrypt(supplier.qboAccessToken!);

  const tokens = await tokenRequest(
    new URLSearchParams({ grant_type: "refresh_token", refresh_token: decrypt(supplier.qboRefreshToken) }),
  );
  const fields = tokenFields(tokens);
  await db.supplier.update({ where: { id: supplier.id }, data: fields });
  Object.assign(supplier, fields);
  return tokens.access_token;
}

function faultMessage(text: string): string | null {
  try {
    const json = JSON.parse(text);
    const e = json?.Fault?.Error?.[0];
    if (e) return [e.Message, e.Detail].filter(Boolean).join(": ");
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

async function qboRequest(supplier: Supplier, path: string, opts: RequestOptions = {}): Promise<Response> {
  const token = await accessToken(supplier);
  const url = new URL(`${apiBase()}/v3/company/${encodeURIComponent(supplier.qboRealmId!)}/${path}`);
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
    throw new QboError(faultMessage(text) ?? `QuickBooks returned an error (${res.status}).`, res.status);
  }
  return res;
}

async function query<T>(supplier: Supplier, sql: string): Promise<T[]> {
  const res = await qboRequest(supplier, "query", { query: { query: sql } });
  const json = (await res.json()) as { QueryResponse?: Record<string, unknown> };
  const qr = json.QueryResponse ?? {};
  const list = Object.values(qr).find(Array.isArray);
  return (list ?? []) as T[];
}

type Ref = { Id: string; Name?: string; DisplayName?: string; DocNumber?: string };

/** Picks the income account new items post to (prefers "Sales of Product Income"). */
export async function ensureIncomeAccount(supplier: Supplier): Promise<string> {
  if (supplier.qboIncomeAccountId) return supplier.qboIncomeAccountId;
  const accounts = await query<Ref>(supplier, "select * from Account where AccountType = 'Income' MAXRESULTS 100");
  if (accounts.length === 0) throw new QboError("No Income account found in QuickBooks. Add one, then retry.");
  const pick =
    accounts.find((a) => a.Name === "Sales of Product Income") ??
    accounts.find((a) => /sales/i.test(a.Name ?? "")) ??
    accounts[0];
  await db.supplier.update({ where: { id: supplier.id }, data: { qboIncomeAccountId: pick.Id } });
  supplier.qboIncomeAccountId = pick.Id;
  return pick.Id;
}

/** Finds the restaurant in QuickBooks by name, or creates it as a Customer. */
export async function ensureCustomer(supplier: Supplier, r: Restaurant): Promise<string> {
  if (r.qboCustomerId) return r.qboCustomerId;
  const displayName = r.name.replace(/:/g, "-").slice(0, 500);
  const found = await query<Ref>(supplier, `select * from Customer where DisplayName = ${qboQuote(displayName)}`);
  let id = found[0]?.Id;
  if (!id) {
    const res = await qboRequest(supplier, "customer", {
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
  }
  await db.restaurant.update({ where: { id: r.id }, data: { qboCustomerId: id } });
  return id;
}

/** Finds the product in QuickBooks by name, or creates it as a Non-inventory item. */
export async function ensureItem(supplier: Supplier, p: Product, incomeAccountId: string): Promise<string> {
  if (p.qboItemId) return p.qboItemId;
  const name = qboItemName(p.name, p.sku);
  const found = await query<Ref>(supplier, `select * from Item where Name = ${qboQuote(name)}`);
  let id = found[0]?.Id;
  if (!id) {
    const res = await qboRequest(supplier, "item", {
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
export async function createInvoice(supplier: Supplier, payload: unknown, requestId: string): Promise<Ref> {
  const res = await qboRequest(supplier, "invoice", { method: "POST", body: payload, query: { requestid: requestId } });
  return ((await res.json()) as { Invoice: Ref }).Invoice;
}

export async function invoicePdf(supplier: Supplier, invoiceId: string): Promise<ArrayBuffer> {
  const res = await qboRequest(supplier, `invoice/${encodeURIComponent(invoiceId)}/pdf`, { accept: "application/pdf" });
  return res.arrayBuffer();
}
