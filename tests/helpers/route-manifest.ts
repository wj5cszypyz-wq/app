// Every store API route, with the roles allowed to use it. The static guard test fails if a route is missing.
import type { Role } from "../../lib/scope";
import type { StoreFixture } from "./fixtures";
import { imageForm, PNG_1X1 } from "./images";

export type Ids = { order: string; product: string; customer: string; staffUser: string; request: string };

export type RouteCase = {
  file: string; // relative to app/api/s/[slug]
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  path: (ids: Ids) => string;
  params: (ids: Ids) => Record<string, string>;
  body?: (f: StoreFixture) => unknown;
  form?: () => FormData;
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
  { file: "manage/products/route.ts", method: "POST", path: () => "manage/products", params: () => ({}), body: () => ({ sku: `NEW-${++n}`, name: "New thing", category: "General", unitKind: "count", unit: "each", price: "4.50" }), roles: MANAGE, okStatus: [201] },
  { file: "manage/categories/route.ts", method: "GET", path: () => "manage/categories", params: () => ({}), roles: MANAGE, okStatus: [200] },
  { file: "manage/categories/route.ts", method: "POST", path: () => "manage/categories", params: () => ({}), body: () => ({ name: `Cat ${++n}`, emoji: "🧪" }), roles: MANAGE, okStatus: [201] },
  { file: "manage/products/[id]/route.ts", method: "PATCH", path: (i) => `manage/products/${i.product}`, params: (i) => ({ id: i.product }), body: () => ({ price: "12.00" }), roles: MANAGE, okStatus: [200] },
  { file: "manage/customers/route.ts", method: "POST", path: () => "manage/customers", params: () => ({}), body: () => ({ name: `Cust ${++n}`, contactName: "Al", email: `new-${++n}@test.local` }), roles: MANAGE, okStatus: [201] },
  { file: "manage/customers/[id]/invite/route.ts", method: "POST", path: (i) => `manage/customers/${i.customer}/invite`, params: (i) => ({ id: i.customer }), roles: MANAGE, okStatus: [200, 400] },
  { file: "manage/requests/[id]/route.ts", method: "POST", path: (i) => `manage/requests/${i.request}`, params: (i) => ({ id: i.request }), body: () => ({ action: "decline" }), roles: MANAGE, okStatus: [200] },
  { file: "manage/store/route.ts", method: "PATCH", path: () => "manage/store", params: () => ({}), body: () => ({ allowAccountRequests: true }), roles: ["owner"], okStatus: [200] },
  { file: "manage/uploads/route.ts", method: "POST", path: () => "manage/uploads", params: () => ({}), form: () => imageForm(PNG_1X1), roles: MANAGE, okStatus: [201] },
  { file: "manage/staff/route.ts", method: "POST", path: () => "manage/staff", params: () => ({}), body: () => ({ email: `staff-${++n}@test.local` }), roles: ["owner"], okStatus: [201] },
  { file: "manage/staff/[userId]/route.ts", method: "DELETE", path: (i) => `manage/staff/${i.staffUser}`, params: (i) => ({ userId: i.staffUser }), roles: ["owner"], okStatus: [200] },
  { file: "manage/customers/[id]/prices/route.ts", method: "PUT", path: (i) => `manage/customers/${i.customer}/prices`, params: (i) => ({ id: i.customer }), body: (f) => ({ prices: [{ productId: f.product.id, price: "9.00" }] }), roles: MANAGE, okStatus: [200] },
  { file: "manage/qbo/connect/route.ts", method: "GET", path: () => "manage/qbo/connect", params: () => ({}), roles: ["owner"], okStatus: [307] },
  { file: "manage/qbo/disconnect/route.ts", method: "POST", path: () => "manage/qbo/disconnect", params: () => ({}), roles: ["owner"], okStatus: [200] },
  { file: "orders/route.ts", method: "POST", path: () => "orders", params: () => ({}), body: (f) => ({ lines: [{ productId: f.product.id, qty: 1 }] }), roles: ["buyer"], okStatus: [201] },
];

