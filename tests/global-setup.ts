import { execSync } from "node:child_process";

/** Rebuild the test database from the migrations before the suite runs. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgres://postgres@127.0.0.1:5433/gen_e_test";
  execSync("npx payload migrate:fresh --force-accept-warning", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url, PAYLOAD_SECRET: "test-secret-not-for-production", BUNNY_STORAGE_ACCESS_KEY: "", BUNNY_STORAGE_ZONE_NAME: "" },
  });
}
