import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const nextDistDir = ".next-build";
const nextBin = path.join(repoRoot, "node_modules", ".bin", "next");
const restoreScript = path.join(repoRoot, "scripts", "restore-next-env.mjs");
const defaultMaxOldSpaceSize = process.env.DINGYUE_BUILD_MAX_OLD_SPACE_SIZE || "12288";

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "inherit",
    ...options
  });
}

try {
  fs.rmSync(path.join(repoRoot, nextDistDir), { recursive: true, force: true });
} catch (error) {
  console.error(`[build] unable to clear ${nextDistDir}: ${error.message}`);
  process.exit(1);
}

const buildResult = run(nextBin, ["build"], {
  env: {
    ...process.env,
    NODE_OPTIONS: process.env.NODE_OPTIONS || `--max-old-space-size=${defaultMaxOldSpaceSize}`,
    NEXT_DIST_DIR: nextDistDir,
    NEXT_PRIVATE_BUILD_WORKER: process.env.NEXT_PRIVATE_BUILD_WORKER || "1"
  }
});

const restoreResult = run(process.execPath, [restoreScript]);
if (restoreResult.status !== 0) process.exit(restoreResult.status ?? 1);
if (buildResult.error) {
  console.error(`[build] ${buildResult.error.message}`);
  process.exit(1);
}
process.exit(buildResult.status ?? 1);
