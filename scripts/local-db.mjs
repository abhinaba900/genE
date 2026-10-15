#!/usr/bin/env node
/**
 * Project-local PostgreSQL for development — no Docker, no system-wide changes.
 *
 *   npm run db:start    initialise (first run) and start a cluster in ./.pgdata on port 5433
 *   npm run db:stop     stop it
 *   npm run db:status   show whether it is running
 *
 * Uses the PostgreSQL binaries already installed on this machine (PG_BIN overrides
 * discovery). Authentication is `trust` for 127.0.0.1 only, so it must never be
 * exposed beyond localhost. Production uses a managed Postgres via DATABASE_URL.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, appendFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dataDir = join(root, ".pgdata");
const port = process.env.LOCAL_PG_PORT ?? "5433";
const databases = ["gen_e", "gen_e_test"];

function findBin() {
  if (process.env.PG_BIN) return process.env.PG_BIN;
  const candidates = [];
  if (process.platform === "win32") {
    const base = "C:\\Program Files\\PostgreSQL";
    if (existsSync(base)) {
      for (const v of readdirSync(base).sort((a, b) => Number(b) - Number(a))) candidates.push(join(base, v, "bin"));
    }
  } else {
    candidates.push("/usr/lib/postgresql/18/bin", "/usr/lib/postgresql/17/bin", "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin");
  }
  const exe = process.platform === "win32" ? "pg_ctl.exe" : "pg_ctl";
  const found = candidates.find((dir) => existsSync(join(dir, exe)));
  if (!found) {
    console.error("PostgreSQL binaries not found. Install PostgreSQL 16+ or set PG_BIN, or point DATABASE_URL at any Postgres.");
    process.exit(1);
  }
  return found;
}

const bin = findBin();
const tool = (name) => join(bin, process.platform === "win32" ? `${name}.exe` : name);

function isRunning() {
  return spawnSync(tool("pg_ctl"), ["status", "-D", dataDir], { stdio: "ignore" }).status === 0;
}

function init() {
  if (existsSync(join(dataDir, "PG_VERSION"))) return;
  console.log(`Initialising cluster in ${dataDir}`);
  execFileSync(tool("initdb"), ["-D", dataDir, "-U", "postgres", "--auth=trust", "--encoding=UTF8", "--no-locale"], { stdio: "inherit" });
  appendFileSync(join(dataDir, "postgresql.conf"), `\nport = ${port}\nlisten_addresses = '127.0.0.1'\n`);
}

function start() {
  init();
  if (!isRunning()) {
    // stdio must not be inherited: on Windows the server keeps the handle open and this script would never exit.
    execFileSync(tool("pg_ctl"), ["start", "-D", dataDir, "-l", join(dataDir, "server.log"), "-w"], { stdio: "ignore" });
  }
  for (const db of databases) {
    const exists = execFileSync(tool("psql"), ["-h", "127.0.0.1", "-p", port, "-U", "postgres", "-tAc", `SELECT 1 FROM pg_database WHERE datname='${db}'`])
      .toString()
      .trim();
    if (!exists) execFileSync(tool("createdb"), ["-h", "127.0.0.1", "-p", port, "-U", "postgres", db], { stdio: "inherit" });
  }
  console.log(`PostgreSQL running → postgres://postgres@127.0.0.1:${port}/gen_e`);
}

const command = process.argv[2] ?? "start";
if (command === "start") start();
else if (command === "stop") isRunning() ? execFileSync(tool("pg_ctl"), ["stop", "-D", dataDir, "-m", "fast"], { stdio: "inherit" }) : console.log("Not running.");
else if (command === "status") console.log(isRunning() ? `Running on port ${port}` : "Not running");
else {
  console.error(`Unknown command "${command}". Use start | stop | status.`);
  process.exit(1);
}
