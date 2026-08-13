import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const apply = process.argv.includes("--apply");
const includeActive = process.argv.includes("--include-active");
const activeDistDir = process.env.NEXT_DIST_DIR || ".next-3002";
const preserved = new Set([".next", ".next-build", ".next-dev", activeDistDir]);

function isNextOutputDir(name) {
  return name === ".next" || /^\.next[-.]/.test(name);
}

function formatSize(bytes) {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

async function directorySize(target) {
  let total = 0;
  let entries;
  try {
    entries = await readdir(target, { withFileTypes: true });
  } catch {
    return total;
  }

  for (const entry of entries) {
    const child = path.join(target, entry.name);
    if (entry.isDirectory()) {
      total += await directorySize(child);
      continue;
    }
    if (!entry.isFile()) continue;
    try {
      total += (await stat(child)).size;
    } catch {
      // File may disappear while scanning generated output.
    }
  }
  return total;
}

const entries = await readdir(repoRoot, { withFileTypes: true });
const candidates = entries
  .filter((entry) => entry.isDirectory() && isNextOutputDir(entry.name))
  .map((entry) => entry.name)
  .filter((name) => includeActive || !preserved.has(name))
  .sort();

if (!candidates.length) {
  console.log("No stale Next output directories found.");
  process.exit(0);
}

const rows = [];
for (const name of candidates) {
  rows.push({ name, size: await directorySize(path.join(repoRoot, name)) });
}

const total = rows.reduce((sum, row) => sum + row.size, 0);
const action = apply ? "Deleting" : "Dry run, would delete";
console.log(`${action} ${rows.length} Next output directories (${formatSize(total)}):`);
for (const row of rows) {
  console.log(`- ${row.name} (${formatSize(row.size)})`);
}

if (!apply) {
  console.log("\nRun with --apply to delete these directories.");
  console.log(`Preserved by default: ${Array.from(preserved).sort().join(", ")}`);
  process.exit(0);
}

for (const row of rows) {
  await rm(path.join(repoRoot, row.name), { force: true, recursive: true });
}
console.log("Done.");
