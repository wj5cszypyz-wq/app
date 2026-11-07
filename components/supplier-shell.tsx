"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { APP_NAME } from "@/lib/brand";
import { IconBadge, IconBox, IconClock, IconHome, IconLink, IconList, IconStore, IconUsers } from "./icons";
import { StoreMark } from "./store-look";
import { SignOutButton } from "./sign-out";
import { useStorePaths } from "./use-store";

const NAV = [
  { href: "", label: "Today", icon: IconHome, exact: true },
  { href: "/orders", label: "All orders", icon: IconList },
  { href: "/catalog", label: "Products", icon: IconBox },
  { href: "/customers", label: "Customers", icon: IconUsers },
  { href: "/team", label: "Team", icon: IconBadge },
  { href: "/history", label: "History", icon: IconClock },
  { href: "/setup", label: "Store setup", icon: IconStore },
  { href: "/settings", label: "QuickBooks", icon: IconLink },
];

export function SupplierShell(props: {
  children: ReactNode;
  userName: string;
  orgName: string;
  qboConnected: boolean;
  qboCompany: string | null;
  logoId: string | null;
}) {
  const path = usePathname();
  const paths = useStorePaths();
  const initials = props.userName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href={paths.manage()} className="brand">
          <StoreMark name={props.orgName} logoId={props.logoId} />
          <span style={{ minWidth: 0 }}>
            <div className="brand-name">{props.orgName}</div>
            <div className="brand-org">{APP_NAME}</div>
          </span>
        </Link>

        {NAV.map(({ href: sub, label, icon: Icon, exact }) => {
          const href = paths.manage(sub);
          const active = exact ? path === href : path.startsWith(href);
          return (
            <Link key={href} href={href} className="nav-link" aria-current={active ? "page" : undefined} title={label}>
              <Icon />
              <span>{label}</span>
            </Link>
          );
        })}

        <div className="sidebar-foot">
          <Link href={paths.manage("/settings")} className="link-status">
            <span className={`link-dot ${props.qboConnected ? "on" : ""}`} />
            <span className="grow">
              <div style={{ fontWeight: 650 }}>{props.qboConnected ? "QuickBooks connected" : "QuickBooks not connected"}</div>
              <div className="muted" style={{ fontSize: 12 }}>
                {props.qboConnected ? props.qboCompany ?? "Invoices are created automatically" : "Tap to connect"}
              </div>
            </span>
          </Link>
          <div className="user-row">
            <span className="avatar">{initials}</span>
            <Link href="/account" className="grow user-meta" style={{ fontSize: 13 }} title="Your account">{props.userName}</Link>
            <SignOutButton />
          </div>
        </div>
      </aside>
      <main className="main">{props.children}</main>
    </div>
  );
}
