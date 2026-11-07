"use client";

import Link from "next/link";
import { useEffect } from "react";
import { IconPrinter } from "@/components/icons";
import { useStorePaths } from "@/components/use-store";

export function PrintToolbar({ orderId, packing }: { orderId: string; packing: boolean }) {
  const paths = useStorePaths();
  // Open the print dialog as soon as the page is ready.
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="doc-toolbar">
      <button className="btn btn-primary" onClick={() => window.print()}>
        <IconPrinter /> Print
      </button>
      <Link className="btn" href={paths.shop(`/print/${orderId}?doc=${packing ? "invoice" : "packing"}`)}>
        Switch to {packing ? "invoice" : "packing slip"}
      </Link>
    </div>
  );
}
