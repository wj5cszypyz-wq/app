import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconBack } from "@/components/icons";
import { getCustomer } from "@/lib/data/customers";
import { listProducts } from "@/lib/data/products";
import { MANAGE, requireStorePage } from "@/lib/scope";
import { PriceEditor } from "./price-editor";

export const metadata: Metadata = { title: "Customer pricing" };

export default async function CustomerPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const ctx = await requireStorePage(slug, MANAGE);
  const [customer, products] = await Promise.all([getCustomer(ctx, id), listProducts(ctx)]);
  if (!customer) notFound();
  const custom = Object.fromEntries(customer.prices.map((p) => [p.productId, p.priceCents]));

  return (
    <>
      <Link href={`/s/${ctx.slug}/manage/customers`} className="btn btn-ghost btn-sm" style={{ marginBottom: 14, marginLeft: -10 }}>
        <IconBack /> Customers
      </Link>
      <div className="page-head">
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Customer pricing</div>
          <h1>{customer.name}</h1>
          <p>
            {[customer.contactName, customer.email, customer.phone].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>
      <PriceEditor customerId={customer.id} products={products} custom={custom} />
    </>
  );
}
