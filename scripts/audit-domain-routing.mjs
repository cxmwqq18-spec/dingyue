import fs from "fs";
import path from "path";
import { readPlatformStateFromSql } from "./lib/platform-state-sql.mjs";

const domainRoutingPath = path.join(process.cwd(), "src", "lib", "domain-routing.ts");
const state = await readPlatformStateFromSql();
const domainRoutingSource = fs.readFileSync(domainRoutingPath, "utf8");

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

const platformHosts = ["www.mydreamshoots.xyz", "mydreamshoots.xyz"];
for (const host of platformHosts) {
  assert(domainRoutingSource.includes(`"${host}"`), `${host} must be registered as a platform host`);
  assert(!(state.siteDomains ?? []).some((domain) => domain.domain === host), `${host} must stay a platform host, not a public storefront domain`);
}

const grownstride = state.sites?.find((site) => site.id === "site_grownstride_test" || site.slug === "grownstride");
assert(grownstride, "missing grownstride MyDreamShoots test site");
assert(grownstride.primaryDomain === "test.grownstride.com", `grownstride primaryDomain must be test.grownstride.com, got ${grownstride.primaryDomain}`);
const grownstrideDomains = (state.siteDomains ?? []).filter((domain) => domain.siteId === grownstride.id);
const grownstridePrimary = grownstrideDomains.find((domain) => domain.domain === "test.grownstride.com");
const grownstrideWww = grownstrideDomains.find((domain) => domain.domain === "www.grownstride.com");
const grownstrideApex = grownstrideDomains.find((domain) => domain.domain === "grownstride.com");
assert(grownstridePrimary, "missing test.grownstride.com in siteDomains");
assert(grownstridePrimary.isPrimary, "test.grownstride.com must be the primary grownstride domain");
assert(grownstridePrimary.status === "active", `test.grownstride.com must be active, got ${grownstridePrimary.status}`);
assert(grownstrideWww, "missing www.grownstride.com legacy alias in siteDomains");
assert(!grownstrideWww.isPrimary, "www.grownstride.com must remain a non-primary grownstride alias");
assert(grownstrideWww.status === "active", `www.grownstride.com must be active, got ${grownstrideWww.status}`);
assert(grownstrideApex, "missing grownstride.com in siteDomains");
assert(!grownstrideApex.isPrimary, "grownstride.com should stay a non-primary alias while test.grownstride.com is primary");
assert(grownstrideApex.status === "active", `grownstride.com must be active, got ${grownstrideApex.status}`);
assert(!domainRoutingSource.includes(`"test.grownstride.com"`), "test.grownstride.com must not be registered as a platform host");
assert(!domainRoutingSource.includes(`"www.grownstride.com"`), "www.grownstride.com must not be registered as a platform host");
assert(!domainRoutingSource.includes(`"grownstride.com"`), "grownstride.com must not be registered as a platform host");

const siteAdminHosts = ["www.aidreamcapes.xyz", "aidreamcapes.xyz"];
for (const host of siteAdminHosts) {
  assert(domainRoutingSource.includes(`"${host}"`), `${host} must be registered as a site admin host`);
  assert(!(state.siteDomains ?? []).some((domain) => domain.domain === host), `${host} must stay a site admin host, not a public storefront domain`);
}
assert(!domainRoutingSource.includes("aidreamcapes.xyz.com"), "aidreamcapes.xyz.com is a typo and must not be registered");
assert(!(state.siteDomains ?? []).some((domain) => domain.domain === "www.javawebshop.site"), "www.javawebshop.site is retired and must not be bound to a site");

console.log(
  JSON.stringify(
    {
      platformHosts,
      siteAdminHosts,
      dreamshootPrimaryDomain: dreamshoot.primaryDomain,
      dreamshootDomainCount: dreamshootDomains.length,
      grownstridePrimaryDomain: grownstride.primaryDomain,
      grownstrideDomainCount: grownstrideDomains.length
    },
    null,
    2
  )
);
