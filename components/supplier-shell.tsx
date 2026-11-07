"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { APP_NAME } from "@/lib/brand";
import { IconBox, IconHome, IconLink, IconList, IconMark, IconUsers } from "./icons";
import { SignOutButton } from "./sign-out";
import { useStorePaths } from "./use-store";

const NAV = [
  { href: "", label: "Today", icon: IconHome, exact: true },
  { href: "/orders", label: "All orders", icon: IconList },
  { href: "/catalog", label: "Products", icon: IconBox },
  { href: "/customers", label: "Customers", icon: IconUsers },
  { href: "/settings", label: "QuickBooks", icon: IconLink },
];

export function SupplierShell(props: {
  children: ReactNode;
  userName: string;
  orgName: string;
  qboConnected: boolean;
  qboCompany: string | null;
}) {
  const path = usePathname();
  const paths = useStorePaths();
  const initials = props.userName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href={paths.manage()} className="brand">
          <span className="brand-mark"><IconMark /></span>
          <span>
            <div className="brand-name">{APP_NAME}</div>
            <div className="brand-org">{props.orgName}</div>
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
            <span className="grow user-meta" style={{ fontSize: 13 }}>{props.userName}</span>
            <SignOutButton />
          </div>
        </div>
      </aside>
      <main className="main">{props.children}</main>
    </div>
  );
}
