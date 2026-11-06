// One-click demo sign-in is for local testing only. It can never turn on in a production build.
export function demoEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.DEMO_MODE === "true";
}

export const DEMO_USERS = { supplier: "ops@harborfresh.test", buyer: "chef@juniperbistro.test" } as const;
