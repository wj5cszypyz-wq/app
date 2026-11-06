import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconBack } from "@/components/icons";
import { requireSupplier } from "@/lib/auth";
import { db } from "@/lib/db";
import { PriceEditor } from "./price-editor";

export const metadata: Metadata = { title: "Customer pricing" };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireSupplier();
  const { id } = await params;
  const restaurant = await db.restaurant.findFirst({ where: { id, supplierId: s.supplierId }, include: { prices: true } });
  if (!restaurant) notFound();

  const products = await db.product.findMany({
    where: { supplierId: s.supplierId, active: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: { id: true, sku: true, name: true, category: true, unit: true, packSize: true, priceCents: true },
  });
  const custom = Object.fromEntries(restaurant.prices.map((p) => [p.productId, p.priceCents]));

  return (
    <>
      <Link href="/supplier/customers" className="btn btn-ghost btn-sm" style={{ marginBottom: 14, marginLeft: -10 }}>
        <IconBack /> Customers
      </Link>
      <div className="page-head">
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Customer pricing</div>
          <h1>{restaurant.name}</h1>
          <p>
            {[restaurant.contactName, restaurant.email, restaurant.phone].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>
      <PriceEditor restaurantId={restaurant.id} products={products} custom={custom} />
    </>
  );
}
