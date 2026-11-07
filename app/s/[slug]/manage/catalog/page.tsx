import type { Metadata } from "next";
import { listProducts } from "@/lib/data/products";
import { MANAGE, requireStorePage } from "@/lib/scope";
import { CatalogManager } from "./catalog-manager";

export const metadata: Metadata = { title: "Products" };

export default async function CatalogPage({ params }: { params: Promise<{ slug: string }> }) {
  const ctx = await requireStorePage((await params).slug, MANAGE);
  return <CatalogManager initial={await listProducts(ctx)} />;
}
