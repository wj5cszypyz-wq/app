import type { Metadata } from "next";
import { requireSupplier } from "@/lib/auth";
import { db } from "@/lib/db";
import { qboConfigured, qboEnvironment } from "@/lib/qbo";
import { QboPanel } from "./qbo-panel";

export const metadata: Metadata = { title: "QuickBooks" };

const RESULT: Record<string, { kind: "success" | "error"; text: string }> = {
  connected: { kind: "success", text: "QuickBooks connected. New orders will become invoices automatically." },
  denied: { kind: "error", text: "Connection cancelled in QuickBooks. Nothing was changed." },
  invalid: { kind: "error", text: "That connection link expired. Click Connect again." },
  failed: { kind: "error", text: "QuickBooks didn't accept the connection. Check your app keys and redirect URI, then try again." },
  missing_keys: { kind: "error", text: "Add your Intuit app keys to .env first (see the steps below)." },
};

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ qbo?: string }> }) {
  const s = await requireSupplier();
  const { qbo } = await searchParams;
  const supplier = await db.supplier.findUniqueOrThrow({ where: { id: s.supplierId } });
  const [syncedCount, waitingCount] = await Promise.all([
    db.order.count({ where: { supplierId: s.supplierId, qboSyncStatus: "synced" } }),
    db.order.count({ where: { supplierId: s.supplierId, qboSyncStatus: { in: ["not_connected", "failed"] }, status: { not: "cancelled" } } }),
  ]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>QuickBooks</h1>
          <p>Connect once. Every order a restaurant places becomes a QuickBooks invoice, with customer and items created for you.</p>
        </div>
      </div>
      <QboPanel
        result={qbo ? RESULT[qbo] ?? null : null}
        configured={qboConfigured()}
        environment={qboEnvironment()}
        connected={Boolean(supplier.qboRealmId)}
        companyName={supplier.qboCompanyName}
        realmId={supplier.qboRealmId}
        refreshExpires={supplier.qboRefreshExpiresAt?.toISOString() ?? null}
        syncedCount={syncedCount}
        waitingCount={waitingCount}
        redirectUri={process.env.QBO_REDIRECT_URI ?? "http://localhost:3000/api/qbo/callback"}
      />
    </>
  );
}
