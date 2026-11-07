import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const env = {
  DATABASE_URL: "file:./test.db",
  SESSION_SECRET: "test-secret-that-is-definitely-longer-than-32-chars",
  DEMO_MODE: "",
  QBO_CLIENT_ID: "",
  QBO_CLIENT_SECRET: "",
  UPLOAD_DIR: "prisma/test-uploads",
};

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: "tests/setup/db.ts",
    fileParallelism: false,
    env,
  },
});
