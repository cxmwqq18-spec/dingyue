import "./load-runtime-env.mjs";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const replacements = new Map([
  ["AI photo packages that feel like a real shoot", "Studio-quality AI photos from the selfies on your phone."],
  ["AI photo packages that feel real", "Studio-quality AI photos from the selfies on your phone."],
  ["Upload selfies, build a private model, then buy photo packages with monthly credits.", "Upload your photos once, then create private headshots, creator portraits, fan posters, beauty previews, and themed albums. You see the credit cost before every generation."],
  ["Upload clear photos once, then create private headshots, creator portraits, fan posters, beauty previews, and themed albums. You see the credit cost before every generation.", "Upload your photos once, then create private headshots, creator portraits, fan posters, beauty previews, and themed albums. You see the credit cost before every generation."],
  ["Get Started", "Create my first photo set"],
  ["Get started", "Create my first photo set"],
  ["Start a photo set", "Create my first photo set"],
  ["Photo Packages", "Browse packages"],
  ["Private uploads and clear credit costs", "Private uploads · Credit cost shown upfront · Download your favorites"],
  ["Private uploads, visible credit costs, and gallery delivery", "Private uploads · Credit cost shown upfront · Download your favorites"],
  ["AI photo packages, personal models, Studio tools, credits, and private gallery delivery", "Private AI photo sets with visible credit costs and gallery delivery"],
  ["Create realistic AI photo packages from everyday uploads.", "Create private AI photo sets from everyday selfies."],
  ["Trusted funnel signals", "Private photo sets for work profiles, fan posts, creator pages, and personal albums"],
  ["proof bridge", "private result comparison"],
  ["Clean founder, LinkedIn, resume, and team-ready portraits.", "Create work-ready headshots for LinkedIn, resumes, founder bios, speaker pages, and team profiles. Credit cost is shown before generation."],
  ["Create work-ready headshots for LinkedIn, resumes, founder bios, speaker pages, and team profiles.", "Create work-ready headshots for LinkedIn, resumes, founder bios, speaker pages, and team profiles. Credit cost is shown before generation."],
  ["Stadium portraits, fan posters, match-day avatars, and private social albums.", "Create personal fan portraits, match-day posters, and profile avatars from your own selfies. For personal fan use only; do not use official marks or player likenesses without permission."],
  ["Stadium meet-ups, fan posters, and sports profile visuals.", "Create personal fan portraits, match-day posters, and profile avatars from your own selfies. For personal fan use only; do not use official marks or player likenesses without permission."],
  ["Stadium portraits, fan posters, and match-day profile scenes.", "Create personal fan portraits, match-day posters, and profile avatars from your own selfies. For personal fan use only; do not use official marks or player likenesses without permission."],
  ["Build stadium scenes, fan posters, and match-day profile images.", "Create personal fan portraits, match-day posters, and profile avatars from your own selfies. Personal fan use only."],
  ["Tasteful private portraits with soft lighting, confident styling, and album-only delivery.", "Create a private boudoir-inspired portrait set from photos you own and have permission to use. Adult, consensual use only."],
  ["Polished creator-ready portraits.", "Generate fresh profile portraits for newsletters, landing pages, thumbnails, media kits, and social profiles."],
  ["Generate creator-ready profile photos, channel visuals, and campaign portraits.", "Generate fresh profile portraits for newsletters, landing pages, thumbnails, media kits, and social profiles."],
  ["Cinematic cyberpunk scenes.", "Turn your selfie into a neon city portrait with night lights, futuristic styling, and high-contrast poster crops."],
  ["Neon city portraits and future-fashion scenes.", "Turn your selfie into a neon city portrait with night lights, futuristic styling, and high-contrast poster crops."],
  ["Turn source selfies into neon city portraits and dramatic future looks.", "Turn your selfie into a neon city portrait with night lights, futuristic styling, and high-contrast poster crops."],
  ["AI hairstyle transformation preview.", "Preview haircut, color, and styling ideas before you commit to a real salon change or a full image package."],
  ["Magic upscaler improves your photos.", "Sharpen a favorite generated image for cleaner downloads, profile use, and larger display sizes."],
  ["Preview higher-resolution delivery for finished photos and profile images.", "Sharpen a favorite generated image for cleaner downloads, profile use, and larger display sizes."],
  ["Some lightweight tools may support previews, but private model creation, premium photo packages, and final generation use paid credits because they consume dedicated generation capacity.", "Some lightweight tools can be free. Private model creation and premium photo packages require credits because they use dedicated generation capacity."],
  ["Do MyDreamShoots tools require payment?", "Can I try MyDreamShoots for free?"],
  ["Are my uploads private?", "Are my uploaded photos private?"],
  ["How do credits work?", "When are credits used?"],
  ["Monthly plans grant credits to the customer account. Creating a package reserves the needed credits first, successful results consume them, and failed requests can return them.", "Credit cost is shown before each generation. Different packages may use different credit amounts based on style, output size, and generation settings."],
  ["Use 8-12 clear phone photos per person.", "Upload clear photos you own or have permission to use."],
  ["Build private model", "Review the credit cost"],
  ["Keep identity consistent across packages and styles.", "Review the credit cost before generation."],
  ["Keep identity consistent across packages.", "Review the credit cost before generation."],
  ["40 photos", "Private gallery"],
  ["20 photos", "Work profiles"],
  ["about 20 minutes", "when your generation is ready"],
  ["12,000+ albums generated", "Private albums delivered"],
  ["5-star reviews", "Use cases"],
  ["4.9/5 from creators using private photo packs", "Ways people use MyDreamShoots"]
]);

const useCaseCards = new Map([
  ["Ava Mercer", ["Daily creator content", "Create daily content without spending hours on outfit changes, makeup, hairstyling, or studio setup.", "Creator workflow", "Photos and short videos"]],
  ["LinkedIn refresh", ["Daily creator content", "Create daily content without spending hours on outfit changes, makeup, hairstyling, or studio setup.", "Creator workflow", "Photos and short videos"]],
  ["Lucas Bennett", ["Wedding website visuals", "Build wedding-style albums and realistic short videos that can support a couple's wedding website or announcement page.", "Wedding stories", "Albums and video clips"]],
  ["Match-day fan posts", ["Wedding website visuals", "Build wedding-style albums and realistic short videos that can support a couple's wedding website or announcement page.", "Wedding stories", "Albums and video clips"]],
  ["Mia Collins", ["Family memory album", "Recreate meaningful family scenes from approved photos, including memorial albums and gentle hug videos for loved ones.", "Keepsake scenes", "Private family gallery"]],
  ["Creator profile update", ["Family memory album", "Recreate meaningful family scenes from approved photos, including memorial albums and gentle hug videos for loved ones.", "Keepsake scenes", "Private family gallery"]],
  ["Noah Reed", ["Prompt-led video scene", "Use up to 7 selected frame images, choose 6 or 10 seconds, review credits first, then save the result in your private gallery.", "Video previews", "6-10 second clips"]],
  ["Private style preview", ["Prompt-led video scene", "Use up to 7 selected frame images, choose 6 or 10 seconds, review credits first, then save the result in your private gallery.", "Video previews", "6-10 second clips"]]
]);

function rewriteString(value) {
  let next = value;
  for (const [from, to] of replacements) next = next.replaceAll(from, to);
  return next;
}

function rewriteJson(value) {
  if (typeof value === "string") return rewriteString(value);
  if (Array.isArray(value)) return value.map(rewriteJson);
  if (!value || typeof value !== "object") return value;

  if (typeof value.name === "string" && useCaseCards.has(value.name)) {
    const [name, quote, role, location] = useCaseCards.get(value.name);
    value.name = name;
    value.quote = quote;
    value.role = role;
    value.location = location;
    value.rating = "";
  }

  if (value.summaryRating) value.summaryRating = "";
  if (value.summaryMeta === "Realistic customer stories for AI photo package buyers" || value.summaryMeta === "Example use cases") {
    value.subtitle = "Real stories for social content, wedding pages, family keepsakes, and short AI videos.";
    value.summaryBody = "Turn everyday selfies and family photos into private albums, gallery-ready images, and 6-10 second video moments.";
    value.summaryMeta = "Narrative examples";
  }
  if (value.title === "What Our Customers Say" || value.title === "Realistic customer stories") value.title = "Ways people use MyDreamShoots";

  for (const key of Object.keys(value)) {
    if (key === "keywords") {
      delete value[key];
      continue;
    }
    value[key] = rewriteJson(value[key]);
  }
  return value;
}

function changed(before, after) {
  return JSON.stringify(before) !== JSON.stringify(after);
}

function removeStateCaches() {
  for (const dir of [".next", ".next-dev", ".next-3002", ".next-docx-verify"]) {
    const cacheFile = path.join(process.cwd(), dir, "cache/platform-state-postgres.json");
    if (fs.existsSync(cacheFile)) fs.rmSync(cacheFile, { force: true });
  }
}

function setPageSeo(page, title, description, keywords) {
  const update = structuredClone(page);
  update.seo ??= {};
  update.seo.title = title;
  update.seo.description = description;
  if (keywords) update.seo.keywords = keywords;
  else delete update.seo.keywords;
  return update;
}

async function main() {
  const site = await prisma.site.findFirst({
    where: {
      OR: [
        { id: "site_dreamshoot" },
        { slug: "mydreamshoots" },
        { primaryDomain: "www.mydreamshoots.com" }
      ]
    },
    select: { id: true }
  });
  if (!site) throw new Error("MyDreamShoots site not found");

  const result = { themeSettings: 0, themePages: 0, siteThemes: 0, themePublications: 0, creativePacks: 0 };

  const settings = await prisma.themeSettings.findUnique({ where: { siteId: site.id } });
  if (settings) {
    const draftJson = rewriteJson(structuredClone(settings.draftJson));
    const publishedJson = rewriteJson(structuredClone(settings.publishedJson));
    for (const seo of [draftJson.seo, publishedJson.seo]) {
      if (!seo) continue;
      seo.siteTitle = "MyDreamShoots";
      seo.titleTemplate = "%s | MyDreamShoots";
      seo.siteDescription = "Create sports fan photos, VIP-style portraits, Christmas group photos, Thanksgiving portraits, and Halloween party albums from your selfies with MyDreamShoots.";
      seo.siteKeywords = "Dream Shoots,Sports Fan Photos,VIP Style Portraits,Christmas Group Photos,Thanksgiving Photos,Halloween Party Photos,AI Photo Generator";
      for (const pageSeo of Object.values(seo.pages ?? {})) delete pageSeo.keywords;
      if (seo.pages?.site_dreamshoot_home) {
        seo.pages.site_dreamshoot_home.title = "Professional AI Photo Generator Online - MyDreamShoots";
        seo.pages.site_dreamshoot_home.description = "Create sports fan photos, VIP-style portraits, Christmas group photos, Thanksgiving portraits, and Halloween party albums from your selfies with MyDreamShoots.";
        seo.pages.site_dreamshoot_home.keywords = "Dream Shoots,Sports Fan Photos,VIP Style Portraits,Christmas Group Photos,Thanksgiving Photos,Halloween Party Photos,AI Photo Generator";
      }
    }
    if (changed(settings.draftJson, draftJson) || changed(settings.publishedJson, publishedJson)) {
      await prisma.themeSettings.update({ where: { siteId: site.id }, data: { draftJson, publishedJson } });
      result.themeSettings += 1;
    }
  }

  for (const page of await prisma.themePage.findMany({ where: { siteId: site.id } })) {
    let draftJson = rewriteJson(structuredClone(page.draftJson));
    let publishedJson = rewriteJson(structuredClone(page.publishedJson));
    if (page.slug === "/") {
      draftJson = setPageSeo(draftJson, "Professional AI Photo Generator Online - MyDreamShoots", "Create sports fan photos, VIP-style portraits, Christmas group photos, Thanksgiving portraits, and Halloween party albums from your selfies with MyDreamShoots.", "Dream Shoots,Sports Fan Photos,VIP Style Portraits,Christmas Group Photos,Thanksgiving Photos,Halloween Party Photos,AI Photo Generator");
      publishedJson = setPageSeo(publishedJson, "Professional AI Photo Generator Online - MyDreamShoots", "Create sports fan photos, VIP-style portraits, Christmas group photos, Thanksgiving portraits, and Halloween party albums from your selfies with MyDreamShoots.", "Dream Shoots,Sports Fan Photos,VIP Style Portraits,Christmas Group Photos,Thanksgiving Photos,Halloween Party Photos,AI Photo Generator");
    }
    if (page.slug === "/pricing") {
      draftJson = setPageSeo(draftJson, "MyDreamShoots Pricing | Credits for Private AI Photo Packages", "Compare MyDreamShoots plans and credit packs for private AI photo packages, source-photo uploads, generation requests, secure checkout, and private gallery delivery.");
      publishedJson = setPageSeo(publishedJson, "MyDreamShoots Pricing | Credits for Private AI Photo Packages", "Compare MyDreamShoots plans and credit packs for private AI photo packages, source-photo uploads, generation requests, secure checkout, and private gallery delivery.");
    }
    if (page.slug === "/tools") {
      draftJson = setPageSeo(draftJson, "AI Photo Tools with Free Previews | Background, Headshots & Try-ons | MyDreamShoots", "Explore MyDreamShoots tools for headshots, background edits, video clips, try-on previews, private uploads, visible credits, and private albums.");
      publishedJson = setPageSeo(publishedJson, "AI Photo Tools with Free Previews | Background, Headshots & Try-ons | MyDreamShoots", "Explore MyDreamShoots tools for headshots, background edits, video clips, try-on previews, private uploads, visible credits, and private albums.");
    }
    if (page.slug === "/collections") {
      draftJson = setPageSeo(draftJson, "Browse private AI photo packages | MyDreamShoots", "Browse MyDreamShoots packages for headshots, fan photos, creator portraits, beauty looks, AI shoot packages, and cinematic private albums with visible credit costs.");
      publishedJson = setPageSeo(publishedJson, "Browse private AI photo packages | MyDreamShoots", "Browse MyDreamShoots packages for headshots, fan photos, creator portraits, beauty looks, AI shoot packages, and cinematic private albums with visible credit costs.");
    }
    if (page.slug === "/tools/headshot" || page.slug === "/collections/headshots") {
      draftJson = setPageSeo(draftJson, "AI Headshot Generator for LinkedIn, Resumes & Team Photos | MyDreamShoots", "Create work-ready AI headshots for LinkedIn, resumes, founder bios, speaker pages, and team profiles with private uploads and visible credit costs.");
      publishedJson = setPageSeo(publishedJson, "AI Headshot Generator for LinkedIn, Resumes & Team Photos | MyDreamShoots", "Create work-ready AI headshots for LinkedIn, resumes, founder bios, speaker pages, and team profiles with private uploads and visible credit costs.");
    }
    if (changed(page.draftJson, draftJson) || changed(page.publishedJson, publishedJson)) {
      await prisma.themePage.update({ where: { id: page.id }, data: { draftJson, publishedJson } });
      result.themePages += 1;
    }
  }

  for (const theme of await prisma.siteTheme.findMany({ where: { siteId: site.id } })) {
    const templates = rewriteJson(structuredClone(theme.templates));
    const themeSettings = rewriteJson(structuredClone(theme.settings));
    if (changed(theme.templates, templates) || changed(theme.settings, themeSettings)) {
      await prisma.siteTheme.update({ where: { id: theme.id }, data: { templates, settings: themeSettings } });
      result.siteThemes += 1;
    }
  }

  for (const publication of await prisma.themePublication.findMany({ where: { siteId: site.id } })) {
    const snapshot = rewriteJson(structuredClone(publication.snapshot));
    if (changed(publication.snapshot, snapshot)) {
      await prisma.themePublication.update({ where: { id: publication.id }, data: { snapshot } });
      result.themePublications += 1;
    }
  }

  for (const pack of await prisma.creativePack.findMany({ where: { siteId: site.id } })) {
    const next = {
      ...pack,
      headline: rewriteString(pack.headline),
      description: rewriteString(pack.description),
      prompt: pack.prompt ? rewriteString(pack.prompt) : pack.prompt
    };
    if (pack.id === "pack_dreamshoot_headshots") next.description = "Create work-ready headshots for LinkedIn, resumes, founder bios, speaker pages, and team profiles. Credit cost is shown before generation.";
    if (pack.id === "pack_dreamshoot_worldcup") next.description = "Create personal fan portraits, match-day posters, and profile avatars from your own selfies. For personal fan use only; do not use official marks or player likenesses without permission.";
    if (pack.id === "pack_dreamshoot_boudoir") next.description = "Create a private boudoir-inspired portrait set from photos you own and have permission to use. Adult, consensual use only.";
    if (pack.id === "pack_dreamshoot_creator_portraits") next.description = "Generate fresh profile portraits for newsletters, landing pages, thumbnails, media kits, and social profiles.";
    if (pack.id === "pack_dreamshoot_cyberpunk") next.description = "Turn your selfie into a neon city portrait with night lights, futuristic styling, and high-contrast poster crops.";
    if (pack.id === "pack_dreamshoot_hairstyle") next.description = "Preview haircut, color, and styling ideas before you commit to a real salon change or a full image package.";
    if (pack.id === "pack_dreamshoot_upscaler") next.description = "Sharpen a favorite generated image for cleaner downloads, profile use, and larger display sizes.";
    if (next.headline !== pack.headline || next.description !== pack.description || next.prompt !== pack.prompt) {
      await prisma.creativePack.update({ where: { id: pack.id }, data: { headline: next.headline, description: next.description, prompt: next.prompt } });
      result.creativePacks += 1;
    }
  }

  removeStateCaches();
  console.log(JSON.stringify({ ok: true, siteId: site.id, ...result }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
