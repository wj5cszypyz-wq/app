// One-click demo sign-in is for local testing only. It can never turn on in a production build.
export function demoEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.DEMO_MODE === "true";
}

export const DEMO_USERS = {
  "harbor-fresh:owner": "ops@harborfresh.test",
  "harbor-fresh:buyer": "chef@juniperbistro.test",
  "brightline:owner": "maker@brightline.test",
  "brightline:buyer": "buyer@oakember.test",
} as const;

export type DemoKey = keyof typeof DEMO_USERS;

export function isDemoKey(v: unknown): v is DemoKey {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(DEMO_USERS, v);
}
