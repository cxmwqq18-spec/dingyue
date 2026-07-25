import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "./load-runtime-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const startScript = path.join(__dirname, "start-remote-db-tunnel.mjs");
const defaultPidFile = path.join(os.tmpdir(), "dingyue-remote-db-tunnel-watch.pid");

function numberFromEnv(name, fallback, minimum) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? Math.max(minimum, Math.trunc(value)) : fallback;
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const intervalMs = numberFromEnv("REMOTE_DB_TUNNEL_WATCH_INTERVAL_MS", 60_000, 2_000);
const restartAfterFailures = numberFromEnv("REMOTE_DB_TUNNEL_RESTART_AFTER_FAILURES", 3, 1);
const pidFile = process.env.REMOTE_DB_TUNNEL_WATCH_PID_FILE || defaultPidFile;
const once = process.argv.includes("--once");
const checkLimit = Number(argValue("--checks") || (once ? "1" : "0"));
const maxChecks = Number.isFinite(checkLimit) && checkLimit > 0 ? Math.trunc(checkLimit) : 0;

function timestamp() {
  return new Date().toISOString();
}

function processAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readPidFile() {
  try {
    const pid = Number(fs.readFileSync(pidFile, "utf8").trim());
    return Number.isFinite(pid) ? pid : undefined;
  } catch {
    return undefined;
  }
}

function writePidFile() {
  const existingPid = readPidFile();
  if (existingPid && existingPid !== process.pid && processAlive(existingPid)) {
    console.error(`[${timestamp()}] remote DB tunnel watcher already running as pid ${existingPid}`);
    process.exit(1);
  }
  fs.writeFileSync(pidFile, String(process.pid));
}

function cleanupPidFile() {
  if (readPidFile() === process.pid) {
    fs.rmSync(pidFile, { force: true });
  }
}

function ensureTunnel({ forceRestart = false } = {}) {
  const result = spawnSync(process.execPath, [startScript], {
    cwd: root,
    env: {
      ...process.env,
      ...(forceRestart ? { REMOTE_DB_TUNNEL_FORCE_RESTART: "1" } : {})
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  const stdout = result.stdout.trim();
  const stderr = result.stderr.trim();
  if (result.status === 0) {
    console.log(`[${timestamp()}] remote DB tunnel healthy${stdout ? ` ${stdout.replace(/\s+/g, " ")}` : ""}`);
    return true;
  }
  console.error(`[${timestamp()}] remote DB tunnel check failed`);
  if (stdout) console.error(stdout);
  if (stderr) console.error(stderr);
  return false;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    stopping = true;
    cleanupPidFile();
    process.exit(0);
  });
}

if (!once) writePidFile();

let checks = 0;
let failures = 0;
console.log(`[${timestamp()}] remote DB tunnel watcher started intervalMs=${intervalMs} restartAfterFailures=${restartAfterFailures} pid=${process.pid}`);

while (!stopping) {
  checks += 1;
  const forceRestart = failures + 1 >= restartAfterFailures;
  if (ensureTunnel({ forceRestart })) {
    failures = 0;
  } else {
    failures += 1;
  }
  if (maxChecks && checks >= maxChecks) break;
  await sleep(intervalMs);
}

cleanupPidFile();
if (failures) process.exit(1);
