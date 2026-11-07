"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAME } from "@/lib/brand";
import { IconCart, IconClock, IconMark } from "./icons";
import { SignOutButton } from "./sign-out";
import { useStorePaths } from "@/components/use-store";

export function BuyerBar({ customer, store }: { customer: string; store: string }) {
  const path = usePathname();
  const paths = useStorePaths();
  const isHistory = path.startsWith(paths.shop("/orders"));
  return (
    <header className="topbar">
      <Link href={paths.shop()} className="brand">
        <span className="brand-mark"><IconMark /></span>
        <span>
          <div className="brand-name">{APP_NAME}</div>
          <div className="brand-org">from {store}</div>
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
        <Link href="/account" className="muted hide-sm" style={{ fontSize: 13 }} title="Your account">{customer}</Link>
        <SignOutButton />
      </div>
    </header>
  );
}
