"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAME } from "@/lib/brand";
import { IconCart, IconClock, IconMark } from "./icons";
import { SignOutButton } from "./sign-out";

export function BuyerBar({ restaurant, supplier }: { restaurant: string; supplier: string }) {
  const path = usePathname();
  const isHistory = path.startsWith("/shop/orders");
  return (
    <header className="topbar">
      <Link href="/shop" className="brand">
        <span className="brand-mark"><IconMark /></span>
        <span>
          <div className="brand-name">{APP_NAME}</div>
          <div className="brand-org">from {supplier}</div>
        </span>
      </Link>
      <nav className="topnav">
        <Link href="/shop" className="nav-link" aria-current={!isHistory ? "page" : undefined}>
          <IconCart /> <span>Order</span>
        </Link>
        <Link href="/shop/orders" className="nav-link" aria-current={isHistory ? "page" : undefined}>
          <IconClock /> <span>History</span>
        </Link>
      </nav>
      <div className="row" style={{ marginLeft: "auto" }}>
        <span className="muted hide-sm" style={{ fontSize: 13 }}>{restaurant}</span>
        <SignOutButton />
      </div>
    </header>
  );
}
