import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { IconMark } from "@/components/icons";
import { SignOutButton } from "@/components/sign-out";
import { getSession } from "@/lib/auth";
import { APP_NAME } from "@/lib/brand";
import { listMembershipsForUser } from "@/lib/data/stores";

export const metadata: Metadata = { title: "Your stores" };

const ROLE_LABEL = { owner: "Seller · owner", staff: "Seller · staff", buyer: "Customer" } as const;

export default async function StoresPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/stores");
  const stores = await listMembershipsForUser(session.userId);

  return (
    <div className="main" style={{ maxWidth: 640, margin: "0 auto" }}>
      <div className="row-between" style={{ marginBottom: 24 }}>
        <div className="brand" style={{ padding: 0 }}>
          <span className="brand-mark"><IconMark /></span>
          <span className="brand-name">{APP_NAME}</span>
        </div>
        <SignOutButton />
      </div>
      <div className="page-head">
        <div>
          <h1>Choose a store</h1>
          <p>Signed in as {session.name}.</p>
        </div>
      </div>
      {stores.length === 0 ? (
        <div className="panel empty">
          <h3>You don&apos;t have access to any store yet.</h3>
          <p>Ask the store that invited you to send a new invite.</p>
        </div>
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          {stores.map((s) => (
            <Link
              key={s.slug}
              href={s.role === "buyer" ? `/s/${s.slug}` : `/s/${s.slug}/manage`}
              className="panel panel-pad row-between store-pick"
            >
              <span style={{ fontWeight: 650, minWidth: 0, overflowWrap: "anywhere" }}>{s.storeName}</span>
              <span className="muted" style={{ fontSize: 13, flexShrink: 0 }}>{ROLE_LABEL[s.role]}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
