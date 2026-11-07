import type { Metadata } from "next";
import { syncCounts } from "@/lib/data/orders";
import { getStoreForCtx } from "@/lib/data/stores";
import { qboConfigured, qboEnvironment } from "@/lib/qbo";
import { MANAGE, requireStorePage } from "@/lib/scope";
import { QboPanel } from "./qbo-panel";

export const metadata: Metadata = { title: "QuickBooks" };

const RESULT: Record<string, { kind: "success" | "error"; text: string }> = {
  connected: { kind: "success", text: "QuickBooks connected. New orders will become invoices automatically." },
  denied: { kind: "error", text: "Connection cancelled in QuickBooks. Nothing was changed." },
  invalid: { kind: "error", text: "That connection link expired. Click Connect again." },
  failed: { kind: "error", text: "QuickBooks didn't accept the connection. Check your app keys and redirect URI, then try again." },
  missing_keys: { kind: "error", text: "Add your Intuit app keys to .env first (see the steps below)." },
};

export default async function SettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ qbo?: string }>;
}) {
  const ctx = await requireStorePage((await params).slug, MANAGE);
  const { qbo } = await searchParams;
  const [store, counts] = await Promise.all([getStoreForCtx(ctx), syncCounts(ctx)]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>QuickBooks</h1>
          <p>Connect once. Every order a customer places becomes a QuickBooks invoice, with customer and items created for you.</p>
        </div>
      </div>
      <QboPanel
        result={qbo ? RESULT[qbo] ?? null : null}
        isOwner={ctx.role === "owner"}
        configured={qboConfigured()}
        environment={qboEnvironment()}
        connected={Boolean(store.qboRealmId)}
        companyName={store.qboCompanyName}
        realmId={store.qboRealmId}
        refreshExpires={store.qboRefreshExpiresAt?.toISOString() ?? null}
        syncedCount={counts.synced}
        waitingCount={counts.waiting}
        redirectUri={process.env.QBO_REDIRECT_URI ?? "http://localhost:3000/api/qbo/callback"}
      />
    </>
  );
}
