import fs from "fs";
import path from "path";

const statePath = path.join(process.cwd(), "data", "platform-state.json");
const state = JSON.parse(fs.readFileSync(statePath, "utf8"));

function fail(message) {
  console.error(`Domain routing audit failed: ${message}`);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

const dreamshoot = state.sites?.find((site) => site.id === "site_dreamshoot" || site.slug === "dreamshoot");
assert(dreamshoot, "missing DreamShoot site");
assert(dreamshoot.primaryDomain === "www.mydreamshoots.com", `DreamShoot primaryDomain must be www.mydreamshoots.com, got ${dreamshoot.primaryDomain}`);

const dreamshootDomains = (state.siteDomains ?? []).filter((domain) => domain.siteId === dreamshoot.id);
const primary = dreamshootDomains.find((domain) => domain.domain === "www.mydreamshoots.com");
assert(primary, "missing www.mydreamshoots.com in siteDomains");
assert(primary.isPrimary, "www.mydreamshoots.com must be the primary DreamShoot domain");
assert(primary.status === "active", `www.mydreamshoots.com must be active, got ${primary.status}`);

const duplicateDomains = new Map();
for (const domain of state.siteDomains ?? []) {
  const key = String(domain.domain).toLowerCase();
  duplicateDomains.set(key, [...(duplicateDomains.get(key) ?? []), domain.siteId]);
}
for (const [domain, siteIds] of duplicateDomains) {
  assert(siteIds.length === 1, `${domain} is bound to multiple sites: ${siteIds.join(", ")}`);
}

assert(!(state.siteDomains ?? []).some((domain) => domain.domain === "www.mydreamshoots.xyz" || domain.domain === "mydreamshoots.xyz"), "mydreamshoots.xyz must stay a platform host, not a site domain");
assert(!(state.siteDomains ?? []).some((domain) => domain.domain === "www.javawebshop.site"), "www.javawebshop.site is retired and must not be bound to a site");

console.log(
  JSON.stringify(
    {
      platformHost: "www.mydreamshoots.xyz",
      dreamshootPrimaryDomain: dreamshoot.primaryDomain,
      dreamshootDomainCount: dreamshootDomains.length
    },
    null,
    2
  )
);
