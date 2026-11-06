import { SupplierShell } from "@/components/supplier-shell";
import { requireSupplier } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function SupplierLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSupplier();
  const supplier = await db.supplier.findUnique({
    where: { id: s.supplierId },
    select: { name: true, qboRealmId: true, qboCompanyName: true },
  });
  return (
    <SupplierShell
      userName={s.name}
      orgName={supplier?.name ?? ""}
      qboConnected={Boolean(supplier?.qboRealmId)}
      qboCompany={supplier?.qboCompanyName ?? null}
    >
      {children}
    </SupplierShell>
  );
}
