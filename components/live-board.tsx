"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatMoney } from "@/lib/money";
import type { BoardStats, OrderRow } from "@/lib/data/orders";
import { IconBell } from "./icons";
import { StatusChip, SyncBadge } from "./status";
import { useToast } from "./toast";
import { useStorePaths } from "@/components/use-store";

const POLL_MS = 5000;
const FILTERS = [
  { id: "open", label: "Open" },
  { id: "all", label: "All" },
  { id: "done", label: "Done" },
];

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function day(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

/** Two short tones. Only plays after the user has interacted with the page (browser rule). */
function chime() {
  try {
    const ctx = new AudioContext();
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      o.type = "sine";
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.12);
      g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + i * 0.12 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.12 + 0.35);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.12);
      o.stop(ctx.currentTime + i * 0.12 + 0.4);
    });
  } catch {
    // Audio not available; the toast still shows.
  }
}

export function LiveBoard(props: {
  initialOrders: OrderRow[];
  initialStats: BoardStats;
  initialFilter: string;
  showStats: boolean;
  title: string;
  subtitle: string;
}) {
  const router = useRouter();
  const paths = useStorePaths();
  const notify = useToast();
  const [filter, setFilter] = useState(props.initialFilter);
  const [orders, setOrders] = useState(props.initialOrders);
  const [stats, setStats] = useState(props.initialStats);
  const [online, setOnline] = useState(true);
  const [sound, setSound] = useState(false);
  const [arrived, setArrived] = useState<Set<string>>(new Set());
  const known = useRef(new Set(props.initialOrders.map((o) => o.id)));
  const soundRef = useRef(sound);
  soundRef.current = sound;

  useEffect(() => {
    try {
      setSound(localStorage.getItem("larder_sound") === "1");
    } catch {
      // storage blocked; default off
    }
  }, []);

  const refresh = useCallback(
    async (f: string, announce: boolean) => {
      try {
        const res = await fetch(paths.api(`/manage/orders?filter=${f}`), { cache: "no-store" });
        if (res.status === 401) return router.replace("/login");
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { orders: OrderRow[]; stats: BoardStats };
        const fresh = data.orders.filter((o) => !known.current.has(o.id));
        data.orders.forEach((o) => known.current.add(o.id));
        if (announce && fresh.length) {
          setArrived((prev) => new Set([...prev, ...fresh.map((o) => o.id)]));
          const first = fresh[0];
          notify(
            "info",
            fresh.length === 1 ? `New order #${first.number}` : `${fresh.length} new orders`,
            fresh.length === 1 ? `${first.customer} · ${formatMoney(first.subtotalCents)}` : undefined,
          );
          if (soundRef.current) chime();
          setTimeout(() => setArrived(new Set()), 8000);
        }
        setOrders(data.orders);
        setStats(data.stats);
        setOnline(true);
      } catch {
        setOnline(false);
      }
    },
    [notify, router],
  );

  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") refresh(filter, true);
    }, POLL_MS);
    return () => clearInterval(t);
  }, [filter, refresh]);

  function changeFilter(f: string) {
    setFilter(f);
    refresh(f, false);
  }

  function toggleSound() {
    const next = !sound;
    setSound(next);
    try {
      localStorage.setItem("larder_sound", next ? "1" : "0");
    } catch {
      // ignore
    }
    if (next) chime();
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="row" style={{ gap: 14, marginBottom: 8 }}>
            <span className={`live ${online ? "" : "off"}`}><i />{online ? "Updating live" : "Reconnecting…"}</span>
          </div>
          <h1>{props.title}</h1>
          <p>{props.subtitle}</p>
        </div>
        <div className="row">
          <button className={`btn btn-sm ${sound ? "" : "btn-ghost"}`} onClick={toggleSound} aria-pressed={sound} title="Play a sound when an order arrives">
            <IconBell /> {sound ? "Sound on" : "Sound off"}
          </button>
        </div>
      </div>

      {props.showStats && (
        <div className="stats">
          <div className="panel stat accent">
            <div className="eyebrow">Orders today</div>
            <span className="num">{stats.todayCount}</span>
            <div className="sub">since midnight</div>
          </div>
          <div className="panel stat">
            <div className="eyebrow">Sales today</div>
            <span className="num">{formatMoney(stats.todayRevenueCents)}</span>
            <div className="sub">before tax</div>
          </div>
          <div className="panel stat">
            <div className="eyebrow">To pack &amp; deliver</div>
            <span className="num">{stats.openCount}</span>
            <div className="sub">open orders</div>
          </div>
          <div className={`panel stat ${stats.syncIssues ? "warn" : ""}`}>
            <div className="eyebrow">Invoices needing attention</div>
            <span className="num">{stats.syncIssues}</span>
            <div className="sub">{stats.syncIssues ? "open the order and tap Retry" : "all good"}</div>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">
          <div className="tabs" role="tablist">
            {FILTERS.map((f) => (
              <button key={f.id} className="tab" role="tab" aria-selected={filter === f.id} onClick={() => changeFilter(f.id)}>
                {f.label}
              </button>
            ))}
          </div>
          <span className="muted hide-sm" style={{ fontSize: 12 }}>{orders.length} shown</span>
        </div>

        {orders.length === 0 ? (
          <div className="empty">
            <h3>No orders here</h3>
            <p>New orders appear here the moment a customer places them.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th className="hide-sm">Delivery</th>
                  <th>Status</th>
                  <th className="hide-sm">QuickBooks</th>
                  <th className="right">Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr
                    key={o.id}
                    className={`clickable ${arrived.has(o.id) ? "row-arrive" : ""}`}
                    onClick={() => router.push(paths.manage(`/orders/${o.id}`))}
                  >
                    <td>
                      <Link href={paths.manage(`/orders/${o.id}`)} className="order-no" onClick={(e) => e.stopPropagation()}>
                        <span>#</span>{o.number}
                      </Link>
                      <div className="dim" style={{ fontSize: 11.5 }}>{timeAgo(o.createdAt)}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 550 }}>{o.customer}</div>
                      <div className="dim" style={{ fontSize: 11.5 }}>{o.lineCount} {o.lineCount === 1 ? "item" : "items"}</div>
                    </td>
                    <td className="hide-sm muted">{day(o.deliveryDate)}</td>
                    <td><StatusChip status={o.status} /></td>
                    <td className="hide-sm"><SyncBadge status={o.qboSyncStatus} doc={o.qboDocNumber} /></td>
                    <td className="right num" style={{ fontWeight: 600 }}>{formatMoney(o.subtotalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
