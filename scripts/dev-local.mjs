import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { setTimeout as sleep } from "node:timers/promises";
import "./load-runtime-env.mjs";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

const repoRoot = process.cwd();
const composePath = path.join(repoRoot, "ops", "local-postgres.compose.yml");
const devLauncher = path.join(repoRoot, "scripts", "dev-fixed-port.mjs");
const localContainer = "dingyue-postgres-local";
const configuredDatabaseWaitMs = Number(process.env.LOCAL_DB_STARTUP_TIMEOUT_MS || 60_000);
const maxDatabaseWaitMs = Number.isFinite(configuredDatabaseWaitMs)
  ? Math.max(5_000, configuredDatabaseWaitMs)
  : 60_000;

const localEnv = {
  ...process.env,
  DINGYUE_ENV: "local",
  DATABASE_TARGET: "local",
  PERSISTENCE_BACKEND: "postgres",
  PLATFORM_STATE_POSTGRES_STRICT: "1",
  STOREFRONT_PATH_MODE_READS: "database"
};

assertDatabaseTarget({ expectedTarget: "local", env: localEnv });

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: repoRoot,
    env: localEnv,
    encoding: "utf8",
    stdio: "inherit",
    ...options
  });
}

function fail(message) {
  console.error(`[dev-local] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(composePath)) {
  fail(`Local PostgreSQL compose file is missing: ${composePath}`);
}

const composeResult = run("docker", ["compose", "-f", composePath, "up", "-d"]);
if (composeResult.status !== 0) {
  fail("Unable to start the local PostgreSQL container. Check that Docker Desktop is running.");
}

async function waitForDatabase() {
  const deadline = Date.now() + maxDatabaseWaitMs;
  while (Date.now() < deadline) {
    const inspect = spawnSync("docker", ["inspect", "--format", "{{.State.Health.Status}}", localContainer], {
      cwd: repoRoot,
      env: localEnv,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    });
    const health = inspect.stdout?.trim();
    if (health === "healthy") return;
    await sleep(500);
  }
  fail(`Local PostgreSQL container did not become healthy within ${maxDatabaseWaitMs}ms.`);
}

await waitForDatabase();

const migrationResult = run(
  process.execPath,
  ["-r", "./scripts/load-runtime-env.mjs", "./node_modules/prisma/build/index.js", "migrate", "deploy"],
  { stdio: "inherit" }
);
if (migrationResult.status !== 0) {
  fail("Local PostgreSQL is healthy, but Prisma migrations could not be applied.");
}

const child = spawn(process.execPath, [devLauncher], {
  cwd: repoRoot,
  env: localEnv,
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
