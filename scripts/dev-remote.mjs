import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import "./load-runtime-env.mjs";
import { buildTunneledDatabaseUrl, assertDatabaseTarget } from "./lib/database-target.mjs";

const repoRoot = process.cwd();
const tunnelScript = path.join(repoRoot, "scripts", "start-remote-db-tunnel.mjs");
const devLauncher = path.join(repoRoot, "scripts", "dev-fixed-port.mjs");
const remoteDatabaseUrl = process.env.REMOTE_DB_DATABASE_URL?.trim();

if (!remoteDatabaseUrl) {
  console.error("REMOTE_DB_DATABASE_URL is required for remote read-write development mode.");
  process.exit(1);
}

const remoteEnv = {
  ...process.env,
  DINGYUE_ENV: "remote",
  DATABASE_TARGET: "remote",
  DATABASE_URL: buildTunneledDatabaseUrl(remoteDatabaseUrl),
  PERSISTENCE_BACKEND: process.env.PERSISTENCE_BACKEND || "postgres",
  PLATFORM_STATE_POSTGRES_STRICT: process.env.PLATFORM_STATE_POSTGRES_STRICT || "1",
  STOREFRONT_PATH_MODE_READS: process.env.STOREFRONT_PATH_MODE_READS || "database"
};

assertDatabaseTarget({ expectedTarget: "remote", env: remoteEnv });

const tunnelResult = spawnSync(process.execPath, [tunnelScript, "--readwrite"], {
  cwd: repoRoot,
  env: remoteEnv,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"]
});

if (tunnelResult.status !== 0) {
  if (tunnelResult.stdout?.trim()) console.error(tunnelResult.stdout.trim());
  if (tunnelResult.stderr?.trim()) console.error(tunnelResult.stderr.trim());
  process.exit(tunnelResult.status ?? 1);
}

const child = spawn(process.execPath, [devLauncher], {
  cwd: repoRoot,
  env: remoteEnv,
  stdio: "inherit"
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
