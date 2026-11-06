import { STATUS_LABEL, type OrderStatus } from "@/lib/catalog";
import { IconAlert, IconCheck, IconLink, IconSync } from "./icons";

export function StatusChip({ status }: { status: string }) {
  return <span className={`chip chip-${status}`}>{STATUS_LABEL[status as OrderStatus] ?? status}</span>;
}

const SYNC: Record<string, { label: string; icon: typeof IconCheck }> = {
  synced: { label: "In QuickBooks", icon: IconCheck },
  pending: { label: "Sending…", icon: IconSync },
  failed: { label: "Sync failed", icon: IconAlert },
  not_connected: { label: "Not connected", icon: IconLink },
};

export function SyncBadge({ status, doc }: { status: string; doc?: string | null }) {
  const s = SYNC[status] ?? SYNC.pending;
  const Icon = s.icon;
  return (
    <span className={`sync sync-${status}`}>
      <Icon />
      {status === "synced" && doc ? <span className="mono">{doc}</span> : s.label}
    </span>
  );
}

export function Spinner() {
  return <span className="spin" aria-hidden />;
}
