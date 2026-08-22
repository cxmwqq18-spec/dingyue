import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import "./load-runtime-env.mjs";
import { buildTunneledReadonlyDatabaseUrl, assertDatabaseTarget } from "./lib/database-target.mjs";

const repoRoot = process.cwd();
const tunnelScript = path.join(repoRoot, "scripts", "start-remote-db-tunnel.mjs");
const devLauncher = path.join(repoRoot, "scripts", "dev-fixed-port.mjs");
const remoteReadonlyDatabaseUrl = process.env.REMOTE_DB_READONLY_DATABASE_URL?.trim();

if (!remoteReadonlyDatabaseUrl) {
  console.error("REMOTE_DB_READONLY_DATABASE_URL is required for remote-readonly development mode.");
  process.exit(1);
}

const tunneledDatabaseUrl = buildTunneledReadonlyDatabaseUrl(remoteReadonlyDatabaseUrl);
const readonlyEnv = {
  ...process.env,
  DINGYUE_ENV: "remote-readonly",
  DATABASE_TARGET: "remote-readonly",
  DATABASE_URL: tunneledDatabaseUrl,
  PERSISTENCE_BACKEND: process.env.PERSISTENCE_BACKEND || "postgres",
  PLATFORM_STATE_POSTGRES_STRICT: process.env.PLATFORM_STATE_POSTGRES_STRICT || "1",
  STOREFRONT_PATH_MODE_READS: process.env.STOREFRONT_PATH_MODE_READS || "database"
};

assertDatabaseTarget({ expectedTarget: "remote-readonly", env: readonlyEnv });

const tunnelResult = spawnSync(process.execPath, [tunnelScript, "--readonly"], {
  cwd: repoRoot,
  env: readonlyEnv,
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
  env: readonlyEnv,
  stdio: "inherit"
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    child.kill(signal);
  });
}

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
