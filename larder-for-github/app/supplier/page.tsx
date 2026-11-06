import type { Metadata } from "next";
import { LiveBoard } from "@/components/live-board";
import { requireSupplier } from "@/lib/auth";
import { loadBoard } from "@/lib/queries";

export const metadata: Metadata = { title: "Today" };

export default async function CommandPage() {
  const s = await requireSupplier();
  const { orders, stats } = await loadBoard(s.supplierId, "open");
  const first = s.name.split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return (
    <LiveBoard
      initialOrders={orders}
      initialStats={stats}
      initialFilter="open"
      showStats
      title={`${greeting}, ${first}.`}
      subtitle={
        stats.openCount
          ? `${stats.openCount} ${stats.openCount === 1 ? "order" : "orders"} to pack and deliver.`
          : "All caught up. New orders show up here the moment they're placed."
      }
    />
  );
}
