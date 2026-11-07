import type { Metadata } from "next";
import { LiveBoard } from "@/components/live-board";
import { getSession } from "@/lib/auth";
import { loadBoard } from "@/lib/data/orders";
import { MANAGE, requireStorePage } from "@/lib/scope";

export const metadata: Metadata = { title: "Today" };

export default async function TodayPage({ params }: { params: Promise<{ slug: string }> }) {
  const ctx = await requireStorePage((await params).slug, MANAGE);
  const [{ orders, stats }, session] = await Promise.all([loadBoard(ctx, "open"), getSession()]);
  const first = (session?.name ?? "").split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return (
    <LiveBoard
      initialOrders={orders}
      initialStats={stats}
      initialFilter="open"
      showStats
      title={first ? `${greeting}, ${first}.` : `${greeting}.`}
      subtitle={
        stats.openCount
          ? `${stats.openCount} ${stats.openCount === 1 ? "order" : "orders"} to get ready.`
          : "All caught up. New orders show up here the moment they're placed."
      }
    />
  );
}
