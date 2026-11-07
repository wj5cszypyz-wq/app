// Creates a fresh, empty SQLite database for the integration tests at prisma/test.db (git-ignored).
// It only ever deletes that one throwaway file; it never touches dev.db or any other database.
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

export default function setup() {
  for (const suffix of ["", "-journal"]) {
    rmSync(fileURLToPath(new URL(`../../prisma/test.db${suffix}`, import.meta.url)), { force: true });
  }
  rmSync(fileURLToPath(new URL("../../prisma/test-uploads", import.meta.url)), { recursive: true, force: true });
  execSync("npx prisma db push --skip-generate", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: "file:./test.db", PRISMA_HIDE_UPDATE_MESSAGE: "1" },
  });
}
