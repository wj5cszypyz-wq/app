import type { Metadata } from "next";
import { LiveBoard } from "@/components/live-board";
import { requireSupplier } from "@/lib/auth";
import { loadBoard } from "@/lib/queries";

export const metadata: Metadata = { title: "Orders" };

export default async function OrdersPage() {
  const s = await requireSupplier();
  const { orders, stats } = await loadBoard(s.supplierId, "all");
  return (
    <LiveBoard
      initialOrders={orders}
      initialStats={stats}
      initialFilter="all"
      showStats={false}
      title="All orders"
      subtitle="Every order, where it is, and its QuickBooks invoice."
    />
  );
}
