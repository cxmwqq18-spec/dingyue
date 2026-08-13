import { execFileSync, spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const port = String(Number(process.env.DEV_PORT || "3002") || 3002);
const host = process.env.DEV_HOST || "127.0.0.1";
const defaultMaxOldSpaceSize = process.env.DINGYUE_DEV_MAX_OLD_SPACE_SIZE || "6144";
const defaultNodeOptions = `--max-old-space-size=${defaultMaxOldSpaceSize}`;

function output(command, args) {
  try {
    return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function listenerPids(targetPort) {
  return output("lsof", ["-nP", `-iTCP:${targetPort}`, "-sTCP:LISTEN", "-t"])
    .split(/\s+/)
    .filter(Boolean)
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);
}

function commandForPid(pid) {
  return output("ps", ["-p", String(pid), "-o", "command="]);
}

function parentForPid(pid) {
  const value = Number(output("ps", ["-p", String(pid), "-o", "ppid="]));
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

function cwdForPid(pid) {
  const raw = output("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"]);
  return raw
    .split("\n")
    .find((line) => line.startsWith("n"))
    ?.slice(1);
}

function isSameWorkspaceProcess(pid) {
  const cwd = cwdForPid(pid);
  const command = commandForPid(pid);
  return Boolean(
    (cwd && (cwd === repoRoot || cwd.startsWith(`${repoRoot}${path.sep}`))) ||
    command.includes(repoRoot)
  );
}

function sameWorkspaceProcessTree(pid) {
  const pids = new Set([pid]);
  let current = pid;
  for (let index = 0; index < 8; index += 1) {
    const parent = parentForPid(current);
    if (!parent || parent === 1 || !isSameWorkspaceProcess(parent)) break;
    pids.add(parent);
    current = parent;
  }
  return pids;
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function killPids(pids, signal) {
  for (const pid of pids) {
    try {
      process.kill(pid, signal);
    } catch {
      // The process may have exited after the port scan.
    }
  }
}

function clearSameWorkspaceListeners() {
  const pids = listenerPids(port);
  if (!pids.length) return;

  const foreign = pids.filter((pid) => !isSameWorkspaceProcess(pid));
  if (foreign.length) {
    console.error(`Port ${port} is already in use by another process. Refusing to switch ports.`);
    for (const pid of foreign) {
      console.error(`- pid ${pid}: ${commandForPid(pid) || "unknown command"}`);
    }
    process.exit(1);
  }

  const killSet = new Set();
  for (const pid of pids) {
    sameWorkspaceProcessTree(pid).forEach((value) => killSet.add(value));
  }
  killPids(killSet, "SIGTERM");
  for (let index = 0; index < 20; index += 1) {
    if (!listenerPids(port).length) return;
    sleep(250);
  }
  killPids(killSet, "SIGKILL");
  for (let index = 0; index < 20; index += 1) {
    if (!listenerPids(port).length) return;
    sleep(250);
  }
  console.error(`Port ${port} is still busy after stopping the existing workspace server.`);
  process.exit(1);
}

clearSameWorkspaceListeners();

const nextBin = path.join(repoRoot, "node_modules", ".bin", "next");
const child = spawn(nextBin, ["dev", "-H", host, "-p", port], {
  cwd: repoRoot,
  env: {
    ...process.env,
    NODE_OPTIONS: process.env.NODE_OPTIONS || defaultNodeOptions,
    __NEXT_DISABLE_MEMORY_WATCHER: process.env.__NEXT_DISABLE_MEMORY_WATCHER || "1",
    NEXT_DIST_DIR: process.env.NEXT_DIST_DIR || ".next-3002"
  },
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
