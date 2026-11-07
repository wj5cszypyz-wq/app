import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { loadStorefront, orderAgainProductIds, storefrontCategories, storefrontIntro } from "@/lib/data/storefront";
import { isoDate } from "@/lib/orders";
import { BUY, requireStorePage } from "@/lib/scope";
import { Storefront } from "./storefront";

export const metadata: Metadata = { title: "Order" };

export default async function ShopPage({ params }: { params: Promise<{ slug: string }> }) {
  const ctx = await requireStorePage((await params).slug, BUY);
  const [products, usualIds, session, cats, intro] = await Promise.all([
    loadStorefront(ctx),
    orderAgainProductIds(ctx),
    getSession(),
    storefrontCategories(ctx),
    storefrontIntro(ctx),
  ]);
  const tomorrow = new Date(Date.now() + 86_400_000);
  return (
    <Storefront
      cartKey={ctx.customerId!}
      firstName={(session?.name ?? "").split(" ")[0]}
      products={products}
      usualIds={usualIds}
      today={isoDate(new Date())}
      defaultDelivery={isoDate(tomorrow)}
      categoryOrder={cats.map((c) => c.name)}
      icons={Object.fromEntries(cats.map((c) => [c.name, c.emoji]))}
      about={intro.about}
      bannerId={intro.bannerId}
      fulfillment={intro.fulfillment}
    />
  );
}
