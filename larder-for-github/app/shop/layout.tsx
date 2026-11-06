import { BuyerBar } from "@/components/buyer-bar";
import { requireBuyer } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const s = await requireBuyer();
  const restaurant = await db.restaurant.findUniqueOrThrow({
    where: { id: s.restaurantId },
    select: { name: true, supplier: { select: { name: true } } },
  });
  return (
    <>
      <BuyerBar restaurant={restaurant.name} supplier={restaurant.supplier.name} />
      {children}
    </>
  );
}
