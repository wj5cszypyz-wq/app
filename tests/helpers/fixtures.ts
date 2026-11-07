// Builds a complete store for tests: owner, staff, two customers each with a buyer login,
// one product and one order per customer. Every login gets a real session token.
import { db } from "../../lib/db";
import { createSession } from "../../lib/session";

let seq = 0;

export async function makeStore(slug: string) {
  const n = ++seq;
  const store = await db.store.create({ data: { slug, name: `Store ${slug}` } });
  const user = (label: string) =>
    db.user.create({ data: { email: `${label}-${slug}-${n}@test.local`.toLowerCase(), name: `${label} ${slug}`, passwordHash: "x" } });

  const [owner, staff, buyerA, buyerB] = await Promise.all([user("owner"), user("staff"), user("buyerA"), user("buyerB")]);
  const customerA = await db.customer.create({ data: { storeId: store.id, name: `Customer A ${slug}` } });
  const customerB = await db.customer.create({ data: { storeId: store.id, name: `Customer B ${slug}` } });

  await db.membership.createMany({
    data: [
      { userId: owner.id, storeId: store.id, role: "owner" },
      { userId: staff.id, storeId: store.id, role: "staff" },
      { userId: buyerA.id, storeId: store.id, role: "buyer", customerId: customerA.id },
      { userId: buyerB.id, storeId: store.id, role: "buyer", customerId: customerB.id },
    ],
  });

  const product = await db.product.create({
    data: { storeId: store.id, sku: `SKU-${slug}`.toUpperCase(), name: `Product ${slug}`, category: "General", unit: "each", priceCents: 1000 },
  });

  const order = (customerId: string, number: number) =>
    db.order.create({
      data: {
        storeId: store.id,
        customerId,
        number,
        subtotalCents: 2000,
        lines: {
          create: [{ productId: product.id, name: product.name, sku: product.sku, unit: "each", qty: 2, unitPriceCents: 1000, lineTotalCents: 2000 }],
        },
      },
    });
  const orderA = await order(customerA.id, 1001);
  const orderB = await order(customerB.id, 1002);

  const accountRequest = await db.accountRequest.create({
    data: { storeId: store.id, businessName: `Req ${slug}`, contactName: "Req", email: `req-${slug}-${n}@test.local` },
  });

  const importBatch = await db.importBatch.create({ data: { storeId: store.id, kind: "items" } });

  const tokens = {
    owner: await createSession(owner.id),
    staff: await createSession(staff.id),
    buyerA: await createSession(buyerA.id),
    buyerB: await createSession(buyerB.id),
  };

  return { store, owner, staff, buyerA, buyerB, customerA, customerB, product, orderA, orderB, accountRequest, importBatch, tokens };
}

export type StoreFixture = Awaited<ReturnType<typeof makeStore>>;
