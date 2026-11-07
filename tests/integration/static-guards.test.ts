// Build-time safety nets: fail if any page or action skips the store access check.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { ROUTES } from "../helpers/route-manifest";

const root = join(__dirname, "../..");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const appFiles = walk(join(root, "app")).filter((f) => /\.(ts|tsx)$/.test(f));
const storeRoutes = walk(join(root, "app/api/s")).filter((f) => f.endsWith("route.ts"));
const METHOD_RE = /export async function (GET|POST|PATCH|PUT|DELETE)\b/g;

describe("static guards", () => {
  it("no file under app/ imports the database client", () => {
    const offenders = appFiles.filter((f) => /from\s+["'](@\/lib\/db|(\.\.\/)+lib\/db)["']/.test(readFileSync(f, "utf8")));
    expect(offenders.map((f) => relative(root, f))).toEqual(["app/api/auth/demo/route.ts", "app/api/auth/login/route.ts"]);
  });

  it("every route under app/api/s is in the break-in matrix", () => {
    const found = storeRoutes.flatMap((f) =>
      [...readFileSync(f, "utf8").matchAll(METHOD_RE)].map((m) => `${m[1]} ${relative(join(root, "app/api/s/[slug]"), f)}`),
    );
    const listed = ROUTES.map((r) => `${r.method} ${r.file}`);
    expect(found.sort()).toEqual(listed.sort());
  });

  it("every route under app/api/s calls storeApi", () => {
    const missing = storeRoutes.filter((f) => !readFileSync(f, "utf8").includes("storeApi("));
    expect(missing).toEqual([]);
  });
});
