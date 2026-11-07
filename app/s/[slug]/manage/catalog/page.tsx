import type { Metadata } from "next";
import { listCategories } from "@/lib/data/categories";
import { listProducts } from "@/lib/data/products";
import { MANAGE, requireStorePage } from "@/lib/scope";
import { isUnitKind, type UnitKind } from "@/lib/units";
import { CatalogManager } from "./catalog-manager";

export const metadata: Metadata = { title: "Products" };

export default async function CatalogPage({ params }: { params: Promise<{ slug: string }> }) {
  const ctx = await requireStorePage((await params).slug, MANAGE);
  const [products, categories] = await Promise.all([listProducts(ctx), listCategories(ctx)]);
  // New products start as the kind this store sells most.
  const tally = new Map<string, number>();
  products.forEach((p) => tally.set(p.unitKind, (tally.get(p.unitKind) ?? 0) + 1));
  const top = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const defaultKind: UnitKind = top && isUnitKind(top) ? top : "count";
  return (
    <CatalogManager
      initial={products}
      categories={categories.map((c) => ({ id: c.id, name: c.name, emoji: c.emoji }))}
      defaultKind={defaultKind}
    />
  );
}
