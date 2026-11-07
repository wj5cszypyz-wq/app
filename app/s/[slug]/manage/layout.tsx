import { StoreLook } from "@/components/store-look";
import { SupplierShell } from "@/components/supplier-shell";
import { VerifyBanner } from "@/components/verify-banner";
import { getSession } from "@/lib/auth";
import { storeHeader } from "@/lib/data/stores";
import { MANAGE, requireStorePage } from "@/lib/scope";

export default async function ManageLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const ctx = await requireStorePage((await params).slug, MANAGE);
  const [store, session] = await Promise.all([storeHeader(ctx), getSession()]);
  return (
    <StoreLook look={store.look} accent={store.accent}>
      <SupplierShell
        userName={session?.name ?? ""}
        orgName={store.name}
        qboConnected={Boolean(store.qboRealmId)}
        qboCompany={store.qboCompanyName ?? null}
        logoId={store.logoId}
      >
        {store.status === "unverified" && <VerifyBanner isOwner={ctx.role === "owner"} />}
        {children}
      </SupplierShell>
    </StoreLook>
  );
}
