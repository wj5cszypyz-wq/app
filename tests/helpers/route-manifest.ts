// Every store API route, with the roles allowed to use it. The static guard test fails if a route is missing.
import type { Role } from "../../lib/scope";
import type { StoreFixture } from "./fixtures";

export type Ids = { order: string; product: string; customer: string };

export type RouteCase = {
  file: string; // relative to app/api/s/[slug]
  method: "GET" | "POST" | "PATCH" | "PUT";
  path: (ids: Ids) => string;
  params: (ids: Ids) => Record<string, string>;
  body?: (f: StoreFixture) => unknown;
  roles: Role[];
  okStatus: number[];
};

let n = 0;
const MANAGE: Role[] = ["owner", "staff"];

export const ROUTES: RouteCase[] = [
  { file: "manage/orders/route.ts", method: "GET", path: () => "manage/orders?filter=all", params: () => ({}), roles: MANAGE, okStatus: [200] },
  { file: "manage/orders/[id]/route.ts", method: "PATCH", path: (i) => `manage/orders/${i.order}`, params: (i) => ({ id: i.order }), body: () => ({ status: "packing" }), roles: MANAGE, okStatus: [200] },
  { file: "manage/orders/[id]/sync/route.ts", method: "POST", path: (i) => `manage/orders/${i.order}/sync`, params: (i) => ({ id: i.order }), roles: MANAGE, okStatus: [200] },
  { file: "manage/orders/[id]/invoice-pdf/route.ts", method: "GET", path: (i) => `manage/orders/${i.order}/invoice-pdf`, params: (i) => ({ id: i.order }), roles: MANAGE, okStatus: [409] },
  { file: "manage/products/route.ts", method: "POST", path: () => "manage/products", params: () => ({}), body: () => ({ sku: `NEW-${++n}`, name: "New thing", category: "Produce", unit: "each", price: "4.50" }), roles: MANAGE, okStatus: [201] },
  { file: "manage/products/[id]/route.ts", method: "PATCH", path: (i) => `manage/products/${i.product}`, params: (i) => ({ id: i.product }), body: () => ({ price: "12.00" }), roles: MANAGE, okStatus: [200] },
  { file: "manage/customers/route.ts", method: "POST", path: () => "manage/customers", params: () => ({}), body: () => ({ name: `Cust ${++n}`, contactName: "Al", email: `new-${++n}@test.local`, password: "temp-pass-123" }), roles: MANAGE, okStatus: [201] },
  { file: "manage/customers/[id]/prices/route.ts", method: "PUT", path: (i) => `manage/customers/${i.customer}/prices`, params: (i) => ({ id: i.customer }), body: (f) => ({ prices: [{ productId: f.product.id, price: "9.00" }] }), roles: MANAGE, okStatus: [200] },
  { file: "manage/qbo/connect/route.ts", method: "GET", path: () => "manage/qbo/connect", params: () => ({}), roles: ["owner"], okStatus: [307] },
  { file: "manage/qbo/disconnect/route.ts", method: "POST", path: () => "manage/qbo/disconnect", params: () => ({}), roles: ["owner"], okStatus: [200] },
  { file: "orders/route.ts", method: "POST", path: () => "orders", params: () => ({}), body: (f) => ({ lines: [{ productId: f.product.id, qty: 1 }] }), roles: ["buyer"], okStatus: [201] },
];

