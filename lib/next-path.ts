// After sign-in we may send people back to the page they asked for, but only to a store page of a
// store they belong to. Anything else (other sites, "//evil.com", odd characters) is ignored.
const NEXT_RE = /^\/s\/([a-z0-9-]{1,48})(?:\/[A-Za-z0-9_-]+)*\/?$/;

export function safeNextPath(next: unknown, allowedSlugs: string[]): string | null {
  if (typeof next !== "string" || next.length > 200) return null;
  const m = NEXT_RE.exec(next);
  return m && allowedSlugs.includes(m[1]) ? next : null;
}
