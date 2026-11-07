"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconCart, IconClock } from "./icons";
import { StoreMark } from "./store-look";
import { SignOutButton } from "./sign-out";
import { useStorePaths } from "@/components/use-store";

export function BuyerBar({ customer, store, logoId }: { customer: string; store: string; logoId: string | null }) {
  const path = usePathname();
  const paths = useStorePaths();
  const isHistory = path.startsWith(paths.shop("/orders"));
  return (
    <header className="topbar">
      <Link href={paths.shop()} className="brand">
        <StoreMark name={store} logoId={logoId} />
        <span style={{ minWidth: 0 }}>
          <div className="brand-name">{store}</div>
          <div className="brand-org">{customer}</div>
        </span>
      </Link>
      <nav className="topnav">
        <Link href={paths.shop()} className="nav-link" aria-current={!isHistory ? "page" : undefined}>
          <IconCart /> <span>Order</span>
        </Link>
        <Link href={paths.shop("/orders")} className="nav-link" aria-current={isHistory ? "page" : undefined}>
          <IconClock /> <span>History</span>
        </Link>
      </nav>
      <div className="row" style={{ marginLeft: "auto" }}>
        <Link href="/account" className="muted hide-sm" style={{ fontSize: 13 }} title="Your account">Account</Link>
        <SignOutButton />
      </div>
    </header>
  );
}
