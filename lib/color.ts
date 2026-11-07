// Store accent colors: white text must stay readable on them (WCAG AA, contrast ≥ 4.5:1).
const HEX = /^#[0-9a-f]{6}$/i;

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

export function contrastWithWhite(hex: string): number {
  const [r, g, b] = rgb(hex).map(channel);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return 1.05 / (lum + 0.05);
}

/** The color if it's readable; otherwise the same hue darkened until it is. Null if not #rrggbb. */
export function readableAccent(input: string): { hex: string; adjusted: boolean } | null {
  if (typeof input !== "string" || !HEX.test(input)) return null;
  let hex = input.toLowerCase();
  if (contrastWithWhite(hex) >= 4.5) return { hex, adjusted: false };
  let [r, g, b] = rgb(hex);
  for (let i = 0; i < 100 && contrastWithWhite(hex) < 4.5; i++) {
    [r, g, b] = [r, g, b].map((c) => Math.max(0, Math.floor(c * 0.94)));
    hex = `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
  }
  return { hex, adjusted: true };
}

function mixWithWhite(hex: string, amount: number): string {
  const [r, g, b] = rgb(hex).map((c) => Math.round(c + (255 - c) * amount));
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function darken(hex: string, amount: number): string {
  const [r, g, b] = rgb(hex).map((c) => Math.round(c * (1 - amount)));
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** CSS variables for a store's accent color (buttons, links, highlights). */
export function accentVars(hex: string | null): Record<string, string> {
  const ok = hex ? readableAccent(hex) : null;
  if (!ok) return {};
  return {
    "--green": ok.hex,
    "--green-hover": darken(ok.hex, 0.14),
    "--green-soft": mixWithWhite(ok.hex, 0.9),
    "--green-line": mixWithWhite(ok.hex, 0.65),
  };
}
