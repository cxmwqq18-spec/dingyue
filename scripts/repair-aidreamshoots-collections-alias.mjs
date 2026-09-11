import crypto from "node:crypto";
import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget, buildTunneledDatabaseUrl } from "./lib/database-target.mjs";

const targetSiteId = "site_mydreamshoots_xby";
const targetDomain = "aidreamshoots.eu";
const confirm = "--confirm=aidreamshoots-from-mydreamshoots-production";
const apply = process.argv.includes("--apply");
if (!process.argv.includes(confirm)) throw new Error(`requires ${confirm}`);
process.env.DINGYUE_ENV = "remote";
process.env.DATABASE_TARGET = "remote";
process.env.DATABASE_URL = buildTunneledDatabaseUrl(process.env.REMOTE_DB_DATABASE_URL, { host: "127.0.0.1", port: 15432 });
assertDatabaseTarget({ expectedTarget: "remote" });

const prisma = new PrismaClient();
const protectedModels = ["customer", "customerProfile", "customerSession", "subscription", "order", "paymentEvent", "creditLedger", "creditBalance", "generationJob", "assetUpload", "album", "customerAssetDownload", "customerModel", "siteAdmin", "siteAdminSession", "siteApiKey", "stripeConnectAccount", "aiGatewayGroup"];
const publicModels = ["siteDomain", "themeSettings", "storefrontProfile", "livePage", "themePage", "product", "creativePackCategory", "creativePack", "toolCategory", "toolMenuItem", "videoThemeCategory", "videoTheme", "videoThemeExample", "videoThemeSlugRedirect", "mediaAsset", "siteTheme", "siteAiApp"];

function stable(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}

function digest(value) {
  return crypto.createHash("sha256").update(stable(value)).digest("hex");
}

function compatibilityAliasPageJson(value, canonicalPath) {
  const next = JSON.parse(JSON.stringify(value ?? {}));
  next.seo = { ...(next.seo ?? {}), canonicalPath };
  return next;
}

async function protectedFingerprint(siteId) {
  const entries = await Promise.all(protectedModels.map(async (model) => [model, digest(await prisma[model].findMany({ where: { siteId }, orderBy: { id: "asc" } }))]));
  return Object.fromEntries(entries);
}

async function unrelatedFingerprint() {
  const sites = await prisma.site.findMany({ where: { id: { not: targetSiteId } }, select: { id: true }, orderBy: { id: "asc" } });
  const entries = [];
  for (const site of sites) {
    const siteRow = await prisma.site.findUnique({ where: { id: site.id } });
    const publicRows = [];
    for (let index = 0; index < publicModels.length; index += 4) {
      publicRows.push(...await Promise.all(publicModels.slice(index, index + 4).map((model) => prisma[model].findMany({ where: { siteId: site.id }, orderBy: { id: "asc" } }))));
    }
    entries.push([site.id, digest({ site: siteRow, ...Object.fromEntries(publicModels.map((model, index) => [model, publicRows[index]])) })]);
  }
  return Object.fromEntries(entries);
}

async function readRows() {
  const [site, liveRoot, themeRoot, liveVideoRoot, themeVideoRoot, liveAlias, themeAlias, liveToolsAlias, themeToolsAlias] = await Promise.all([
    prisma.site.findUnique({ where: { id: targetSiteId }, select: { id: true, slug: true, primaryDomain: true } }),
    prisma.livePage.findUnique({ where: { siteId_slug: { siteId: targetSiteId, slug: "/ai-image-generation" } } }),
    prisma.themePage.findUnique({ where: { siteId_slug: { siteId: targetSiteId, slug: "/ai-image-generation" } } }),
    prisma.livePage.findUnique({ where: { siteId_slug: { siteId: targetSiteId, slug: "/ai-video-generation" } } }),
    prisma.themePage.findUnique({ where: { siteId_slug: { siteId: targetSiteId, slug: "/ai-video-generation" } } }),
    prisma.livePage.findUnique({ where: { siteId_slug: { siteId: targetSiteId, slug: "/collections" } } }),
    prisma.themePage.findUnique({ where: { siteId_slug: { siteId: targetSiteId, slug: "/collections" } } }),
    prisma.livePage.findUnique({ where: { siteId_slug: { siteId: targetSiteId, slug: "/tools" } } }),
    prisma.themePage.findUnique({ where: { siteId_slug: { siteId: targetSiteId, slug: "/tools" } } })
  ]);
  if (!site || site.primaryDomain !== targetDomain || site.slug !== "aidreamshoots") throw new Error("target_site_identity_mismatch");
  if (!liveRoot || !themeRoot || !liveVideoRoot || !themeVideoRoot) throw new Error("target_root_page_missing");
  return { site, liveRoot, themeRoot, liveVideoRoot, themeVideoRoot, liveAlias, themeAlias, liveToolsAlias, themeToolsAlias };
}

async function main() {
  const before = await readRows();
  const protectedBefore = await protectedFingerprint(targetSiteId);
  const unrelatedBefore = await unrelatedFingerprint();
  const live = { id: before.liveAlias?.id ?? `page_${targetSiteId}_collections_alias`, siteId: targetSiteId, pageType: before.liveRoot.pageType, templateKey: before.liveRoot.templateKey, slug: "/collections", title: "Paquetes de fotos IA", contentJson: compatibilityAliasPageJson(before.liveRoot.contentJson, "/collections") };
  const theme = { id: before.themeAlias?.id ?? `theme_page_${targetSiteId}_collections_alias`, siteId: targetSiteId, pageType: before.themeRoot.pageType, templateKey: before.themeRoot.templateKey, slug: "/collections", title: "Paquetes de fotos IA", draftJson: compatibilityAliasPageJson(before.themeRoot.draftJson, "/collections"), publishedJson: compatibilityAliasPageJson(before.themeRoot.publishedJson, "/collections"), draftMeta: before.themeRoot.draftMeta };
  const liveTools = { id: before.liveToolsAlias?.id ?? `page_${targetSiteId}_tools_alias`, siteId: targetSiteId, pageType: before.liveVideoRoot.pageType, templateKey: before.liveVideoRoot.templateKey, slug: "/tools", title: "Herramientas de IA", contentJson: compatibilityAliasPageJson(before.liveVideoRoot.contentJson, "/tools") };
  const themeTools = { id: before.themeToolsAlias?.id ?? `theme_page_${targetSiteId}_tools_alias`, siteId: targetSiteId, pageType: before.themeVideoRoot.pageType, templateKey: before.themeVideoRoot.templateKey, slug: "/tools", title: "Herramientas de IA", draftJson: compatibilityAliasPageJson(before.themeVideoRoot.draftJson, "/tools"), publishedJson: compatibilityAliasPageJson(before.themeVideoRoot.publishedJson, "/tools"), draftMeta: before.themeVideoRoot.draftMeta };
  const report = {
    schema: "aidreamshoots-collections-compatibility-alias/v1",
    target: { siteId: targetSiteId, domain: targetDomain },
    apply,
    writeSet: ["LivePage:/collections", "ThemePage:/collections", "LivePage:/tools", "ThemePage:/tools"],
    sourceRows: { livePageCollections: "/ai-image-generation", themePageCollections: "/ai-image-generation", livePageTools: "/ai-video-generation", themePageTools: "/ai-video-generation" },
    before: { liveAlias: before.liveAlias ? { id: before.liveAlias.id, title: before.liveAlias.title } : null, themeAlias: before.themeAlias ? { id: before.themeAlias.id, title: before.themeAlias.title } : null, liveToolsAlias: before.liveToolsAlias ? { id: before.liveToolsAlias.id, title: before.liveToolsAlias.title } : null, themeToolsAlias: before.themeToolsAlias ? { id: before.themeToolsAlias.id, title: before.themeToolsAlias.title } : null },
    protection: { targetProtectedFingerprint: protectedBefore, unrelatedPublicFingerprint: unrelatedBefore }
  };
  if (apply) {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Site" WHERE "id" = ${targetSiteId} FOR UPDATE`;
      await tx.livePage.upsert({ where: { siteId_slug: { siteId: targetSiteId, slug: "/collections" } }, create: live, update: { pageType: live.pageType, templateKey: live.templateKey, title: live.title, contentJson: live.contentJson } });
      await tx.themePage.upsert({ where: { siteId_slug: { siteId: targetSiteId, slug: "/collections" } }, create: theme, update: { pageType: theme.pageType, templateKey: theme.templateKey, title: theme.title, draftJson: theme.draftJson, publishedJson: theme.publishedJson, draftMeta: theme.draftMeta } });
      await tx.livePage.upsert({ where: { siteId_slug: { siteId: targetSiteId, slug: "/tools" } }, create: liveTools, update: { pageType: liveTools.pageType, templateKey: liveTools.templateKey, title: liveTools.title, contentJson: liveTools.contentJson } });
      await tx.themePage.upsert({ where: { siteId_slug: { siteId: targetSiteId, slug: "/tools" } }, create: themeTools, update: { pageType: themeTools.pageType, templateKey: themeTools.templateKey, title: themeTools.title, draftJson: themeTools.draftJson, publishedJson: themeTools.publishedJson, draftMeta: themeTools.draftMeta } });
      await tx.auditLog.create({ data: { id: `audit_${targetSiteId}_collections_alias_${Date.now()}`, siteId: targetSiteId, actorId: "platform", actorType: "platform", action: "site.aidreamshoots.collections-alias", targetType: "site", targetId: targetSiteId, metadata: { sourcePath: "/ai-image-generation", targetPath: "/collections" } } });
    }, { timeout: 120000, maxWait: 20000 });
    const protectedAfter = await protectedFingerprint(targetSiteId);
    const unrelatedAfter = await unrelatedFingerprint();
    if (stable(protectedBefore) !== stable(protectedAfter)) throw new Error("protected_target_records_changed");
    if (stable(unrelatedBefore) !== stable(unrelatedAfter)) throw new Error("unrelated_site_public_records_changed");
    report.after = { targetProtectedFingerprint: protectedAfter, unrelatedPublicFingerprint: unrelatedAfter };
  }
  console.log(JSON.stringify({ ok: true, ...report }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
