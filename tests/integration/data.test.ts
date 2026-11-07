import { beforeAll, describe, expect, it } from "vitest";
import "../helpers/request";
import { db } from "../../lib/db";
import type { StoreCtx } from "../../lib/scope";
import { makeStore, type StoreFixture } from "../helpers/fixtures";

let a: StoreFixture;
let b: StoreFixture;
let ownerA: StoreCtx;
let buyerAA: StoreCtx; // customer A of store a

const ctx = (f: StoreFixture, role: StoreCtx["role"], userId: string, customerId: string | null = null): StoreCtx => ({
  userId,
  storeId: f.store.id,
  slug: f.store.slug,
  storeName: f.store.name,
  role,
  customerId,
});

beforeAll(async () => {
  a = await makeStore("data-a");
  b = await makeStore("data-b");
  ownerA = ctx(a, "owner", a.owner.id);
  buyerAA = ctx(a, "buyer", a.buyerA.id, a.customerA.id);
});

describe("orders", () => {
  it("owner of a cannot read b's order", async () => {
    const { getOrderForStore } = await import("../../lib/data/orders");
    expect(await getOrderForStore(ownerA, b.orderA.id)).toBeNull();
    expect((await getOrderForStore(ownerA, a.orderA.id))?.id).toBe(a.orderA.id);
  });

  it("buyer cannot read other customer's order", async () => {
    const { getOrderForBuyer } = await import("../../lib/data/orders");
    expect(await getOrderForBuyer(buyerAA, a.orderB.id)).toBeNull();
    expect(await getOrderForBuyer(buyerAA, b.orderA.id)).toBeNull();
    expect((await getOrderForBuyer(buyerAA, a.orderA.id))?.id).toBe(a.orderA.id);
  });

  it("buyer order list holds only their own orders", async () => {
    const { listBuyerOrders } = await import("../../lib/data/orders");
    const ids = (await listBuyerOrders(buyerAA)).map((o) => o.id);
    expect(ids).toEqual([a.orderA.id]);
  });

  it("loadBoard(ctxA) contains only a's orders", async () => {
    const { loadBoard } = await import("../../lib/data/orders");
    const { orders } = await loadBoard(ownerA, "all");
    expect(orders.map((o) => o.id).sort()).toEqual([a.orderA.id, a.orderB.id].sort());
  });

  it("setOrderStatus on b's order returns null and leaves it alone", async () => {
    const { setOrderStatus } = await import("../../lib/data/orders");
    expect(await setOrderStatus(ownerA, b.orderA.id, "delivered")).toBeNull();
    expect((await db.order.findUnique({ where: { id: b.orderA.id } }))?.status).toBe("new");
  });

  it("placeOrder with b's productId is rejected and creates nothing", async () => {
    const { placeOrder } = await import("../../lib/data/orders");
    const before = await db.order.count();
    await expect(placeOrder(buyerAA, { lines: [{ productId: b.product.id, qty: 1 }], deliveryDate: null, notes: null })).rejects.toThrow(
      /no longer available|unknown/i,
    );
    expect(await db.order.count()).toBe(before);
  });

  it("placeOrder uses the buyer's store and customer", async () => {
    const { placeOrder } = await import("../../lib/data/orders");
    const placed = await placeOrder(buyerAA, { lines: [{ productId: a.product.id, qty: 3 }], deliveryDate: null, notes: "hi" });
    const row = await db.order.findUniqueOrThrow({ where: { id: placed.id } });
    expect(row).toMatchObject({ storeId: a.store.id, customerId: a.customerA.id, subtotalCents: 3000 });
  });
});

describe("products", () => {
  it("updateProduct with b's product id returns null and b's product is unchanged", async () => {
    const { updateProduct } = await import("../../lib/data/products");
    expect(await updateProduct(ownerA, b.product.id, { priceCents: 1 })).toBeNull();
    expect((await db.product.findUnique({ where: { id: b.product.id } }))?.priceCents).toBe(1000);
  });

  it("listProducts holds only this store's products", async () => {
    const { listProducts } = await import("../../lib/data/products");
    expect((await listProducts(ownerA)).map((p) => p.id)).toEqual([a.product.id]);
  });

  it("createProduct writes to the ctx store; same SKU allowed in another store", async () => {
    const { createProduct } = await import("../../lib/data/products");
    const p = await createProduct(ownerA, { sku: "SKU-data-b", name: "Shared SKU", category: "Produce", unit: "each", packSize: null, priceCents: 500 });
    expect(p.storeId).toBe(a.store.id);
    await expect(
      createProduct(ownerA, { sku: "SKU-data-b", name: "Dup", category: "Produce", unit: "each", packSize: null, priceCents: 500 }),
    ).rejects.toThrow(/already/);
  });
});

describe("customers", () => {
  it("setCustomerPrices with b's productId is rejected and writes nothing", async () => {
    const { setCustomerPrices } = await import("../../lib/data/customers");
    await expect(setCustomerPrices(ownerA, a.customerA.id, [{ productId: b.product.id, priceCents: 1 }], [])).rejects.toThrow(/unknown product/i);
    expect(await db.customerPrice.count({ where: { productId: b.product.id } })).toBe(0);
  });

  it("setCustomerPrices for b's customer returns null", async () => {
    const { setCustomerPrices } = await import("../../lib/data/customers");
    expect(await setCustomerPrices(ownerA, b.customerA.id, [], [])).toBeNull();
  });

  it("getCustomer for b's customer is null", async () => {
    const { getCustomer } = await import("../../lib/data/customers");
    expect(await getCustomer(ownerA, b.customerA.id)).toBeNull();
  });

  it("createCustomer: same email twice in one store errors; another store may add it too", async () => {
    const { createCustomer } = await import("../../lib/data/customers");
    const input = { name: "Shared Co", contactName: "Pat", email: "pat-shared@test.local", phone: "", address: "" };
    await createCustomer(ownerA, input);
    await expect(createCustomer(ownerA, input)).rejects.toThrow("This email already has access to this store.");
    await createCustomer(ctx(b, "owner", b.owner.id), input);
    expect(await db.customer.count({ where: { email: "pat-shared@test.local" } })).toBe(2);
  });
});

describe("stores", () => {
  it("listMembershipsForUser lists every store the user can use", async () => {
    const { listMembershipsForUser } = await import("../../lib/data/stores");
    expect(await listMembershipsForUser(a.owner.id)).toEqual([{ slug: "data-a", storeName: a.store.name, role: "owner" }]);
  });

  it("listMembershipsForUser hides suspended stores", async () => {
    const { listMembershipsForUser } = await import("../../lib/data/stores");
    await db.store.update({ where: { id: a.store.id }, data: { status: "suspended" } });
    try {
      expect(await listMembershipsForUser(a.owner.id)).toEqual([]);
    } finally {
      await db.store.update({ where: { id: a.store.id }, data: { status: "active" } });
    }
  });
});

describe("role guard inside the data layer", () => {
  it("refuses seller data for a buyer context and buyer data for a seller context", async () => {
    const { loadBoard } = await import("../../lib/data/orders");
    const { loadStorefront } = await import("../../lib/data/storefront");
    await expect(loadBoard(buyerAA, "all")).rejects.toThrow(/seller role/);
    await expect(loadStorefront(ownerA)).rejects.toThrow(/buyer role/);
  });
});
