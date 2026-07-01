import "./load-runtime-env.mjs";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const brand = "MyDreamShoots";
const slug = "mydreamshoots";
const siteId = "site_dreamshoot";
const oldToolPaths = new Set(["/tools/image-studio", "/tools/ai-image-studio", "/tools/image_generator"]);

function replaceBrandText(value) {
  if (typeof value !== "string") return value;
  return value
    .replace(/DreamShootAI/g, brand)
    .replace(/DreamShoot/g, brand)
    .replace(/Mydreamshoots/g, brand)
    .replace(/on\|\s*/g, "on ")
    .replace(/\bmydreamshoots\b/g, brand)
    .replace(/\| MydreamShoots/g, `| ${brand}`);
}

function shouldPreserveLowercaseBrand(key, value) {
  if (typeof value !== "string") return false;
  if (key === "slug" || key === "domain" || key === "email" || key === "contactEmail" || key === "primaryDomain") return true;
  if (key.toLowerCase().includes("url") || key.toLowerCase().includes("href") || key.toLowerCase().includes("path")) return true;
  return /@mydreamshoots\.com|@mydreamshoots\.localhost|(^|\.)mydreamshoots\.com|(^|\.)mydreamshoots\.localhost/.test(value);
}

function toolPathForContext(context) {
  const value = String(context ?? "").toLowerCase();
  if (/world\\s*cup|fan|sports|stadium|match/.test(value)) return "/tools/world-cup-fan-photos";
  if (/headshot|linkedin|resume|professional|executive|founder|profile/.test(value)) return "/tools/headshot";
  if (/try-?on|outfit|wardrobe|style|hairstyle|beauty/.test(value)) return "/tools/virtual-try-on";
  if (/video|motion|clip|reel/.test(value)) return "/tools/image-to-video";
  if (/gala|formal|night|red.?carpet/.test(value)) return "/tools/gala-photo";
  if (/cyberpunk|neon/.test(value)) return "/tools/cyberpunk-portrait";
  if (/wedding|couple|ceremony|engagement/.test(value)) return "/tools/wedding-portraits";
  if (/creator|portrait|photo story|profile album|portfolio|social/.test(value)) return "/tools/creator-portrait";
  if (/editorial|fashion|studio set|magazine/.test(value)) return "/tools/fashion-editorial";
  return "/tools";
}

function staticHrefFor(value) {
  if (typeof value !== "string") return value;
  if (value.startsWith("/collections?")) {
    const category = new URLSearchParams(value.slice(value.indexOf("?") + 1)).get("category") ?? "";
    return category ? `/collections/${category.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}` : "/collections";
  }
  if (value.startsWith("/cart?")) return "/cart";
  return value;
}

function rewriteJson(value, context = "") {
  if (Array.isArray(value)) return value.map((item) => rewriteJson(item, context));
  if (!value || typeof value !== "object") return replaceBrandText(value);

  const localContext = [
    context,
    value.id,
    value.title,
    value.label,
    value.name,
    value.description,
    value.category,
    value.badge,
    value.meta,
    value.imageUrl,
    value.backgroundImage
  ].filter(Boolean).join(" ");

  const next = {};
  for (const [key, child] of Object.entries(value)) {
    if (typeof child === "string") {
      let text = shouldPreserveLowercaseBrand(key, child) ? child : replaceBrandText(child);
      if (key === "href" || key === "canonicalPath" || key === "primaryHref" || key === "secondaryHref") text = staticHrefFor(text);
      if (key === "slug" && oldToolPaths.has(text)) text = toolPathForContext(localContext) === "/tools" ? "/tools/headshot" : toolPathForContext(localContext);
      if ((key === "href" || key === "canonicalPath" || key === "primaryHref" || key === "secondaryHref") && oldToolPaths.has(text)) text = toolPathForContext(localContext);
      if ((key === "name" || key === "title" || key === "siteTitle" || key === "logoText") && text === "mydreamshoots") text = brand;
      next[key] = text;
    } else {
      next[key] = rewriteJson(child, localContext);
    }
  }
  return next;
}

async function main() {
  const site = await prisma.site.findUnique({ where: { id: siteId }, select: { id: true, slug: true, branding: true } });
  if (!site) throw new Error(`Missing ${siteId}`);

  const branding = rewriteJson({
    ...(site.branding && typeof site.branding === "object" ? site.branding : {}),
    logoText: brand
  });

  await prisma.site.update({
    where: { id: siteId },
    data: {
      name: brand,
      slug,
      branding
    }
  });

  await prisma.siteDomain.updateMany({
    where: { siteId, domain: "dreamshoot.localhost" },
    data: { domain: "mydreamshoots.localhost" }
  });

  await prisma.siteAdmin.updateMany({
    where: { siteId, email: "owner@dreamshoot.localhost" },
    data: { email: "owner@mydreamshoots.localhost", displayName: `${brand} Owner` }
  });

  const legacyCustomer = await prisma.customer.findFirst({
    where: { siteId, email: "nora@dreamshoot.localhost" },
    select: { id: true }
  });
  if (legacyCustomer) {
    const canonicalCustomer = await prisma.customer.findFirst({
      where: { siteId, email: "nora@mydreamshoots.localhost" },
      select: { id: true }
    });
    await prisma.customer.update({
      where: { id: legacyCustomer.id },
      data: {
        email: canonicalCustomer && canonicalCustomer.id !== legacyCustomer.id
          ? "nora.legacy@mydreamshoots.localhost"
          : "nora@mydreamshoots.localhost"
      }
    });
  }

  const settings = await prisma.themeSettings.findUnique({ where: { siteId } });
  if (settings) {
    await prisma.themeSettings.update({
      where: { siteId },
      data: {
        draftJson: rewriteJson(settings.draftJson),
        publishedJson: rewriteJson(settings.publishedJson)
      }
    });
  }

  const pages = await prisma.themePage.findMany({ where: { siteId } });
  for (const page of pages) {
    const nextSlug = oldToolPaths.has(page.slug) ? "/tools/headshot" : page.slug;
    await prisma.themePage.update({
      where: { id: page.id },
      data: {
        slug: nextSlug,
        title: replaceBrandText(page.title),
        draftJson: rewriteJson(page.draftJson),
        publishedJson: rewriteJson(page.publishedJson)
      }
    });
  }

  const themes = await prisma.siteTheme.findMany({ where: { siteId } });
  for (const theme of themes) {
    await prisma.siteTheme.update({
      where: { id: theme.id },
      data: {
        name: replaceBrandText(theme.name),
        templates: rewriteJson(theme.templates),
        settings: rewriteJson(theme.settings)
      }
    });
  }

  const publications = await prisma.themePublication.findMany({ where: { siteId } });
  for (const publication of publications) {
    await prisma.themePublication.update({
      where: { id: publication.id },
      data: { snapshot: rewriteJson(publication.snapshot) }
    });
  }

  const mediaAssets = await prisma.mediaAsset.findMany({ where: { siteId } });
  for (const asset of mediaAssets) {
    await prisma.mediaAsset.update({
      where: { id: asset.id },
      data: {
        label: replaceBrandText(asset.label),
        altText: asset.altText ? replaceBrandText(asset.altText) : asset.altText,
        notes: asset.notes ? replaceBrandText(asset.notes) : asset.notes
      }
    });
  }

  const products = await prisma.product.findMany({ where: { siteId } });
  for (const product of products) {
    await prisma.product.update({
      where: { id: product.id },
      data: { name: replaceBrandText(product.name) }
    });
  }

  const prices = await prisma.price.findMany({ where: { siteId } });
  for (const price of prices) {
    await prisma.price.update({
      where: { id: price.id },
      data: {
        label: replaceBrandText(price.label),
        metadata: price.metadata ? rewriteJson(price.metadata) : price.metadata
      }
    });
  }

  const packs = await prisma.creativePack.findMany({ where: { siteId } });
  for (const pack of packs) {
    await prisma.creativePack.update({
      where: { id: pack.id },
      data: {
        name: replaceBrandText(pack.name),
        headline: replaceBrandText(pack.headline),
        description: replaceBrandText(pack.description),
        prompt: pack.prompt ? replaceBrandText(pack.prompt) : pack.prompt
      }
    });
  }

  const cacheFile = path.join(process.cwd(), ".next", "cache", "platform-state-postgres.json");
  if (fs.existsSync(cacheFile)) fs.rmSync(cacheFile, { force: true });

  console.log(JSON.stringify({ ok: true, siteId, slug, brand, pages: pages.length, themes: themes.length, publications: publications.length }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
