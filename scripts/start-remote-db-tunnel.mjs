import { spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import "./load-runtime-env.mjs";

const readonlyMode = process.argv.includes("--readonly");
const readwriteMode = process.argv.includes("--readwrite");
if (readonlyMode === readwriteMode) {
  console.error("Choose exactly one remote database tunnel mode: --readonly or --readwrite.");
  process.exit(1);
}

const remoteDatabaseUrl = readonlyMode
  ? process.env.REMOTE_DB_READONLY_DATABASE_URL?.trim()
  : process.env.REMOTE_DB_DATABASE_URL?.trim();
if (!remoteDatabaseUrl) {
  console.error(readonlyMode
    ? "REMOTE_DB_READONLY_DATABASE_URL is required for remote audit tunnels."
    : "REMOTE_DB_DATABASE_URL is required for remote read-write development tunnels.");
  process.exit(1);
}

const localHost = process.env.REMOTE_DB_LOCAL_HOST || "127.0.0.1";
const localPort = Number(process.env.REMOTE_DB_LOCAL_PORT || "15432");
const remoteHost = process.env.REMOTE_DB_SSH_HOST || process.env.AI_PROJECT_SSH_HOST || "204.77.130.125";
const remoteSshPort = process.env.REMOTE_DB_SSH_PORT || process.env.AI_PROJECT_SSH_PORT || "11765";
const remoteUser = process.env.REMOTE_DB_SSH_USER || process.env.AI_PROJECT_SSH_USER || "root";
const remoteDbHost = process.env.REMOTE_DB_HOST || "127.0.0.1";
const remoteDbPort = process.env.REMOTE_DB_PORT || "5432";
const keyPath = process.env.REMOTE_DB_SSH_KEY_PATH || process.env.AI_PROJECT_SSH_KEY_PATH;
const forceRestart = process.env.REMOTE_DB_TUNNEL_FORCE_RESTART === "1";
const postgresProbeAttempts = Math.max(1, Math.trunc(Number(process.env.REMOTE_DB_POSTGRES_PROBE_ATTEMPTS ?? "3") || 3));

function isListening(host, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.setTimeout(1200, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function isPostgresResponsive(host, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(ok);
    };
    socket.once("connect", () => {
      const sslRequest = Buffer.alloc(8);
      sslRequest.writeInt32BE(8, 0);
      sslRequest.writeInt32BE(80877103, 4);
      socket.write(sslRequest);
    });
    socket.once("data", (chunk) => {
      const response = chunk.toString("utf8", 0, 1);
      finish(response === "S" || response === "N");
    });
    socket.once("error", () => finish(false));
    socket.once("close", () => finish(false));
    socket.setTimeout(6000, () => finish(false));
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isPostgresResponsiveWithRetries(host, port) {
  for (let attempt = 1; attempt <= postgresProbeAttempts; attempt += 1) {
    if (await isPostgresResponsive(host, port)) return true;
    if (attempt < postgresProbeAttempts) await sleep(1000 * attempt);
  }
  return false;
}

function listeningPids(port) {
  const result = spawnSync("lsof", ["-nP", "-t", `-iTCP:${port}`, "-sTCP:LISTEN"], { encoding: "utf8" });
  if (result.status !== 0 && !result.stdout.trim()) return [];
  return result.stdout
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function commandForPid(pid) {
  const result = spawnSync("ps", ["-p", pid, "-o", "comm="], { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "";
}

async function stopStaleSshTunnel(host, port) {
  const pids = listeningPids(port);
  const sshPids = pids.filter((pid) => /(^|\/)ssh$/.test(commandForPid(pid)));
  if (!sshPids.length) return false;
  for (const pid of sshPids) {
    try {
      process.kill(Number(pid), "SIGTERM");
    } catch {
      // Ignore races where the stale process already exited.
    }
  }
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (!(await isListening(host, port))) return true;
    await sleep(300);
  }
  for (const pid of sshPids) {
    try {
      process.kill(Number(pid), "SIGKILL");
    } catch {
      // Ignore races where the stale process already exited.
    }
  }
  await sleep(300);
  return !(await isListening(host, port));
}

if (await isPostgresResponsiveWithRetries(localHost, localPort)) {
  console.log(JSON.stringify({ ok: true, reused: true, local: `${localHost}:${localPort}` }, null, 2));
  process.exit(0);
}

if (await isListening(localHost, localPort)) {
  if (!forceRestart) {
    console.error(`Local port ${localHost}:${localPort} is listening but PostgreSQL did not respond after ${postgresProbeAttempts} checks. Leaving the existing listener in place; set REMOTE_DB_TUNNEL_FORCE_RESTART=1 to rebuild it.`);
    process.exit(2);
  }
  const stopped = await stopStaleSshTunnel(localHost, localPort);
  if (!stopped) {
    console.error(`Local port ${localHost}:${localPort} is occupied, but it did not answer as PostgreSQL. Stop the stale tunnel/process before retrying.`);
    process.exit(1);
  }
}

const baseArgs = [
  "-fN",
  "-o", "StrictHostKeyChecking=accept-new",
  "-o", "ExitOnForwardFailure=yes",
  "-o", "ServerAliveInterval=15",
  "-o", "ServerAliveCountMax=3",
  ...(keyPath && fs.existsSync(keyPath) ? ["-i", keyPath] : []),
  "-p", remoteSshPort,
  "-L", `${localHost}:${localPort}:${remoteDbHost}:${remoteDbPort}`,
  `${remoteUser}@${remoteHost}`
];

const password = process.env.REMOTE_DB_SSH_PASSWORD || process.env.AI_PROJECT_SSH_PASSWORD;
const command = password ? "expect" : "ssh";
const args = password
  ? [
      "-c",
      `set timeout 15
spawn ssh ${baseArgs.map((arg) => `{${arg}}`).join(" ")}
expect {
  "*assword:*" { send "${password.replace(/[$"\\]/g, "\\$&")}\\r"; exp_continue }
  eof
}`
    ]
  : baseArgs;

const result = spawnSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
if (result.status !== 0) {
  console.error(result.stdout);
  console.error(result.stderr);
  process.exit(result.status ?? 1);
}

if (!(await isPostgresResponsiveWithRetries(localHost, localPort))) {
  console.error(`SSH tunnel started, but PostgreSQL did not respond on ${localHost}:${localPort}`);
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  reused: false,
  local: `${localHost}:${localPort}`,
  remote: `${remoteHost}:${remoteSshPort} -> ${remoteDbHost}:${remoteDbPort}`
}, null, 2));
