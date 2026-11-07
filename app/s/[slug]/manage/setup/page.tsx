import type { Metadata } from "next";
import { getProfile } from "@/lib/data/store-profile";
import { listProducts } from "@/lib/data/products";
import { listCustomers } from "@/lib/data/customers";
import { MANAGE, requireStorePage } from "@/lib/scope";
import { SetupForm } from "./setup-form";

export const metadata: Metadata = { title: "Store setup" };

export default async function SetupPage({ params }: { params: Promise<{ slug: string }> }) {
  const ctx = await requireStorePage((await params).slug, MANAGE);
  const [profile, products, customers] = await Promise.all([getProfile(ctx), listProducts(ctx), listCustomers(ctx)]);
  let kinds: string[] = [];
  try {
    kinds = profile.unitKinds ? JSON.parse(profile.unitKinds) : [];
  } catch {
    kinds = [];
  }
  return (
    <SetupForm
      isOwner={ctx.role === "owner"}
      profile={{
        name: profile.name,
        niche: profile.niche ?? "",
        about: profile.about ?? "",
        phone: profile.phone ?? "",
        email: profile.email ?? "",
        address: profile.address ?? "",
        look: profile.look,
        accent: profile.accent,
        logoId: profile.logoId,
        bannerId: profile.bannerId,
        fulfillment: profile.fulfillment,
        unitKinds: kinds,
        done: Boolean(profile.setupDoneAt),
      }}
      counts={{ products: products.length, customers: customers.length, qbo: Boolean(profile.qboRealmId) }}
    />
  );
}
