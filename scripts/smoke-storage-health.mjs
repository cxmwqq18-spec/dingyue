import { spawnSync } from "node:child_process";

const result = spawnSync(process.execPath, ["scripts/storage-health.mjs"], {
  cwd: process.cwd(),
  env: process.env,
  encoding: "utf8"
});

if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout);
  process.exit(result.status || 1);
}

const report = JSON.parse(result.stdout);
if (!report.ok || !report.storageRoot || report.storageRoot.includes("/public")) {
  throw new Error("storage health smoke failed");
}

console.log(JSON.stringify({ ok: true, storageRoot: report.storageRoot, activeAssetRecords: report.activeAssetRecords }, null, 2));
