#!/usr/bin/env node
import fs from "node:fs";

const statePath = new URL("../data/platform-state.json", import.meta.url);
const state = JSON.parse(fs.readFileSync(statePath, "utf8"));

const SITE_ID = "site_dreamshoot";
const SITE_SLUG = "mydreamshoots";
const SITE_DOMAIN = "www.mydreamshoots.com";

const boundaryCopy = {
  headshot:
    "Create work-ready headshots for LinkedIn, resumes, founder bios, speaker pages, and team profiles. Not for IDs, impersonation, or unauthorized people.",
  worldCup:
    "Create fan meetup portraits, match-day posters, stadium group shots, and social-ready avatars from your own selfies. For personal fan use only; no official logos, player likenesses, celebrity likenesses, or official marks without permission.",
  tryOn:
    "Preview outfit, styling, and fashion directions as a visual preview before a full package. Not an exact fit guarantee.",
  fashion:
    "Create magazine-style outfit stories and polished personal-brand images. Virtual try-on and fashion looks are a visual preview, not an exact fit guarantee.",
  boudoir:
    "Create a private boudoir-inspired portrait set from photos you own and have permission to use. Adult, consensual, non-explicit use only; no minors, non-consenting people, or stolen images."
};

const trustCopy = {
  creditsTitle: "How credits work",
  creditsBody:
    "Credits are shown before generation starts, reserved when a request begins, used after successful delivery, and returned when a failed request releases the reservation.",
  privacyTitle: "Private by default",
  privacyBody:
    "Your uploads stay private inside your signed-in MyDreamShoots account with your jobs, albums, downloads, and credit history.",
  uploadPermission:
    "Only upload photos you own or have permission to use."
};

const contentCopy = {
  homeHeadline: "Upload selfies and create your own AI model - Professional headshots without a studio.",
  headshotToolEyebrow: "AI Headshot Generator",
  headshotToolTitle: "AI headshots for LinkedIn, resumes, and founder profiles.",
  headshotToolSubtitle:
    "Create a private set of professional headshots from clear selfies. Not for official IDs, impersonation, or representing someone without permission.",
  headshotEntryTitle: "Create professional headshots from selfies",
  headshotEntrySubtitle:
    "Upload clear portraits you own, confirm the credit cost, and receive private headshot options for LinkedIn, resumes, team pages, and founder bios.",
  footerBody:
    "MyDreamShoots helps you turn your own photos into private sports fan photos, VIP-style portraits, holiday group photos, and themed albums. Upload photos you own, review credits before generation, and keep finished results in your signed-in gallery.",
  footerSocialBody:
    "MyDreamShoots helps you turn your own photos into private fan photos, VIP-style portraits, holiday group photos, and themed albums."
};

function toolDetails({ input, output, bestFor, cost }) {
  return `Input: ${input} Output: ${output} Best for: ${bestFor} Cost: ${cost}`;
}

const defaultToolDetailCopy = {
  "mega_tool_headshot": toolDetails({
    input: "clear selfies or portraits you own or have permission to use.",
    output: "private profile-ready headshot options.",
    bestFor: "LinkedIn, resumes, founder bios, speaker pages, and team profiles.",
    cost: "credits are shown before generation."
  }),
  "mega_tool_creator": toolDetails({
    input: "source portraits and creator references you own or can use.",
    output: "private creator portraits for profiles, media kits, newsletters, and thumbnails.",
    bestFor: "refreshing a public creator presence.",
    cost: "credits are shown before generation."
  }),
  "mega_tool_worldcup": toolDetails({
    input: "your own selfies for personal fan use.",
    output: "private fan meetup photos, posters, group shots, and profile avatars.",
    bestFor: "match-day social posts without official marks, logos, player likenesses, or celebrity likenesses.",
    cost: "credits are shown before generation."
  }),
  "mega_tool_cyberpunk": toolDetails({
    input: "a clear portrait you own or have permission to use.",
    output: "private neon city portrait crops.",
    bestFor: "cinematic profile images and poster-style scenes.",
    cost: "credits are shown before generation."
  }),
  "mega_tool_gala": toolDetails({
    input: "clear portraits and style direction you own or can use.",
    output: "private formal evening portrait options.",
    bestFor: "event-inspired profile images and polished album looks.",
    cost: "credits are shown before generation."
  }),
  "mega_tool_noir": toolDetails({
    input: "your own portrait with character direction.",
    output: "private noir-style character portraits.",
    bestFor: "dramatic profile concepts and creative scenes.",
    cost: "credits are shown before generation."
  }),
  "mega_tool_anime": toolDetails({
    input: "your own portrait or avatar reference.",
    output: "private stylized avatar concepts.",
    bestFor: "profile updates, fan communities, and playful identity ideas.",
    cost: "credits are shown before generation."
  }),
  "mega_tool_nature": toolDetails({
    input: "your own portrait and outdoor mood direction.",
    output: "private nature and adventure portrait scenes.",
    bestFor: "outdoor creator profiles and lifestyle albums.",
    cost: "credits are shown before generation."
  }),
  "mega_tool_fashion": toolDetails({
    input: "your own photo and style references.",
    output: "private fashion editorial and visual try-on previews.",
    bestFor: "outfit direction, creator looks, and adult consensual non-explicit styling.",
    cost: "credits are shown before generation."
  }),
  "mega_tool_product": toolDetails({
    input: "product or creator reference images you own or can use.",
    output: "private product-style lifestyle image concepts.",
    bestFor: "campaign drafts, social commerce visuals, and creator product scenes.",
    cost: "credits are shown before generation."
  }),
  "mega_edit_background": toolDetails({
    input: "one portrait or product photo you own or can edit.",
    output: "a private image with a cleaner replacement background.",
    bestFor: "preparing source photos before a full package.",
    cost: "credits are shown before paid edits."
  }),
  "mega_edit_remove_bg": toolDetails({
    input: "one image you own or have permission to edit.",
    output: "a private cutout or cleaner source image.",
    bestFor: "profile, listing, and package-prep images.",
    cost: "credits are shown before paid edits."
  }),
  "mega_edit_magic_eraser": toolDetails({
    input: "one photo you own or have permission to edit.",
    output: "a private image with small distractions removed.",
    bestFor: "cleaning portraits, cards, and generated scenes without misleading claims.",
    cost: "credits are shown before paid edits."
  }),
  "mega_edit_enhancer": toolDetails({
    input: "a low-light or soft photo you own.",
    output: "a private enhanced source image.",
    bestFor: "improving uploads before premium generation.",
    cost: "credits are shown before paid edits."
  }),
  "mega_edit_retouch": toolDetails({
    input: "a portrait you own or have permission to retouch.",
    output: "a private cleaned portrait that preserves identity.",
    bestFor: "skin, flyaway, and lighting cleanup before delivery.",
    cost: "credits are shown before paid edits."
  }),
  "mega_edit_unblur": toolDetails({
    input: "a soft phone shot you own.",
    output: "a private sharper source image.",
    bestFor: "rescuing usable uploads before a package.",
    cost: "credits are shown before paid edits."
  }),
  "mega_edit_color": toolDetails({
    input: "a portrait, poster, or package preview you own.",
    output: "a private image with cleaner tone balance.",
    bestFor: "profile photos, posters, and package previews.",
    cost: "credits are shown before paid edits."
  }),
  "mega_edit_restore": toolDetails({
    input: "an old photo you own or have permission to restore.",
    output: "a private repaired image for album use.",
    bestFor: "family-photo cleanup and private gallery delivery.",
    cost: "credits are shown before paid edits."
  }),
  "mega_edit_prompt": toolDetails({
    input: "one image you own plus a focused edit prompt.",
    output: "a private edited preview.",
    bestFor: "testing a specific change before spending package credits.",
    cost: "credits are shown before paid edits."
  }),
  "mega_edit_upscale": toolDetails({
    input: "a generated or uploaded image you own.",
    output: "a private higher-resolution download.",
    bestFor: "profile images, larger displays, and final album favorites.",
    cost: "credits are shown before paid edits."
  }),
  "mega_video_image": toolDetails({
    input: "one finished image you own or generated.",
    output: "a private short motion concept.",
    bestFor: "social posts, profile intros, and campaign previews.",
    cost: "credits are shown before video generation."
  })
};

const extraToolDetailCopy = {
  "mega_video_profile": toolDetails({
    input: "headshots or creator portraits you own.",
    output: "a private profile motion clip.",
    bestFor: "social profiles and short intros.",
    cost: "credits are shown before video generation."
  }),
  "mega_video_fan": toolDetails({
    input: "fan poster images from your own selfies.",
    output: "a private match-day motion concept.",
    bestFor: "personal fan posts without official marks, logos, or player likenesses.",
    cost: "credits are shown before video generation."
  }),
  "mega_video_intro": toolDetails({
    input: "creator portraits you own or generated.",
    output: "a private intro clip for profiles and reels.",
    bestFor: "creator pages and media-kit motion.",
    cost: "credits are shown before video generation."
  }),
  "mega_video_product": toolDetails({
    input: "product-style package outputs you own.",
    output: "a private teaser motion concept.",
    bestFor: "campaign drafts and social commerce previews.",
    cost: "credits are shown before video generation."
  }),
  "mega_video_avatar": toolDetails({
    input: "avatar-style images you own or generated.",
    output: "a private animated avatar preview.",
    bestFor: "profile campaigns and playful identity updates.",
    cost: "credits are shown before video generation."
  }),
  "mega_video_fashion": toolDetails({
    input: "editorial or try-on preview images you own.",
    output: "a private fashion reel concept.",
    bestFor: "style direction and creator content previews, not fit guarantees.",
    cost: "credits are shown before video generation."
  }),
  "mega_video_album": toolDetails({
    input: "favorite generated images from your private album.",
    output: "a private compact album story video.",
    bestFor: "sharing a finished set as a short motion recap.",
    cost: "credits are shown before video generation."
  })
};

const toolDetailCopy = new Map(Object.entries({ ...defaultToolDetailCopy, ...extraToolDetailCopy }));

const textById = new Map([
  ["proof_headshots", boundaryCopy.headshot],
  ["catalog_headshot", boundaryCopy.headshot],
  ["taxonomy_headshot", boundaryCopy.headshot],
  ["mega_tool_headshot", boundaryCopy.headshot],
  ["proof_pair_headshot", boundaryCopy.headshot],
  ["proof_worldcup", "Stadium fan posters, match-day group shots, and social-ready supporter portraits."],
  ["catalog_worldcup", boundaryCopy.worldCup],
  ["taxonomy_worldcup", boundaryCopy.worldCup],
  ["mega_tool_worldcup", boundaryCopy.worldCup],
  ["mega_video_fan", "Animate World Cup fan posters and match-day profile scenes for personal fan use only; no official logos, player likenesses, celebrity likenesses, or official marks without permission."],
  ["tab_tryon", boundaryCopy.tryOn],
  ["mega_tool_virtual_tryon", boundaryCopy.tryOn],
  ["mega_tool_fashion", boundaryCopy.fashion],
  ["mega_video_fashion", "Create short reel concepts from editorial and try-on package outputs. Visual preview only, not an exact fit guarantee."],
  ["catalog_fashion", boundaryCopy.fashion],
  ["catalog_boudoir", boundaryCopy.boudoir],
  ["taxonomy_boudoir", boundaryCopy.boudoir],
  [
    "taxonomy_style",
    "Hairstyles, beauty portraits, virtual try-on, and boudoir-inspired previews. Boudoir is adult, consensual, non-explicit only; no minors, non-consenting people, or stolen images."
  ],
  ["mega_tool_boudoir", boundaryCopy.boudoir]
]);

const textByPackId = new Map([
  ["pack_dreamshoot_headshots", boundaryCopy.headshot],
  ["pack_dreamshoot_worldcup", boundaryCopy.worldCup],
  ["pack_dreamshoot_virtual_tryon", boundaryCopy.tryOn],
  ["pack_dreamshoot_fashion_editorial", boundaryCopy.fashion],
  ["pack_dreamshoot_boudoir", boundaryCopy.boudoir]
]);

const sectionSettingsById = new Map([
  [
    "hero_1",
    {
      headline: contentCopy.homeHeadline,
      subheadline:
        "Upload clear photos once, then create private sports fan photos, sports-idol style meetups, red-carpet fan moments, Christmas group portraits, Thanksgiving albums, Halloween party photos, and seasonal cards. How credits work: you see the credit cost before every generation. Private by default: your uploads stay private in your signed-in account.",
      bulletList:
        "Upload clear photos you own or have permission to use.|Choose fan meetups, sports-idol style scenes, VIP looks, and holiday group albums.|Review the credit cost before generation starts.|Download finished results from your private gallery."
    }
  ],
  [
    "brand_strip_1",
    {
      title:
        "Private photo sets for fan meetups, sports-idol style moments, VIP looks, Christmas cards, Thanksgiving portraits, and Halloween albums."
    }
  ],
  [
    "visual_proof_1",
    {
      subtitle:
        "See examples of fan meetups, sports-idol style photos, VIP looks, Christmas group portraits, Thanksgiving albums, Halloween party shots, and seasonal cards.",
      tabs: "All|Fan Photos|Sports Stars|VIP Looks|Christmas|Thanksgiving|Halloween|Seasonal",
      badges: "Private model|Fan-safe styling|Holiday albums"
    }
  ],
  [
    "tool_banner_1",
    {
      eyebrow: contentCopy.headshotToolEyebrow,
      title: contentCopy.headshotToolTitle,
      subtitle: contentCopy.headshotToolSubtitle
    }
  ],
  [
    "entry_1",
    {
      title: contentCopy.headshotEntryTitle,
      subtitle: contentCopy.headshotEntrySubtitle,
      ctaLabel: "Start this headshot set"
    }
  ],
  [
    "featured_pack_1",
    {
      title: "World Cup fan photos for sports-idol style moments.",
      subtitle:
        "Turn everyday selfies into fan meetups, stadium-style group photos, match-day posters, and private albums built for social sharing.",
      includedOutputs:
        "Fan meetup photos|Group-friendly shots for match day|Stadium portraits|Cinematic scenes with floodlights|Match-day avatars|Profile-ready square crops|Social banners|Wide cover images for sharing",
      safetyCopy:
        "Fan-safe styling: no real player or celebrity likenesses, official team logos, event marks, or protected brand assets without permission.",
      overlaySubtitle: "Sports-idol style fan photos without a studio.",
      overlayChips: "fan meetup|group shot|stadium|social-ready",
      bottomNote:
        "Seasonal packs rotate around tournaments, Christmas, Thanksgiving, Halloween, and personal fan-photo moments.",
      nextCampaignLabel: "Next: Christmas / Thanksgiving / Halloween"
    }
  ],
  [
    "package_catalog_1",
    {
      subtitle:
        "Each package shows the finished look, photo count, credit cost, and boundaries before you start. Choose fan photos, VIP-style looks, Christmas cards, Thanksgiving portraits, Halloween party albums, or seasonal group photos from images you own or have permission to use.",
      tabs: "All|Fan Photos|Sports Stars|VIP Looks|Christmas|Thanksgiving|Halloween|Seasonal|Creator|Video|Utility"
    }
  ],
  [
    "taxonomy_1",
    {
      subtitle:
        "Compare AI headshots, hairstyle previews, World Cup fan photos, fashion previews, boudoir-inspired sets, and video add-ons before you spend credits."
    }
  ],
  [
    "free_tools_1",
    {
      subtitle:
        "Use paid tools for background changes, image enhancement, portrait cleanup, upscaling, video previews, and visual try-on previews. Each card explains input, output, best use, and cost before you move into private photo packages."
    }
  ],
  [
    "pricing_intro_1",
    {
      title: "How credits work for private AI photo packages.",
      body:
        "Choose a plan based on how often you need AI headshots, creator portraits, fan photos, image cleanup, video previews, and private gallery delivery. Credits are shown before generation starts, reserved when a request begins, used after successful delivery, and returned when a failed request releases the reservation."
    }
  ],
  [
    "plan_rules_1",
    {
      title: "How credits work",
      body: `${trustCopy.creditsBody} ${trustCopy.privacyBody}`
    }
  ],
  [
    "packages_1",
    {
      subtitle:
        "Compare credit costs, source-photo requirements, private model needs, and delivery expectations before starting a headshot, sports, beauty, creator, lifestyle, or cinematic portrait pack. Only upload photos you own or have permission to use."
    }
  ],
  [
    "taxonomy_1",
    {
      subtitle:
        "Compare AI headshots, hairstyle previews, World Cup fan photos, fashion previews, boudoir-inspired sets, and video add-ons before you spend credits. Your uploads stay private by default."
    }
  ],
  [
    "trust_1",
    {
      title: "Private by default, with clear credits before generation."
    }
  ],
  [
    "footer",
    {
      body: contentCopy.footerBody,
      socialBody: contentCopy.footerSocialBody
    }
  ]
]);

const blockSettingsById = new Map([
  [
    "entry_1",
    {
      title: contentCopy.headshotEntryTitle,
      subtitle: contentCopy.headshotEntrySubtitle,
      ctaLabel: "Start this headshot set"
    }
  ],
  [
    "flow_upload",
    {
      title: "Private by default",
      text: `${trustCopy.privacyBody} ${trustCopy.uploadPermission}`
    }
  ],
  [
    "flow_credits",
    {
      title: "How credits work",
      text: trustCopy.creditsBody
    }
  ],
  [
    "trust_private",
    {
      value: "Private by default",
      label: "Your uploads stay private inside the signed-in customer account"
    }
  ],
  [
    "trust_credits",
    {
      value: "How credits work",
      label: "credit costs are shown, reserved, used, or returned with visible history"
    }
  ],
  [
    "plan_rule_credits",
    {
      meta: "How credits work",
      title: "Check credits before generation",
      description: trustCopy.creditsBody
    }
  ],
  [
    "plan_rule_gallery",
    {
      meta: "Private by default",
      title: "Your uploads stay private",
      description: trustCopy.privacyBody
    }
  ],
  [
    "pkg_path_upload",
    {
      title: "Private by default",
      text: `${trustCopy.privacyBody} ${trustCopy.uploadPermission}`
    }
  ],
  [
    "pkg_path_pay",
    {
      title: "How credits work",
      text: trustCopy.creditsBody
    }
  ]
]);

function isDreamshootSite(value) {
  return value?.id === SITE_ID || value?.slug === SITE_SLUG || value?.primaryDomain === SITE_DOMAIN;
}

function isDreamshootScoped(value) {
  return value?.siteId === SITE_ID || value?.targetId === SITE_ID || isDreamshootSite(value);
}

function setField(target, key, value, changes, label) {
  if (!target || target[key] === value) return;
  target[key] = value;
  changes.push(label);
}

function normalizeSection(section, changes, context, sectionId = "") {
  if (!section || typeof section !== "object") return;

  const settings = section.settings && typeof section.settings === "object" ? section.settings : null;
  const settingPatch = sectionSettingsById.get(sectionId) ?? sectionSettingsById.get(context.at(-1));
  if (settings && settingPatch) {
    for (const [key, value] of Object.entries(settingPatch)) {
      setField(settings, key, value, changes, `${context.join(".")}.settings.${key}`);
    }
  }

  const blocks = Array.isArray(section.blocks) ? section.blocks : [];
  for (const block of blocks) normalizeBlock(block, changes, context.concat(block.id ?? "block"));
}

function normalizeBlock(block, changes, context) {
  if (!block || typeof block !== "object") return;
  const copy = textById.get(block.id);
  block.settings ??= {};
  if (copy && !toolDetailCopy.has(block.id)) {
    setField(block.settings, "description", copy, changes, `${context.join(".")}.settings.description`);
  }

  const blockPatch = blockSettingsById.get(block.id);
  if (blockPatch) {
    for (const [key, value] of Object.entries(blockPatch)) {
      setField(block.settings, key, value, changes, `${context.join(".")}.settings.${key}`);
    }
  }

  const details = toolDetailCopy.get(block.id);
  if (details) {
    setField(block.settings, "description", details, changes, `${context.join(".")}.settings.description`);
  }
}

function normalizeTheme(theme, changes) {
  for (const [templateName, template] of Object.entries(theme.templates ?? {})) {
    for (const [sectionId, section] of Object.entries(template.sections ?? {})) {
      normalizeSection(section, changes, ["siteThemes", theme.id, "templates", templateName, "sections", sectionId], sectionId);
    }
  }

  const globalSections = theme.settings?.settings_data?.current?.sections;
  for (const [sectionId, section] of Object.entries(globalSections ?? {})) {
    normalizeSection(section, changes, ["siteThemes", theme.id, "settings", "settings_data", "current", "sections", sectionId], sectionId);
  }
}

function normalizeSite(site, changes) {
  const publishedSections = site.themeSettings?.publishedJson?.sections;
  for (const [sectionId, section] of Object.entries(publishedSections ?? {})) {
    normalizeSection(section, changes, ["sites", site.id, "themeSettings", "publishedJson", "sections", sectionId], sectionId);
  }

  const globalSections = site.themeSettings?.publishedJson?.globalSections;
  for (const [sectionId, section] of Object.entries(globalSections ?? {})) {
    normalizeSection(section, changes, ["sites", site.id, "themeSettings", "publishedJson", "globalSections", sectionId], sectionId);
  }

  for (const page of site.pages ?? []) {
    for (const snapshotName of ["draftJson", "publishedJson"]) {
      const sections = page[snapshotName]?.sections;
      for (const [sectionId, section] of Object.entries(sections ?? {})) {
        normalizeSection(section, changes, ["sites", site.id, "pages", page.id, snapshotName, "sections", sectionId], sectionId);
      }
    }
  }
}

function normalizePack(pack, changes) {
  const copy = textByPackId.get(pack.id);
  if (!copy) return;
  setField(pack, "description", copy, changes, `creativePacks.${pack.id}.description`);
}

function normalizePublication(publication, changes) {
  const snapshotPages = publication.snapshot?.pages;
  for (const page of snapshotPages ?? []) {
    for (const snapshotName of ["draftJson", "publishedJson"]) {
      const sections = page[snapshotName]?.sections;
      for (const [sectionId, section] of Object.entries(sections ?? {})) {
        normalizeSection(section, changes, ["themePublications", publication.id, "snapshot", "pages", page.id, snapshotName, "sections", sectionId], sectionId);
      }
    }
  }

  const saasTemplates = publication.snapshot?.saasTheme?.templates;
  for (const [templateName, template] of Object.entries(saasTemplates ?? {})) {
    for (const [sectionId, section] of Object.entries(template.sections ?? {})) {
      normalizeSection(section, changes, ["themePublications", publication.id, "snapshot", "saasTheme", "templates", templateName, "sections", sectionId], sectionId);
    }
  }
}

const changes = [];

for (const site of state.sites ?? []) {
  if (isDreamshootSite(site)) normalizeSite(site, changes);
}

for (const theme of state.siteThemes ?? []) {
  if (theme.siteId === SITE_ID) normalizeTheme(theme, changes);
}

for (const publication of state.themePublications ?? []) {
  if (publication.siteId === SITE_ID || publication.targetId === SITE_ID) {
    normalizeTheme(publication, changes);
    normalizePublication(publication, changes);
  }
}

for (const pack of state.creativePacks ?? []) {
  if (pack.siteId === SITE_ID) normalizePack(pack, changes);
}

for (const collectionName of ["siteThemes", "themePublications", "creativePacks"]) {
  for (const record of state[collectionName] ?? []) {
    if (!isDreamshootScoped(record)) continue;
    if (collectionName === "creativePacks") normalizePack(record, changes);
  }
}

fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);

console.log(`Synced MyDreamShoots compliance boundaries: ${changes.length} field(s) updated.`);
if (changes.length) {
  console.log(changes.map((change) => `- ${change}`).join("\n"));
}
