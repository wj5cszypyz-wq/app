import { BuyerBar } from "@/components/buyer-bar";
import { StoreLook } from "@/components/store-look";
import { buyerHeader } from "@/lib/data/storefront";
import { BUY, requireStorePage } from "@/lib/scope";

export default async function ShopLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const ctx = await requireStorePage((await params).slug, BUY);
  const h = await buyerHeader(ctx);
  return (
    <StoreLook look={h.look} accent={h.accent}>
      <BuyerBar customer={h.customerName} store={h.storeName} logoId={h.logoId} />
      {children}
    </StoreLook>
  );
}
