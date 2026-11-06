import type { Metadata } from "next";
import { requireSupplier } from "@/lib/auth";
import { db } from "@/lib/db";
import { CatalogManager } from "./catalog-manager";

export const metadata: Metadata = { title: "Catalog" };

export default async function CatalogPage() {
  const s = await requireSupplier();
  const products = await db.product.findMany({
    where: { supplierId: s.supplierId, active: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: { id: true, sku: true, name: true, category: true, unit: true, packSize: true, priceCents: true, inStock: true },
  });
  return <CatalogManager initial={products} />;
}
