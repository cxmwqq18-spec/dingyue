import fs from "node:fs";
import path from "node:path";
import { readPlatformStateFromSql } from "./lib/platform-state-sql.mjs";

const sourceSiteId = argValue("--source") || "site_grownstride_test";
const targetSiteId = argValue("--target") || "site_dreamshoot";

function argValue(name) {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(name);
  if (index >= 0 && index + 1 < process.argv.length) return process.argv[index + 1];
  return undefined;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function siteById(state, id) {
  return asArray(state.sites).find((site) => site.id === id || site.slug === id);
}

function lower(value) {
  return String(value ?? "").toLowerCase();
}

function ids(rows) {
  return new Set(asArray(rows).map((row) => row?.id).filter(Boolean));
}

function sharedIds(leftRows, rightRows) {
  const left = ids(leftRows);
  const right = ids(rightRows);
  return [...left].filter((id) => right.has(id));
}

function noIndexForSite(site) {
  const seo = site?.themeSettings?.publishedJson?.seo || site?.themeSettings?.draftJson?.seo || {};
  return seo?.robots?.index === false || seo?.index === false;
}

function mediaNamespaceOk(row, siteId, siteSlug) {
  const storageKey = String(row?.storageKey || "");
  const previewUrl = String(row?.previewUrl || "");
  const originUrl = String(row?.originUrl || "");
  if (siteId === "site_grownstride_test") {
    return storageKey.startsWith("sites/site_grownstride_test/") && (!previewUrl || previewUrl.startsWith("/assets/sites/site_grownstride_test/")) && (!originUrl || originUrl.startsWith("/assets/sites/site_grownstride_test/"));
  }
  if (siteId === "site_dreamshoot") {
    return storageKey.startsWith("sites/site_dreamshoot/") && (!previewUrl || previewUrl.startsWith("/assets/dreamshoot/") || previewUrl.startsWith("/assets/sites/site_dreamshoot/")) && (!originUrl || originUrl.startsWith("/assets/dreamshoot/") || originUrl.startsWith("/assets/sites/site_dreamshoot/"));
  }
  return storageKey.includes(siteSlug) || previewUrl.includes(siteSlug) || originUrl.includes(siteSlug);
}

function formatRows(rows) {
  return asArray(rows).map((row) => row?.id).filter(Boolean);
}

function flattenPrices(state, siteId) {
  return asArray(state.products)
    .filter((product) => product.siteId === siteId)
    .flatMap((product) =>
      asArray(product.prices).map((price) => ({
        ...price,
        siteId: price.siteId ?? siteId,
        productId: price.productId ?? product.id
      }))
    );
}

async function main() {
  const state = await readPlatformStateFromSql();
  const sourceSite = siteById(state, sourceSiteId);
  const targetSite = siteById(state, targetSiteId);
  const errors = [];
  const summary = {};

  if (!sourceSite) errors.push(`missing source site ${sourceSiteId}`);
  if (!targetSite) errors.push(`missing target site ${targetSiteId}`);
  if (errors.length) {
    console.error(JSON.stringify({ ok: false, errors }, null, 2));
    process.exit(1);
  }

  const sourceDomains = asArray(state.siteDomains).filter((row) => row.siteId === sourceSiteId).map((row) => lower(row.domain));
  const targetDomains = asArray(state.siteDomains).filter((row) => row.siteId === targetSiteId).map((row) => lower(row.domain));
  const domainOverlap = sourceDomains.filter((domain) => targetDomains.includes(domain));
  if (domainOverlap.length) errors.push(`domain overlap: ${domainOverlap.join(", ")}`);
  if (!sourceDomains.some((domain) => domain.includes("grownstride"))) errors.push("source site is missing grownstride domains");
  if (!targetDomains.some((domain) => domain.includes("mydreamshoots"))) errors.push("target site is missing mydreamshoots domains");
  if (sourceDomains.some((domain) => domain.includes("mydreamshoots"))) errors.push("source grownstride site must not bind mydreamshoots domains");
  if (targetDomains.some((domain) => domain.includes("grownstride"))) errors.push("target mydreamshoots site must not bind grownstride domains");

  const siteAdminRows = asArray(state.siteAdmins);
  const sourceAdmins = siteAdminRows.filter((row) => row.siteId === sourceSiteId);
  const targetAdmins = siteAdminRows.filter((row) => row.siteId === targetSiteId);
  const sharedAdminIds = sharedIds(sourceAdmins, targetAdmins);
  const sharedAdminEmails = [...new Set(sourceAdmins.map((row) => lower(row.email)).filter(Boolean))].filter((email) =>
    targetAdmins.some((row) => lower(row.email) === email)
  );
  if (sharedAdminIds.length) errors.push(`shared site admin ids: ${sharedAdminIds.join(", ")}`);
  if (sharedAdminEmails.length) errors.push(`shared site admin emails: ${sharedAdminEmails.join(", ")}`);

  const contentTables = [
    ["pages", sourceSite.pages, targetSite.pages],
    ["products", asArray(state.products).filter((row) => row.siteId === sourceSiteId), asArray(state.products).filter((row) => row.siteId === targetSiteId)],
    ["prices", flattenPrices(state, sourceSiteId), flattenPrices(state, targetSiteId)],
    ["siteAiApps", asArray(state.siteAiApps).filter((row) => row.siteId === sourceSiteId), asArray(state.siteAiApps).filter((row) => row.siteId === targetSiteId)],
    ["creativePackCategories", asArray(state.creativePackCategories).filter((row) => row.siteId === sourceSiteId), asArray(state.creativePackCategories).filter((row) => row.siteId === targetSiteId)],
    ["creativePacks", asArray(state.creativePacks).filter((row) => row.siteId === sourceSiteId), asArray(state.creativePacks).filter((row) => row.siteId === targetSiteId)],
    ["mediaAssets", asArray(state.mediaAssets).filter((row) => row.siteId === sourceSiteId), asArray(state.mediaAssets).filter((row) => row.siteId === targetSiteId)],
    ["siteThemes", asArray(state.siteThemes).filter((row) => row.siteId === sourceSiteId), asArray(state.siteThemes).filter((row) => row.siteId === targetSiteId)],
    ["themeCopies", asArray(state.themeCopies).filter((row) => row.siteId === sourceSiteId), asArray(state.themeCopies).filter((row) => row.siteId === targetSiteId)],
    ["themePublications", asArray(state.themePublications).filter((row) => row.siteId === sourceSiteId), asArray(state.themePublications).filter((row) => row.siteId === targetSiteId)],
    ["toolCategories", asArray(state.toolCategories).filter((row) => row.siteId === sourceSiteId), asArray(state.toolCategories).filter((row) => row.siteId === targetSiteId)],
    ["toolMenuItems", asArray(state.toolMenuItems).filter((row) => row.siteId === sourceSiteId), asArray(state.toolMenuItems).filter((row) => row.siteId === targetSiteId)],
    ["videoThemeCategories", asArray(state.videoThemeCategories).filter((row) => row.siteId === sourceSiteId), asArray(state.videoThemeCategories).filter((row) => row.siteId === targetSiteId)],
    ["videoThemes", asArray(state.videoThemes).filter((row) => row.siteId === sourceSiteId), asArray(state.videoThemes).filter((row) => row.siteId === targetSiteId)]
  ];

  for (const [key, sourceRows, targetRows] of contentTables) {
    const overlap = sharedIds(sourceRows, targetRows);
    if (overlap.length) errors.push(`${key} shared ids: ${overlap.join(", ")}`);
    summary[key] = { source: asArray(sourceRows).length, target: asArray(targetRows).length, shared: overlap.length };
  }

  const protectedTables = [
    ["customers", asArray(state.customers).filter((row) => row.siteId === sourceSiteId), asArray(state.customers).filter((row) => row.siteId === targetSiteId)],
    ["customerSessions", asArray(state.customerSessions).filter((row) => row.siteId === sourceSiteId), asArray(state.customerSessions).filter((row) => row.siteId === targetSiteId)],
    ["customerEmailVerifications", asArray(state.customerEmailVerifications).filter((row) => row.siteId === sourceSiteId), asArray(state.customerEmailVerifications).filter((row) => row.siteId === targetSiteId)],
    ["subscriptions", asArray(state.subscriptions).filter((row) => row.siteId === sourceSiteId), asArray(state.subscriptions).filter((row) => row.siteId === targetSiteId)],
    ["orders", asArray(state.orders).filter((row) => row.siteId === sourceSiteId), asArray(state.orders).filter((row) => row.siteId === targetSiteId)],
    ["paymentEvents", asArray(state.paymentEvents).filter((row) => row.siteId === sourceSiteId), asArray(state.paymentEvents).filter((row) => row.siteId === targetSiteId)],
    ["ledger", asArray(state.ledger).filter((row) => row.siteId === sourceSiteId), asArray(state.ledger).filter((row) => row.siteId === targetSiteId)],
    ["assetUploads", asArray(state.assetUploads).filter((row) => row.siteId === sourceSiteId), asArray(state.assetUploads).filter((row) => row.siteId === targetSiteId)],
    ["customerModels", asArray(state.customerModels).filter((row) => row.siteId === sourceSiteId), asArray(state.customerModels).filter((row) => row.siteId === targetSiteId)],
    ["albums", asArray(state.albums).filter((row) => row.siteId === sourceSiteId), asArray(state.albums).filter((row) => row.siteId === targetSiteId)],
    ["jobs", asArray(state.jobs).filter((row) => row.siteId === sourceSiteId), asArray(state.jobs).filter((row) => row.siteId === targetSiteId)]
  ];

  for (const [key, sourceRows, targetRows] of protectedTables) {
    const overlap = sharedIds(sourceRows, targetRows);
    if (overlap.length) errors.push(`${key} shared ids: ${overlap.join(", ")}`);
    summary[key] = { source: asArray(sourceRows).length, target: asArray(targetRows).length, shared: overlap.length };
  }

  const sourceNoIndex = noIndexForSite(sourceSite);
  const targetNoIndex = noIndexForSite(targetSite);
  if (!sourceNoIndex) errors.push("source grownstride test site must stay noindex");
  if (targetNoIndex) errors.push("target mydreamshoots site must not be noindex");

  const sourceMediaNamespaceFailures = asArray(state.mediaAssets)
    .filter((row) => row.siteId === sourceSiteId && !mediaNamespaceOk(row, sourceSiteId, sourceSite.slug))
    .map((row) => row.id);
  const targetMediaNamespaceFailures = asArray(state.mediaAssets)
    .filter((row) => row.siteId === targetSiteId && !mediaNamespaceOk(row, targetSiteId, targetSite.slug))
    .map((row) => row.id);
  if (sourceMediaNamespaceFailures.length) errors.push(`source media namespace mismatch: ${sourceMediaNamespaceFailures.join(", ")}`);
  if (targetMediaNamespaceFailures.length) errors.push(`target media namespace mismatch: ${targetMediaNamespaceFailures.join(", ")}`);

  const result = {
    ok: errors.length === 0,
    sourceSiteId,
    targetSiteId,
    sourceDomains,
    targetDomains,
    sourceNoIndex,
    targetNoIndex,
    summary,
    sourcePages: formatRows(sourceSite.pages),
    targetPages: formatRows(targetSite.pages),
    sourceMediaNamespaceFailures,
    targetMediaNamespaceFailures,
    errors
  };

  if (errors.length) {
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
