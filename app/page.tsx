import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listMembershipsForUser } from "@/lib/data/stores";

export default async function Home() {
  const s = await getSession();
  if (!s) redirect("/login");
  const stores = await listMembershipsForUser(s.userId);
  if (stores.length === 1) {
    const only = stores[0];
    redirect(only.role === "buyer" ? `/s/${only.slug}` : `/s/${only.slug}/manage`);
  }
  redirect("/stores");
}
