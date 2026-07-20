import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const siteId = "site_aidreamcapes";
const visualTitle = "ልiጋreamርapes";
const readableTitle = "Aidreamcapes";
const companyName = "Aidreamcapes.com";
const companyAddress = "30 N GOULD ST STE R,SHERIDAN,WY 82801";
const contactPhone = "";
const supportEmail = "support@aidreamcapes.com";
const taxId = "";
const logoImageUrl = "/assets/sites/site_aidreamcapes/brand/aidreamcapesai-logo-refined.svg?v=20260708c";
const logoAlt = "Aidreamcapes logo for AI travel portraits and private destination galleries";

function cloneJson(value) {
  if (!value || typeof value !== "object") return {};
  return JSON.parse(JSON.stringify(value));
}

function syncSettingsJson(value) {
  const next = cloneJson(value);
  next.globalSections ??= {};
  next.globalSections.header ??= { type: "header", settings: {}, blocks: [] };
  next.globalSections.footer ??= { type: "footer", settings: {}, blocks: [] };
  next.globalSections.header.settings = {
    ...(next.globalSections.header.settings ?? {}),
    title: visualTitle,
    logoImageUrl,
    logoAlt
  };
    next.globalSections.footer.settings = {
      ...(next.globalSections.footer.settings ?? {}),
      title: visualTitle,
      logoImageUrl,
      logoAlt,
      companyName,
      contactAddress: companyAddress,
      contactPhone,
      contactEmail: supportEmail,
      taxIdLabel: "",
      taxId,
      salesEmail: ""
    };
  return next;
}

async function main() {
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) throw new Error(`Missing site ${siteId}`);
  const branding = site.branding && typeof site.branding === "object" && !Array.isArray(site.branding)
    ? site.branding
    : {};

  const settings = await prisma.themeSettings.findUnique({ where: { siteId } });
  if (settings) {
    await prisma.themeSettings.update({
      where: { siteId },
      data: {
        draftJson: syncSettingsJson(settings.draftJson),
        publishedJson: syncSettingsJson(settings.publishedJson)
      }
    });
  }

  const themes = await prisma.siteTheme.findMany({
    where: { siteId },
    select: { id: true, settings: true }
  });
  for (const theme of themes) {
    await prisma.siteTheme.update({
      where: { id: theme.id },
      data: { settings: syncSettingsJson(theme.settings) }
    });
  }

  await prisma.site.update({
    where: { id: siteId },
    data: {
      name: readableTitle,
      branding: {
        ...branding,
        logoText: visualTitle,
        logoImageUrl
      }
    }
  });

  console.log(JSON.stringify({
    ok: true,
    siteId,
    visualTitle,
    companyAddress,
    supportEmail,
    salesEmail: "",
    updatedThemeCount: themes.length
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
