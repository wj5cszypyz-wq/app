import type { CSSProperties, ReactNode } from "react";
import { accentVars } from "@/lib/color";

/** Wraps a store's pages in its chosen look and accent color. Only known values ever reach the page. */
export function StoreLook({ look, accent, children }: { look: string; accent: string | null; children: ReactNode }) {
  const safeLook = ["fresh", "clean", "craft", "classic"].includes(look) ? look : "fresh";
  return (
    <div className="look-root" data-look={safeLook} style={accentVars(accent) as CSSProperties}>
      {children}
    </div>
  );
}

/** The store's logo (if uploaded) or a neat letter mark in the accent color. */
export function StoreMark({ name, logoId, size = 36 }: { name: string; logoId: string | null; size?: number }) {
  if (logoId) {
    // eslint-disable-next-line @next/next/no-img-element -- served by our own access-checked route
    return <img className="store-logo" src={`/api/files/${logoId}`} alt="" width={size} height={size} style={{ width: size, height: size }} />;
  }
  const letter = (name.trim()[0] ?? "?").toUpperCase();
  return <span className="brand-mark store-letter" style={{ width: size, height: size }} aria-hidden>{letter}</span>;
}
