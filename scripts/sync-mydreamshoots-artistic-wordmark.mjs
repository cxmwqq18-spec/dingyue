import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const WORDMARK = "myᕲreamshoots";
const PLAIN_WORDMARK_RE = /^(MyDreamShoots|MydreamShoots|Mydreamshoots)$/;

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function changed(before, after) {
  return JSON.stringify(before) !== JSON.stringify(after);
}

function setDisplayTitle(settings) {
  if (!settings || typeof settings !== "object") return;
  if (PLAIN_WORDMARK_RE.test(settings.title ?? "")) settings.title = WORDMARK;
  if (PLAIN_WORDMARK_RE.test(settings.logoText ?? "")) settings.logoText = WORDMARK;
}

function syncThemeJson(value) {
  if (!value || typeof value !== "object") return value;

  if (Array.isArray(value)) {
    for (const item of value) syncThemeJson(item);
    return value;
  }

  if (value.branding && typeof value.branding === "object") {
    setDisplayTitle(value.branding);
  }

  if (value.globalSections && typeof value.globalSections === "object") {
    setDisplayTitle(value.globalSections.header?.settings);
    setDisplayTitle(value.globalSections.footer?.settings);
  }

  if (value.settings_data?.current && typeof value.settings_data.current === "object") {
    syncThemeJson(value.settings_data.current);
  }

  if (value.sections && typeof value.sections === "object") {
    setDisplayTitle(value.sections.header_plus?.settings);
    setDisplayTitle(value.sections.footer_plus?.settings);
  }

  if (value.settings && typeof value.settings === "object" && /MyDreamShoots (header|footer)/i.test(value.card_name ?? "")) {
    setDisplayTitle(value.settings);
  }

  if (typeof value.logoText === "string" && PLAIN_WORDMARK_RE.test(value.logoText)) {
    value.logoText = WORDMARK;
  }

  for (const child of Object.values(value)) {
    syncThemeJson(child);
  }

  return value;
}

async function main() {
  const sites = await prisma.site.findMany({
    where: {
      OR: [
        { id: "site_dreamshoot" },
        { slug: "mydreamshoots" },
        { primaryDomain: { in: ["mydreamshoots.com", "www.mydreamshoots.com"] } }
      ]
    },
    select: { id: true, branding: true, slug: true, primaryDomain: true }
  });

  if (!sites.length) throw new Error("MyDreamShoots site not found");

  const result = { sites: 0, themeSettings: 0, siteThemes: 0, themePublications: 0 };

  for (const site of sites) {
    const branding = cloneJson(site.branding) ?? {};
    setDisplayTitle(branding);
    if (changed(site.branding, branding)) {
      await prisma.site.update({ where: { id: site.id }, data: { branding } });
      result.sites += 1;
    }

    const settings = await prisma.themeSettings.findUnique({ where: { siteId: site.id } });
    if (settings) {
      const draftJson = syncThemeJson(cloneJson(settings.draftJson));
      const publishedJson = syncThemeJson(cloneJson(settings.publishedJson));
      if (changed(settings.draftJson, draftJson) || changed(settings.publishedJson, publishedJson)) {
        await prisma.themeSettings.update({ where: { siteId: site.id }, data: { draftJson, publishedJson } });
        result.themeSettings += 1;
      }
    }

    for (const theme of await prisma.siteTheme.findMany({ where: { siteId: site.id } })) {
      const templates = syncThemeJson(cloneJson(theme.templates));
      const themeSettings = syncThemeJson(cloneJson(theme.settings));
      if (changed(theme.templates, templates) || changed(theme.settings, themeSettings)) {
        await prisma.siteTheme.update({ where: { id: theme.id }, data: { templates, settings: themeSettings } });
        result.siteThemes += 1;
      }
    }

    // Historical publications are immutable. Wordmark changes require a new publication.
  }

  console.log(`Synced MyDreamShoots artistic wordmark: ${JSON.stringify(result)}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
