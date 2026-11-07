import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", viewBox: "0 0 24 24", "aria-hidden": true } as const;

// Brand mark: a leaf (fresh food).
export const IconMark = (p: P) => (
  <svg {...base} strokeWidth={2} {...p}><path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14z" /><path d="M5 19 13 11" /></svg>
);
export const IconHome = (p: P) => (
  <svg {...base} {...p}><path d="M3.5 10.5 12 4l8.5 6.5" /><path d="M5.5 9v10.5h13V9" /><path d="M10 19.5V14h4v5.5" /></svg>
);
export const IconList = (p: P) => (
  <svg {...base} {...p}><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="18" r="1" /></svg>
);
export const IconBox = (p: P) => (
  <svg {...base} {...p}><path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z" /><path d="m3.5 7.5 8.5 4.5 8.5-4.5M12 12v9" /></svg>
);
export const IconUsers = (p: P) => (
  <svg {...base} {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.4 3.4-5.5 6.5-5.5s5.7 2.1 6.5 5.5" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.8c1.6.8 2.6 2.6 3 5.2" /></svg>
);
export const IconLink = (p: P) => (
  <svg {...base} {...p}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>
);
export const IconCart = (p: P) => (
  <svg {...base} {...p}><path d="M3 4h2.2l2.2 11.2a1.5 1.5 0 0 0 1.5 1.3h8.4a1.5 1.5 0 0 0 1.5-1.2L20.5 8H6" /><circle cx="9.5" cy="20" r="1.2" /><circle cx="17" cy="20" r="1.2" /></svg>
);
export const IconClock = (p: P) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
);
export const IconSearch = (p: P) => (
  <svg {...base} {...p}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
);
export const IconCheck = (p: P) => (
  <svg {...base} strokeWidth={2.4} {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
);
export const IconX = (p: P) => (
  <svg {...base} strokeWidth={2.2} {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const IconInfo = (p: P) => (
  <svg {...base} strokeWidth={2.2} {...p}><path d="M12 11v6M12 7.5v.01" /></svg>
);
export const IconSync = (p: P) => (
  <svg {...base} {...p}><path d="M20 11a8 8 0 0 0-14.3-4.3L4 8.5" /><path d="M4 4v4.5h4.5" /><path d="M4 13a8 8 0 0 0 14.3 4.3L20 15.5" /><path d="M20 20v-4.5h-4.5" /></svg>
);
export const IconAlert = (p: P) => (
  <svg {...base} {...p}><path d="M12 4 2.8 19.5h18.4z" /><path d="M12 10v4.5M12 17.2v.01" /></svg>
);
export const IconPrinter = (p: P) => (
  <svg {...base} {...p}><path d="M7 9V3.5h10V9" /><rect x="3.5" y="9" width="17" height="8" rx="2" /><path d="M7 14h10v6.5H7z" /></svg>
);
export const IconFile = (p: P) => (
  <svg {...base} {...p}><path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z" /><path d="M14 3.5v5h5M9 13h6M9 16.5h6" /></svg>
);
export const IconArrow = (p: P) => (
  <svg {...base} {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
export const IconBack = (p: P) => (
  <svg {...base} {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
);
export const IconPlus = (p: P) => (
  <svg {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconLogout = (p: P) => (
  <svg {...base} {...p}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 16.5 14.5 12 10 7.5M14.5 12H4" /></svg>
);
export const IconRepeat = (p: P) => (
  <svg {...base} {...p}><path d="M17 3.5 20.5 7 17 10.5" /><path d="M3.5 12V10a3 3 0 0 1 3-3h14" /><path d="M7 20.5 3.5 17 7 13.5" /><path d="M20.5 12v2a3 3 0 0 1-3 3h-14" /></svg>
);
export const IconBell = (p: P) => (
  <svg {...base} {...p}><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" /><path d="M10 20.5a2.2 2.2 0 0 0 4 0" /></svg>
);
export const IconStore = (p: P) => (
  <svg {...base} {...p}><path d="M4 9.5 5.5 4h13L20 9.5" /><path d="M4 9.5c0 1.4 1.1 2.5 2.7 2.5s2.6-1.1 2.6-2.5c0 1.4 1.1 2.5 2.7 2.5s2.7-1.1 2.7-2.5c0 1.4 1 2.5 2.6 2.5S20 10.9 20 9.5" /><path d="M5.5 12v8h13v-8" /><path d="M10 20v-4.5h4V20" /></svg>
);
export const IconBadge = (p: P) => (
  <svg {...base} {...p}><rect x="4" y="3.5" width="16" height="17" rx="2.5" /><circle cx="12" cy="10" r="2.8" /><path d="M7.5 17c.8-1.9 2.5-3 4.5-3s3.7 1.1 4.5 3" /></svg>
);
