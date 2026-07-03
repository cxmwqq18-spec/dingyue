import fs from "node:fs";
import path from "node:path";

const statePath = path.resolve(process.cwd(), "data/platform-state.json");
const state = JSON.parse(fs.readFileSync(statePath, "utf8"));

const isMydreamshootsSite = (site) => {
  const token = `${site?.id ?? ""} ${site?.slug ?? ""} ${site?.name ?? ""} ${site?.primaryDomain ?? ""}`.toLowerCase();
  return token.includes("mydreamshoots") || (token.includes("dreamshoot") && !token.includes("aidreamcapes"));
};

const replacements = new Map([
  ["ʍʏƉʀɛǟʍֆhoots", "MyDreamShoots"],
  ["AI photo packages that feel like a real shoot", "Studio-quality AI photos from the selfies on your phone."],
  ["AI photo packages that feel real", "Studio-quality AI photos from the selfies on your phone."],
  ["Upload selfies, build a private model, then buy photo packages with monthly credits.", "Upload your photos once, then create private headshots, creator portraits, fan posters, beauty previews, and themed albums. You see the credit cost before every generation."],
  ["Upload clear photos once, then create private headshots, creator portraits, fan posters, beauty previews, and themed albums. You see the credit cost before every generation.", "Upload your photos once, then create private headshots, creator portraits, fan posters, beauty previews, and themed albums. You see the credit cost before every generation."],
  ["Get Started", "Create my first photo set"],
  ["Get started", "Create my first photo set"],
  ["Photo Packages", "Browse packages"],
  ["Start a photo set", "Create my first photo set"],
  ["Private uploads and clear credit costs", "Private uploads · Credit cost shown upfront · Download your favorites"],
  ["Private uploads, visible credit costs, and gallery delivery", "Private uploads · Credit cost shown upfront · Download your favorites"],
  ["Trusted funnel signals", "Private photo sets for work profiles, fan posts, creator pages, and personal albums"],
  ["funnel signals", "private photo sets"],
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
  ["40 photo album", "Private photo set"],
  ["about 20 minutes", "when your generation is ready"],
  ["12,000+ albums generated", "Private albums delivered"],
  ["5-star reviews", "Use cases"],
  ["4.9/5 from creators using private photo packs", "Ways people use MyDreamShoots"]
]);

const useCaseCards = new Map([
  ["Ava Mercer", ["LinkedIn refresh", "Create a private set of professional headshots for LinkedIn, resumes, founder bios, and company profiles.", "Work profiles", "Professional headshots"]],
  ["Lucas Bennett", ["Match-day fan posts", "Turn your selfies into tournament-style fan posters and profile avatars for personal social posts.", "Fan posts", "Sports portraits"]],
  ["Mia Collins", ["Creator profile update", "Generate fresh portraits for newsletters, landing pages, thumbnails, media kits, and social profiles.", "Creator pages", "Profile portraits"]],
  ["Noah Reed", ["Private style preview", "Try hairstyle, outfit, or themed portrait directions before downloading your favorites.", "Style previews", "Beauty and try-on"]]
]);

function rewriteString(value) {
  let next = value;
  for (const [from, to] of replacements) next = next.replaceAll(from, to);
  return next;
}

function walk(value) {
  if (typeof value === "string") return rewriteString(value);
  if (Array.isArray(value)) return value.map(walk);
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
  if (value.summaryMeta === "Realistic customer stories for AI photo package buyers") value.summaryMeta = "Example use cases";
  if (value.title === "What Our Customers Say" || value.title === "Realistic customer stories") value.title = "Ways people use MyDreamShoots";

  for (const key of Object.keys(value)) {
    if (key === "keywords") {
      delete value[key];
      continue;
    }
    value[key] = walk(value[key]);
  }
  return value;
}

function setSeo(page, title, description) {
  page.publishedJson ??= {};
  page.publishedJson.seo ??= {};
  page.publishedJson.seo.title = title;
  page.publishedJson.seo.description = description;
  delete page.publishedJson.seo.keywords;
}

let changedSites = 0;
for (const site of state.sites ?? []) {
  if (!isMydreamshootsSite(site)) continue;
  const before = JSON.stringify(site);
  walk(site);

  site.themeSettings ??= {};
  site.themeSettings.publishedJson ??= {};
  const themeSeo = site.themeSettings.publishedJson.seo;
  if (themeSeo) {
    themeSeo.siteTitle = "MyDreamShoots";
    themeSeo.siteDescription = "Create private AI headshots, portraits, fan posters, beauty previews, and themed photo albums from selfies with visible credit costs.";
    themeSeo.siteKeywords = "";
    for (const pageSeo of Object.values(themeSeo.pages ?? {})) delete pageSeo.keywords;
  }

  for (const page of site.pages ?? []) {
    delete page.publishedJson?.seo?.keywords;
    if (page.slug === "/") {
      setSeo(page, "AI Headshot & Portrait Generator | Private Photo Sets from Selfies | MyDreamShoots", "Create private AI headshots, creator portraits, fan posters, beauty previews, and themed photo albums from selfies with credit costs shown before generation.");
      const hero = page.publishedJson?.sections?.hero_1;
      if (hero?.blocks) {
        const primary = hero.blocks.find((block) => block.id === "hero_cta_primary");
        const secondary = hero.blocks.find((block) => block.id === "hero_cta_secondary");
        if (primary?.settings) primary.settings.label = "Create my first photo set";
        if (secondary?.settings) secondary.settings.label = "Browse packages";
      }
    }
    if (page.slug === "/pricing") {
      setSeo(page, "MyDreamShoots Pricing | Credits for Private AI Photo Packages", "Compare MyDreamShoots plans and credit packs for private AI photo packages, source-photo uploads, generation requests, secure checkout, and private gallery delivery.");
    }
    if (page.slug === "/tools") {
      setSeo(page, "AI Photo Tools with Free Previews | Background, Headshots & Try-ons | MyDreamShoots", "Explore MyDreamShoots tools for headshots, background edits, video clips, try-on previews, private uploads, visible credits, and private albums.");
    }
    if (page.slug === "/collections") {
      setSeo(page, "Browse private AI photo packages | MyDreamShoots", "Browse MyDreamShoots packages for headshots, fan photos, creator portraits, beauty looks, AI shoot packages, and cinematic private albums with visible credit costs.");
    }
    if (page.slug === "/tools/headshot" || page.slug === "/collections/headshots") {
      setSeo(page, "AI Headshot Generator for LinkedIn, Resumes & Team Photos | MyDreamShoots", "Create work-ready AI headshots for LinkedIn, resumes, founder bios, speaker pages, and team profiles with private uploads and visible credit costs.");
    }
  }

  if (JSON.stringify(site) !== before) changedSites += 1;
}

for (const theme of state.siteThemes ?? []) {
  if (theme.siteId !== "site_dreamshoot") continue;
  walk(theme);
}

for (const publication of state.themePublications ?? []) {
  if (publication.siteId !== "site_dreamshoot") continue;
  walk(publication);
}

for (const pack of state.creativePacks ?? []) {
  if (pack.siteId !== "site_dreamshoot") continue;
  walk(pack);
  if (pack.id === "pack_dreamshoot_headshots") {
    pack.description = "Create work-ready headshots for LinkedIn, resumes, founder bios, speaker pages, and team profiles. Credit cost is shown before generation.";
  }
  if (pack.id === "pack_dreamshoot_worldcup") {
    pack.description = "Create personal fan portraits, match-day posters, and profile avatars from your own selfies. For personal fan use only; do not use official marks or player likenesses without permission.";
  }
  if (pack.id === "pack_dreamshoot_boudoir") {
    pack.description = "Create a private boudoir-inspired portrait set from photos you own and have permission to use. Adult, consensual use only.";
  }
  if (pack.id === "pack_dreamshoot_creator_portraits") {
    pack.description = "Generate fresh profile portraits for newsletters, landing pages, thumbnails, media kits, and social profiles.";
  }
  if (pack.id === "pack_dreamshoot_cyberpunk") {
    pack.description = "Turn your selfie into a neon city portrait with night lights, futuristic styling, and high-contrast poster crops.";
  }
  if (pack.id === "pack_dreamshoot_hairstyle") {
    pack.description = "Preview haircut, color, and styling ideas before you commit to a real salon change or a full image package.";
  }
  if (pack.id === "pack_dreamshoot_upscaler") {
    pack.description = "Sharpen a favorite generated image for cleaner downloads, profile use, and larger display sizes.";
  }
}

fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
console.log(`Applied MyDreamShoots page change document updates to ${changedSites} site record(s).`);
