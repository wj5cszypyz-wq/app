import type { Metadata } from "next";
import { LiveBoard } from "@/components/live-board";
import { loadBoard } from "@/lib/data/orders";
import { MANAGE, requireStorePage } from "@/lib/scope";

export const metadata: Metadata = { title: "Orders" };

export default async function OrdersPage({ params }: { params: Promise<{ slug: string }> }) {
  const ctx = await requireStorePage((await params).slug, MANAGE);
  const { orders, stats } = await loadBoard(ctx, "all");
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
