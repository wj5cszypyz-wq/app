// Demo data for local testing: two separate stores (a produce wholesaler and a lamp maker), each with
// staff, customers, a catalog and a few past orders.
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

const produce: P[] = [
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

const lamps: P[] = [
  ["FL-100", "Arc Floor Lamp, Brushed Brass", "Floor lamps", "each", null, 180.0],
  ["FL-110", "Tripod Floor Lamp, Walnut", "Floor lamps", "each", null, 145.0],
  ["DK-200", "Banker's Desk Lamp, Green Glass", "Desk lamps", "each", null, 95.0],
  ["DK-210", "Swing-arm Desk Lamp, Matte Black", "Desk lamps", "each", null, 68.0],
  ["PD-300", "Globe Pendant, Opal Glass 12\"", "Pendants", "each", null, 140.0],
  ["PD-310", "Dome Pendant, Spun Aluminum", "Pendants", "each", null, 118.0],
  ["SH-400", "Linen Drum Shade 14\"", "Shades", "each", null, 34.0],
  ["SH-410", "Pleated Paper Shade, case", "Shades", "case", "6 ct", 120.0],
];

type CustomerSeed = { name: string; contactName: string; email: string; phone: string; address: string };
type History = [customerIndex: number, hoursAgo: number, status: string, lines: [string, number][]][];

async function seedStore(opts: {
  slug: string;
  name: string;
  niche: string;
  contact: { phone: string; email: string; address: string };
  owner: { email: string; name: string };
  staff: { email: string; name: string };
  customers: CustomerSeed[];
  products: P[];
  outOfStock: string[];
  specialPrices: [sku: string, price: number][];
  history: History;
  hash: string;
}) {
  const store = await db.store.create({
    data: { slug: opts.slug, name: opts.name, niche: opts.niche, ...opts.contact },
  });

  for (const [u, role] of [[opts.owner, "owner"], [opts.staff, "staff"]] as const) {
    await db.user.create({
      data: { ...u, passwordHash: opts.hash, memberships: { create: { storeId: store.id, role } } },
    });
  }

  const customers = [];
  for (const c of opts.customers) {
    const customer = await db.customer.create({ data: { ...c, storeId: store.id } });
    await db.user.create({
      data: {
        email: c.email,
        name: c.contactName,
        passwordHash: opts.hash,
        memberships: { create: { storeId: store.id, role: "buyer", customerId: customer.id } },
      },
    });
    customers.push(customer);
  }

  const bySku = new Map<string, Awaited<ReturnType<typeof db.product.create>>>();
  for (const [sku, name, category, unit, packSize, price] of opts.products) {
    bySku.set(
      sku,
      await db.product.create({
        data: { storeId: store.id, sku, name, category, unit, packSize, priceCents: Math.round(price * 100) },
      }),
    );
  }
  for (const sku of opts.outOfStock) {
    await db.product.update({ where: { id: bySku.get(sku)!.id }, data: { inStock: false } });
  }
  for (const [sku, price] of opts.specialPrices) {
    await db.customerPrice.create({
      data: { customerId: customers[0].id, productId: bySku.get(sku)!.id, priceCents: Math.round(price * 100) },
    });
  }

  let number = 1001;
  for (const [ci, hoursAgo, status, lines] of opts.history) {
    const c = customers[ci];
    const overrides = new Map(
      (await db.customerPrice.findMany({ where: { customerId: c.id } })).map((x) => [x.productId, x.priceCents]),
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
        storeId: store.id,
        customerId: c.id,
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
}

async function main() {
  await db.session.deleteMany();
  await db.orderLine.deleteMany();
  await db.order.deleteMany();
  await db.customerPrice.deleteMany();
  await db.membership.deleteMany();
  await db.user.deleteMany();
  await db.product.deleteMany();
  await db.customer.deleteMany();
  await db.store.deleteMany();

  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);

  await seedStore({
    slug: "harbor-fresh",
    name: "Harbor Fresh Provisions",
    niche: "Produce and kitchen supplies",
    contact: { phone: "(555) 010-2200", email: "orders@harborfresh.test", address: "1200 Market Row, Dock 4" },
    owner: { email: "ops@harborfresh.test", name: "Dana Ortiz" },
    staff: { email: "warehouse@harborfresh.test", name: "Luis Park" },
    customers: [
      { name: "Juniper Bistro", contactName: "Sam Reyes", email: "chef@juniperbistro.test", phone: "(555) 010-3300", address: "48 Alder St" },
      { name: "Casa Lumbre", contactName: "Ivy Moreno", email: "kitchen@casalumbre.test", phone: "(555) 010-4400", address: "915 Grand Ave" },
      { name: "Noodle Bar 88", contactName: "Ken Ito", email: "ken@noodlebar88.test", phone: "(555) 010-5500", address: "88 Harbor Blvd" },
    ],
    products: produce,
    outOfStock: ["SF-402"],
    specialPrices: [["PR-101", 35.0], ["DY-203", 129.0], ["MT-301", 2.95]],
    history: [
      [1, 50, "delivered", [["PR-104", 2], ["PR-105", 1], ["PR-106", 2], ["MT-303", 24.5]]],
      [2, 28, "delivered", [["MT-301", 40], ["DG-604", 2], ["PD-703", 1]]],
      [0, 3, "packing", [["PR-101", 3], ["DY-203", 1], ["DY-204", 2], ["BK-502", 12]]],
    ],
    hash,
  });

  await seedStore({
    slug: "brightline",
    name: "Brightline Lamps",
    niche: "Lamps and lampshades",
    contact: { phone: "(555) 010-7700", email: "hello@brightline.test", address: "77 Foundry Lane" },
    owner: { email: "maker@brightline.test", name: "Rosa Chen" },
    staff: { email: "studio@brightline.test", name: "Theo Grant" },
    customers: [
      { name: "Oak & Ember Home", contactName: "Priya Nair", email: "buyer@oakember.test", phone: "(555) 010-8800", address: "310 Elm Court" },
      { name: "Hotel Marlow", contactName: "Jon Avery", email: "purchasing@hotelmarlow.test", phone: "(555) 010-9900", address: "1 Marlow Square" },
    ],
    products: lamps,
    outOfStock: ["FL-110"],
    specialPrices: [["FL-100", 165.0], ["SH-400", 30.0]],
    history: [
      [1, 70, "delivered", [["PD-300", 12], ["SH-410", 2]]],
      [0, 5, "new", [["FL-100", 2], ["DK-200", 4], ["SH-400", 6]]],
    ],
    hash,
  });

  console.log("Seeded demo data. Use the one-click demo buttons on the sign-in page.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
