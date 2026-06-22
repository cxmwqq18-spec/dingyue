import fs from "node:fs";
import path from "node:path";

const dataDir = path.join(process.cwd(), "data");
const statePath = path.join(dataDir, "platform-state.json");
const storageRoot = path.resolve(process.env.STORAGE_ROOT || dataDir);
const publicDir = path.resolve(process.cwd(), "public");

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

if (storageRoot === publicDir || storageRoot.startsWith(`${publicDir}${path.sep}`)) {
  throw new Error("storage_root_must_not_be_under_public");
}

const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, "utf8")) : { assetUploads: [] };
const activeAssets = (state.assetUploads || []).filter((asset) => !asset.deletedAt);
const customerFilesRoot = path.join(storageRoot, "customer-assets");
const files = walk(customerFilesRoot);
const totalBytes = files.reduce((sum, file) => sum + fs.statSync(file).size, 0);

console.log(JSON.stringify({
  ok: true,
  storageRoot,
  activeAssetRecords: activeAssets.length,
  customerAssetFiles: files.length,
  totalBytes,
  backupRecommended: true,
  cleanupPolicy: {
    softDeletedRetentionDays: Number(process.env.STORAGE_DELETED_RETENTION_DAYS || 30),
    orphanRetentionDays: Number(process.env.STORAGE_ORPHAN_RETENTION_DAYS || 7)
  }
}, null, 2));
