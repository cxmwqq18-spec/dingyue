import fs from "node:fs";
import path from "node:path";
import { loadRuntimeEnv } from "./load-runtime-env.mjs";

loadRuntimeEnv();

const dataDir = path.join(process.cwd(), "data");
const statePath = path.join(dataDir, "platform-state.json");
const legacyStorageRoot = path.resolve(process.env.STORAGE_ROOT || dataDir);
const publicDir = path.resolve(process.cwd(), "public");

function customerAssetRoot() {
  const configured = process.env.CUSTOMER_ASSET_STORAGE_ROOT?.trim();
  if (configured) return path.resolve(configured);
  const productionAppRoot = process.env.CUSTOMER_ASSET_APP_ROOT?.trim();
  if (productionAppRoot && process.env.NODE_ENV === "production") {
    return path.join(path.resolve(productionAppRoot), "shared", "customer-assets");
  }
  if (process.env.NODE_ENV === "production" && process.cwd().includes(`${path.sep}releases${path.sep}`)) {
    return path.resolve(process.cwd(), "..", "..", "shared", "customer-assets");
  }
  if (process.env.NODE_ENV === "production" && process.cwd().startsWith(`${path.sep}www${path.sep}wwwroot${path.sep}mydreamshoots.com${path.sep}`)) {
    return `${path.sep}www${path.sep}wwwroot${path.sep}mydreamshoots.com${path.sep}shared${path.sep}customer-assets`;
  }
  return path.join(process.cwd(), "data", "customer-assets");
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const storageRoot = customerAssetRoot();

if (storageRoot === publicDir || storageRoot.startsWith(`${publicDir}${path.sep}`)) {
  throw new Error("storage_root_must_not_be_under_public");
}

const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, "utf8")) : { assetUploads: [] };
const activeAssets = (state.assetUploads || []).filter((asset) => !asset.deletedAt);
const files = walk(storageRoot);
const totalBytes = files.reduce((sum, file) => sum + fs.statSync(file).size, 0);

console.log(JSON.stringify({
  ok: true,
  storageRoot,
  legacyStorageRoot,
  customerAssetStorageRootConfigured: Boolean(process.env.CUSTOMER_ASSET_STORAGE_ROOT?.trim()),
  customerAssetAppRootConfigured: Boolean(process.env.CUSTOMER_ASSET_APP_ROOT?.trim()),
  activeAssetRecords: activeAssets.length,
  customerAssetFiles: files.length,
  totalBytes,
  backupRecommended: true,
  cleanupPolicy: {
    softDeletedRetentionDays: Number(process.env.STORAGE_DELETED_RETENTION_DAYS || 30),
    orphanRetentionDays: Number(process.env.STORAGE_ORPHAN_RETENTION_DAYS || 7)
  }
}, null, 2));
