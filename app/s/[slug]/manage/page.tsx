import type { Metadata } from "next";
import { LiveBoard } from "@/components/live-board";
import { getSession } from "@/lib/auth";
import Link from "next/link";
import { loadBoard } from "@/lib/data/orders";
import { storeHeader } from "@/lib/data/stores";
import { MANAGE, requireStorePage } from "@/lib/scope";

export const metadata: Metadata = { title: "Today" };

export default async function TodayPage({ params }: { params: Promise<{ slug: string }> }) {
  const ctx = await requireStorePage((await params).slug, MANAGE);
  const [{ orders, stats }, session, store] = await Promise.all([loadBoard(ctx, "open"), getSession(), storeHeader(ctx)]);
  const first = (session?.name ?? "").split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return (
    <>
      {!store.setupDoneAt && ctx.role === "owner" && (
        <div className="panel panel-pad row-between" style={{ marginBottom: 18, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 650 }}>Finish setting up your store</div>
            <div className="muted" style={{ fontSize: 13 }}>A few questions about what you sell and how your store should look.</div>
          </div>
          <Link className="btn btn-primary" href={`/s/${ctx.slug}/manage/setup`}>Continue setup</Link>
        </div>
      )}
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
    </>
  );
}
