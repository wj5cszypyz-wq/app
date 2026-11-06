// Demo data for local testing: one wholesaler, three restaurants, a catalog, a few past orders.
// Sign in with the one-click demo buttons (DEMO_MODE=true). Demo accounts get a random password
// that is never printed or stored anywhere readable. Refuses to run against production.
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed demo data in production.");
  process.exit(1);
}

const db = new PrismaClient();
const DEMO_PASSWORD = randomBytes(24).toString("base64url");

type P = [sku: string, name: string, category: string, unit: string, pack: string | null, price: number];

const products: P[] = [
  ["PR-101", "Romaine Hearts", "Produce", "case", "24 ct", 38.5],
  ["PR-102", "Roma Tomatoes", "Produce", "case", "25 lb", 31.0],
  ["PR-103", "Yellow Onions, Jumbo", "Produce", "case", "50 lb", 27.75],
  ["PR-104", "Hass Avocados #48", "Produce", "case", "48 ct", 62.0],
  ["PR-105", "Limes #200", "Produce", "case", "40 lb", 34.25],
  ["PR-106", "Cilantro", "Produce", "case", "30 bunch", 22.0],
  ["PR-107", "Garlic, Peeled", "Produce", "lb", "5 lb jar", 4.6],
  ["DY-201", "Whole Milk", "Dairy & Eggs", "case", "4 × 1 gal", 21.4],
  ["DY-202", "Heavy Cream 40%", "Dairy & Eggs", "case", "12 × 1 qt", 48.9],
  ["DY-203", "Unsalted Butter", "Dairy & Eggs", "case", "36 × 1 lb", 139.0],
  ["DY-204", "Large Eggs, Grade AA", "Dairy & Eggs", "case", "15 dozen", 41.25],
  ["DY-205", "Parmigiano Reggiano", "Dairy & Eggs", "lb", "~20 lb wheel cut", 13.8],
  ["MT-301", "Chicken Thighs, Boneless", "Meat & Poultry", "lb", "40 lb case", 3.15],
  ["MT-302", "Ground Beef 80/20", "Meat & Poultry", "lb", "10 lb chub", 4.95],
  ["MT-303", "Pork Shoulder, Bone-in", "Meat & Poultry", "lb", "~8 lb avg", 2.69],
  ["MT-304", "Thick-cut Bacon", "Meat & Poultry", "case", "15 lb", 74.0],
  ["SF-401", "Atlantic Salmon Fillet", "Seafood", "lb", "skin-on", 11.4],
  ["SF-402", "Shrimp 16/20, Raw", "Seafood", "case", "5 × 2 lb", 82.0],
  ["BK-501", "Brioche Buns 4\"", "Bakery", "case", "72 ct", 36.0],
  ["BK-502", "Sourdough Boule", "Bakery", "each", null, 5.25],
  ["DG-601", "All-purpose Flour", "Dry Goods", "each", "50 lb bag", 24.5],
  ["DG-602", "Extra Virgin Olive Oil", "Dry Goods", "each", "3 L tin", 39.0],
  ["DG-603", "Kosher Salt", "Dry Goods", "case", "12 × 3 lb", 29.0],
  ["DG-604", "Canola Fry Oil", "Dry Goods", "each", "35 lb jug", 46.0],
  ["PD-701", "Kraft To-go Box #8", "Paper & Disposables", "case", "300 ct", 58.0],
  ["PD-702", "Nitrile Gloves, L", "Paper & Disposables", "case", "10 × 100", 64.0],
  ["PD-703", "Deli Container 32 oz", "Paper & Disposables", "case", "240 ct", 49.5],
];

async function main() {
  await db.session.deleteMany();
  await db.orderLine.deleteMany();
  await db.order.deleteMany();
  await db.customerPrice.deleteMany();
  await db.user.deleteMany();
  await db.product.deleteMany();
  await db.restaurant.deleteMany();
  await db.supplier.deleteMany();

  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const supplier = await db.supplier.create({
    data: {
      name: "Harbor Fresh Provisions",
      phone: "(555) 010-2200",
      email: "orders@harborfresh.test",
      address: "1200 Market Row, Dock 4",
    },
  });

  await db.user.create({
    data: { email: "ops@harborfresh.test", name: "Dana Ortiz", passwordHash: hash, role: "supplier", supplierId: supplier.id },
  });

  const restaurants = await Promise.all(
    [
      { name: "Juniper Bistro", contactName: "Sam Reyes", email: "chef@juniperbistro.test", phone: "(555) 010-3300", address: "48 Alder St" },
      { name: "Casa Lumbre", contactName: "Ivy Moreno", email: "kitchen@casalumbre.test", phone: "(555) 010-4400", address: "915 Grand Ave" },
      { name: "Noodle Bar 88", contactName: "Ken Ito", email: "ken@noodlebar88.test", phone: "(555) 010-5500", address: "88 Harbor Blvd" },
    ].map((r) => db.restaurant.create({ data: { ...r, supplierId: supplier.id } })),
  );

  for (const r of restaurants) {
    await db.user.create({
      data: {
        email: r.email!,
        name: r.contactName!,
        passwordHash: hash,
        role: "buyer",
        supplierId: supplier.id,
        restaurantId: r.id,
      },
    });
  }

  const created = [];
  for (const [sku, name, category, unit, packSize, price] of products) {
    created.push(
      await db.product.create({
        data: { supplierId: supplier.id, sku, name, category, unit, packSize, priceCents: Math.round(price * 100) },
      }),
    );
  }
  const bySku = new Map(created.map((p) => [p.sku, p]));
  await db.product.update({ where: { id: bySku.get("SF-402")!.id }, data: { inStock: false } });

  // Juniper Bistro has negotiated prices on a few staples.
  for (const [sku, price] of [["PR-101", 35.0], ["DY-203", 129.0], ["MT-301", 2.95]] as const) {
    await db.customerPrice.create({
      data: { restaurantId: restaurants[0].id, productId: bySku.get(sku)!.id, priceCents: Math.round(price * 100) },
    });
  }

  const history: [number, number, string, [string, number][]][] = [
    // [restaurant index, hours ago, status, lines]
    [1, 50, "delivered", [["PR-104", 2], ["PR-105", 1], ["PR-106", 2], ["MT-303", 24.5]]],
    [2, 28, "delivered", [["MT-301", 40], ["DG-604", 2], ["PD-703", 1]]],
    [0, 3, "packing", [["PR-101", 3], ["DY-203", 1], ["DY-204", 2], ["BK-502", 12]]],
  ];
  let number = 1001;
  for (const [ri, hoursAgo, status, lines] of history) {
    const r = restaurants[ri];
    const overrides = new Map(
      (await db.customerPrice.findMany({ where: { restaurantId: r.id } })).map((c) => [c.productId, c.priceCents]),
    );
    const built = lines.map(([sku, qty]) => {
      const p = bySku.get(sku)!;
      const unitPriceCents = overrides.get(p.id) ?? p.priceCents;
      return {
        productId: p.id,
        name: p.name,
        sku: p.sku,
        unit: p.unit,
        packSize: p.packSize,
        qty,
        unitPriceCents,
        lineTotalCents: Math.round(qty * unitPriceCents),
      };
    });
    const createdAt = new Date(Date.now() - hoursAgo * 3_600_000);
    await db.order.create({
      data: {
        supplierId: supplier.id,
        restaurantId: r.id,
        number: number++,
        status,
        createdAt,
        deliveryDate: new Date(createdAt.getTime() + 24 * 3_600_000),
        subtotalCents: built.reduce((s, l) => s + l.lineTotalCents, 0),
        qboSyncStatus: "not_connected",
        lines: { create: built },
      },
    });
  }

  console.log("Seeded demo data. Use the one-click demo buttons on the sign-in page.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
