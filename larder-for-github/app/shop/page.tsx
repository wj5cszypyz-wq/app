import type { Metadata } from "next";
import { requireBuyer } from "@/lib/auth";
import { db } from "@/lib/db";
import { isoDate } from "@/lib/orders";
import { loadStorefront } from "@/lib/queries";
import { Storefront } from "./storefront";

export const metadata: Metadata = { title: "Order" };

export default async function ShopPage() {
  const s = await requireBuyer();
  const [products, recent] = await Promise.all([
    loadStorefront(s.supplierId, s.restaurantId),
    db.orderLine.findMany({
      where: { order: { restaurantId: s.restaurantId } },
      select: { productId: true },
      distinct: ["productId"],
      take: 40,
      orderBy: { order: { createdAt: "desc" } },
    }),
  ]);
  const tomorrow = new Date(Date.now() + 86_400_000);
  return (
    <Storefront
      restaurantId={s.restaurantId}
      firstName={s.name.split(" ")[0]}
      products={products}
      usualIds={recent.map((r) => r.productId)}
      today={isoDate(new Date())}
      defaultDelivery={isoDate(tomorrow)}
    />
  );
}
