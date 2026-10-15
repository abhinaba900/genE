import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Integration tests run the real Payload config against a separate database
 * (gen_e_test), with local file storage instead of Bunny.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@payload-config": path.resolve(__dirname, "src/payload.config.ts"),
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    globalSetup: ["tests/global-setup.ts"],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    fileParallelism: false,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://postgres@127.0.0.1:5433/gen_e_test",
      PAYLOAD_SECRET: "test-secret-not-for-production",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
      JOBS_AUTORUN: "false",
      ANALYTICS_ENABLED: "true",
      BUNNY_STORAGE_ACCESS_KEY: "",
      BUNNY_STORAGE_ZONE_NAME: "",
    },
  },
});
