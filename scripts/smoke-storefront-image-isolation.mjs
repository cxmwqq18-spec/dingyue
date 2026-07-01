import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const repoRoot = process.cwd();
const statePath = path.join(repoRoot, "data/platform-state.json");
const publicRoot = path.join(repoRoot, "public");
const state = JSON.parse(fs.readFileSync(statePath, "utf8"));

const siteIds = ["site_dreamshoot", "site_aidreamcapes"];
const failures = [];

function normalizeImageUrl(value) {
  if (typeof value !== "string") return "";
  const [url] = value.split("?");
  return url.startsWith("/assets/") ? url : "";
}

function localFileForUrl(url) {
  return path.join(publicRoot, url);
}

function hashFile(url) {
  const filePath = localFileForUrl(url);
  if (!fs.existsSync(filePath)) {
    failures.push(`missing_image_file:${url}`);
    return "";
  }
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

async function perceptualHashFile(url) {
  const filePath = localFileForUrl(url);
  if (!fs.existsSync(filePath)) return "";
  const { data } = await sharp(filePath)
    .resize(9, 8, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let bits = "";
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const left = data[y * 9 + x];
      const right = data[y * 9 + x + 1];
      bits += left > right ? "1" : "0";
    }
  }
  return bits;
}

function hammingDistance(left, right) {
  if (!left || !right || left.length !== right.length) return Number.POSITIVE_INFINITY;
  let distance = 0;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) distance += 1;
  }
  return distance;
}

function addImage(records, siteId, scope, context, value) {
  const url = normalizeImageUrl(value);
  if (!url) return;
  const stableContext = context.replace(/^(?:site_[^:]+|publication:[^:]+):/, "");
  records.push({ siteId, scope, context: stableContext, url });
}

function walkThemeObject(value, callback) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item) => walkThemeObject(item, callback));
    return;
  }
  callback(value);
  Object.values(value).forEach((item) => walkThemeObject(item, callback));
}

function collectStorefrontImages(siteId) {
  const records = [];

  for (const pack of state.creativePacks ?? []) {
    if (pack.siteId !== siteId) continue;
    addImage(records, siteId, "creative-pack-cover", `pack:${pack.slug ?? pack.id}:cover`, pack.imageUrl ?? pack.coverImageUrl);
  }

  for (const category of state.creativePackCategories ?? []) {
    if (category.siteId !== siteId) continue;
    addImage(records, siteId, "category", `category:${category.slug ?? category.id}`, category.imageUrl);
  }

  for (const item of state.toolMenuItems ?? []) {
    if (item.siteId !== siteId || item.status === "inactive") continue;
    addImage(records, siteId, "tool-menu", `tool-menu:${item.slug ?? item.href ?? item.title}`, item.imageUrl);
  }

  for (const theme of state.siteThemes ?? []) {
    if (theme.siteId !== siteId) continue;
    walkThemeObject(theme, (node) => {
      const type = node.type;
      const settings = node.settings;
      if (!settings || typeof settings !== "object") return;
      if (!["catalog_pack", "proof_card", "taxonomy_card", "tool_card"].includes(type)) return;
      const title = typeof settings.title === "string" ? settings.title : node.id;
      addImage(records, siteId, type, `${theme.themeId ?? theme.id}:${type}:${title}`, settings.imageUrl);
    });
  }

  for (const publication of state.themePublications ?? []) {
    if (publication.siteId !== siteId) continue;
    walkThemeObject(publication.snapshot, (node) => {
      const type = node.type;
      const settings = node.settings;
      if (!settings || typeof settings !== "object") return;
      if (!["catalog_pack", "proof_card", "taxonomy_card", "tool_card"].includes(type)) return;
      const title = typeof settings.title === "string" ? settings.title : node.id;
      addImage(records, siteId, type, `publication:${publication.id}:${type}:${title}`, settings.imageUrl);
    });
  }

  return records;
}

function duplicateGroups(items, keyFn) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return [...groups.entries()].filter(([, group]) => group.length > 1);
}

const recordsBySite = Object.fromEntries(siteIds.map((siteId) => [siteId, collectStorefrontImages(siteId)]));
const perceptualRecordsBySite = {};

for (const siteId of siteIds) {
  const uniqueRecords = [
    ...new Map(recordsBySite[siteId].map((record) => [`${record.scope}:${record.context}`, record])).values()
  ];
  const uniqueContextByUrl = duplicateGroups(uniqueRecords, (record) => `${record.scope}:${record.url}`)
    .map(([url, records]) => [
      url,
      [...new Set(records.map((record) => record.context))]
    ])
    .filter(([, contexts]) => contexts.length > 1);

  for (const [scopeAndUrl, contexts] of uniqueContextByUrl) {
    failures.push(`duplicate_storefront_image_url:${siteId}:${scopeAndUrl}:${contexts.join(" | ")}`);
  }
}

const hashesBySite = {};
for (const siteId of siteIds) {
  const uniqueUrlRecords = [...new Map(recordsBySite[siteId].map((record) => [`${record.scope}:${record.url}`, record])).values()];
  hashesBySite[siteId] = uniqueUrlRecords.map((record) => ({ ...record, hash: hashFile(record.url) })).filter((record) => record.hash);

  for (const [hash, records] of duplicateGroups(hashesBySite[siteId], (record) => `${record.scope}:${record.hash}`)) {
    failures.push(`duplicate_storefront_image_hash:${siteId}:${hash}:${records.map((record) => `${record.url} (${record.context})`).join(" | ")}`);
  }
}

const nearDuplicateScopes = new Set(["creative-pack-cover", "category", "catalog_pack", "taxonomy_card"]);
const nearDuplicateThreshold = 8;
for (const siteId of siteIds) {
  const perceptualRecords = [];
  const uniqueUrlRecords = [
    ...new Map(
      recordsBySite[siteId]
        .filter((record) => nearDuplicateScopes.has(record.scope))
        .map((record) => [`${record.scope}:${record.url}`, record])
    ).values()
  ];

  for (const record of uniqueUrlRecords) {
    const perceptualHash = await perceptualHashFile(record.url);
    if (perceptualHash) perceptualRecords.push({ ...record, perceptualHash });
  }
  perceptualRecordsBySite[siteId] = perceptualRecords;

  for (let leftIndex = 0; leftIndex < perceptualRecords.length; leftIndex += 1) {
    const left = perceptualRecords[leftIndex];
    for (let rightIndex = leftIndex + 1; rightIndex < perceptualRecords.length; rightIndex += 1) {
      const right = perceptualRecords[rightIndex];
      if (left.scope !== right.scope) continue;
      if (left.url === right.url) continue;
      if (left.context === right.context) continue;
      const distance = hammingDistance(left.perceptualHash, right.perceptualHash);
      if (distance > nearDuplicateThreshold) continue;
      failures.push(
        `near_duplicate_storefront_image:${siteId}:distance=${distance}:${left.url} (${left.context}) <> ${right.url} (${right.context})`
      );
    }
  }
}

for (const left of hashesBySite.site_dreamshoot ?? []) {
  for (const right of hashesBySite.site_aidreamcapes ?? []) {
    if (left.hash !== right.hash) continue;
    failures.push(`cross_storefront_image_hash:${left.hash}:site_dreamshoot:${left.url} (${left.context}) <> site_aidreamcapes:${right.url} (${right.context})`);
  }
}

for (const left of perceptualRecordsBySite.site_dreamshoot ?? []) {
  for (const right of perceptualRecordsBySite.site_aidreamcapes ?? []) {
    if (left.url === right.url) continue;
    const distance = hammingDistance(left.perceptualHash, right.perceptualHash);
    if (distance > nearDuplicateThreshold) continue;
    failures.push(
      `cross_storefront_near_duplicate_image:distance=${distance}:site_dreamshoot:${left.url} (${left.context}) <> site_aidreamcapes:${right.url} (${right.context})`
    );
  }
}

if (failures.length > 0) {
  console.error("Storefront image isolation smoke failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

for (const siteId of siteIds) {
  const urlCount = new Set(recordsBySite[siteId].map((record) => record.url)).size;
  console.log(`${siteId}: ${recordsBySite[siteId].length} checked references, ${urlCount} unique image URLs`);
}
console.log("Storefront image isolation smoke passed.");
