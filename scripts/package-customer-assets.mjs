import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
const repoRoot = process.cwd();
const envPath = path.join(repoRoot, ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 0) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[key] = value;
  }
}

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const item = process.argv[index];
  if (!item.startsWith("--")) continue;
  const key = item.slice(2);
  const next = process.argv[index + 1];
  if (!next || next.startsWith("--")) {
    args.set(key, "1");
  } else {
    args.set(key, next);
    index += 1;
  }
}

const siteSlug = args.get("site") || "mydreamshoots";
const email = args.get("email") || "1621417163@qq.com";
const customerIdArg = args.get("customer-id") || "";
const siteIdArg = args.get("site-id") || "";
const take = Number(args.get("take") || "80");
const inputTakeArg = args.get("input-take");
const outputTakeArg = args.get("output-take");
const outDir = path.resolve(String(args.get("out") || "tmp/customer-asset-restore"));

function normalizeStorageKey(storageKey) {
  return String(storageKey || "").replace(/\\/g, "/").replace(/^\/+/, "").replace(/^customer-assets\//, "");
}

function localAssetRoot() {
  return path.join(repoRoot, "data", "customer-assets");
}

function ensureSafeStorageKey(storageKey) {
  const normalized = normalizeStorageKey(storageKey);
  if (!normalized || normalized.includes("..") || normalized.split("/").some((part) => part === "." || part === "")) {
    throw new Error(`unsafe storage key: ${storageKey}`);
  }
  return normalized;
}

async function assetRowsFromDatabase() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const site = await prisma.site.findUnique({ where: { slug: siteSlug }, select: { id: true, slug: true } });
    if (!site) throw new Error(`site not found: ${siteSlug}`);
    const customer = await prisma.customer.findUnique({
      where: { siteId_email: { siteId: site.id, email } },
      select: { id: true, email: true, name: true }
    });
    if (!customer) throw new Error(`customer not found: ${email}`);
    const assets = await prisma.assetUpload.findMany({
      where: { siteId: site.id, customerId: customer.id, deletedAt: null },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: Number.isFinite(take) ? Math.max(1, Math.min(take, 500)) : 80,
      select: { id: true, role: true, label: true, storageKey: true, createdAt: true }
    });
    return { site, customer, assets };
  } finally {
    await prisma.$disconnect();
  }
}

function assetRowsFromDirectory() {
  const siteId = siteIdArg || (siteSlug === "mydreamshoots" ? "site_dreamshoot" : `site_${siteSlug}`);
  const customerId = customerIdArg;
  if (!customerId) throw new Error("customer-id is required when database is unavailable");
  const dir = path.join(localAssetRoot(), "sites", siteId, "customers", customerId, "assets");
  if (!fs.existsSync(dir)) throw new Error(`customer asset directory not found: ${dir}`);
  const files = fs.readdirSync(dir)
    .map((fileName) => {
      const filePath = path.join(dir, fileName);
      const stat = fs.statSync(filePath);
      return { fileName, stat };
    })
    .filter((item) => item.stat.isFile())
    .sort((left, right) => right.stat.mtimeMs - left.stat.mtimeMs)
    .slice(0, Number.isFinite(take) ? Math.max(1, Math.min(take, 500)) : 80);
  return {
    site: { id: siteId, slug: siteSlug },
    customer: { id: customerId, email, name: "" },
    assets: files.map((item) => ({
      id: item.fileName,
      role: item.fileName.includes("-output-") ? "output" : "input",
      label: item.fileName,
      storageKey: `sites/${siteId}/customers/${customerId}/assets/${item.fileName}`,
      createdAt: item.stat.mtime.toISOString()
    }))
  };
}

function parseRoleLimit(value) {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.max(0, Math.min(Math.trunc(parsed), 500));
}

function limitAssetsByRole(assets) {
  const inputTake = parseRoleLimit(inputTakeArg);
  const outputTake = parseRoleLimit(outputTakeArg);
  if (inputTake === undefined && outputTake === undefined) return assets;
  const counts = new Map();
  return assets.filter((asset) => {
    const role = asset.role === "output" ? "output" : "input";
    const limit = role === "output" ? outputTake : inputTake;
    if (limit === undefined) return true;
    const current = counts.get(role) || 0;
    if (current >= limit) return false;
    counts.set(role, current + 1);
    return true;
  });
}

async function main() {
  let source;
  try {
    source = customerIdArg && args.get("from-dir") === "1" ? assetRowsFromDirectory() : await assetRowsFromDatabase();
  } catch (error) {
    if (!customerIdArg) throw error;
    console.warn(`Database lookup failed, packaging from local directory instead: ${error instanceof Error ? error.message : String(error)}`);
    source = assetRowsFromDirectory();
  }
  const { site, customer } = source;
  const assets = limitAssetsByRole(source.assets);
  fs.rmSync(outDir, { force: true, recursive: true });
  fs.mkdirSync(outDir, { recursive: true });
  const stageRoot = path.join(outDir, "customer-assets");
  const manifest = [];
  for (const asset of assets) {
    const storageKey = ensureSafeStorageKey(asset.storageKey);
    const source = path.join(localAssetRoot(), storageKey);
    if (!fs.existsSync(source)) {
      manifest.push({ ...asset, storageKey, status: "missing_local_file" });
      continue;
    }
    const target = path.join(stageRoot, storageKey);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
    manifest.push({ ...asset, storageKey, status: "packaged", bytes: fs.statSync(source).size });
  }
  const manifestPath = path.join(outDir, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify({
    site,
    customer,
    assetCount: assets.length,
    packagedCount: manifest.filter((item) => item.status === "packaged").length,
    createdAt: new Date().toISOString(),
    assets: manifest
  }, null, 2));
  const tarPath = path.join(outDir, `${site.slug}-${customer.id}-customer-assets.tar.gz`);
  const tar = spawnSync("tar", ["-czf", tarPath, "-C", stageRoot, "."], { stdio: "inherit" });
  if (tar.status !== 0) throw new Error("tar_failed");
  console.log(JSON.stringify({
    ok: true,
    tarPath,
    manifestPath,
    packagedCount: manifest.filter((item) => item.status === "packaged").length,
    missingCount: manifest.filter((item) => item.status !== "packaged").length
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
