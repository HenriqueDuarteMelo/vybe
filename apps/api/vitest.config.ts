import { defineConfig } from "vitest/config";
import { setup, testDatabaseUrl } from "./test/global-setup.js";

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: ["./test/global-setup.ts"],
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    testTimeout: 20000,
    hookTimeout: 60000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: testDatabaseUrl(),
    },
  },
});