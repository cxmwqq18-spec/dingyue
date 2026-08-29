#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { assertAllowedSite, assertDatabaseTarget } from "./lib/database-target.mjs";

const SITE_ID = assertAllowedSite(process.env.SAVE_THE_DATE_SITE_ID || "site_dreamshoot");
const APPLY = process.argv.includes("--apply");
assertDatabaseTarget({ expectedTarget: "local" });

const clone = (value) => JSON.parse(JSON.stringify(value));
const stable = (value) => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
};
const contentHash = (value) => crypto.createHash("sha256").update(stable(value)).digest("hex");
const filename = (asset) => asset?.filename || String(asset?.src || "").split("/").pop();
const imageSettings = (asset) => ({
  imageUrl: asset.src,
  imageAlt: asset.alt,
  imageWidth: asset.width,
  imageHeight: asset.height,
  imageLoading: asset.loading || "lazy",
  imageFetchPriority: asset.fetchPriority || "auto"
});

function manifestMap(json) {
  return new Map((json.mediaManifest || []).map((asset) => [filename(asset), asset]));
}

function assignBlockImages(json, sectionId, filenames) {
  const section = json.sections?.[sectionId];
  assert(section, `${sectionId}: missing section`);
  assert.equal(section.blocks?.length, filenames.length, `${sectionId}: block count changed`);
  const assets = manifestMap(json);
  section.blocks.forEach((block, index) => {
    const asset = assets.get(filenames[index]);
    assert(asset, `${sectionId}: missing manifest asset ${filenames[index]}`);
    block.settings = { ...block.settings, ...imageSettings(asset) };
  });
}

function removeSection(json, sectionId, contractId) {
  const orderIndex = json.sectionsOrder?.indexOf(sectionId) ?? -1;
  if (orderIndex >= 0) json.sectionsOrder.splice(orderIndex, 1);
  if (json.sections?.[sectionId]) delete json.sections[sectionId];
  const contractIndex = json.contentContract?.requiredSections?.indexOf(contractId) ?? -1;
  if (contractIndex >= 0) {
    json.contentContract.requiredSections.splice(contractIndex, 1);
    json.contentContract.sectionTypes.splice(contractIndex, 1);
  }
}

function replaceStrings(value, replacements) {
  if (typeof value === "string") return replacements.get(value) || value;
  if (Array.isArray(value)) return value.map((item) => replaceStrings(item, replacements));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceStrings(item, replacements)]));
}

function syncManifestImageMetadata(value, assetsBySrc) {
  if (Array.isArray(value)) {
    value.forEach((item) => syncManifestImageMetadata(item, assetsBySrc));
    return;
  }
  if (!value || typeof value !== "object") return;
  const asset = typeof value.imageUrl === "string" ? assetsBySrc.get(value.imageUrl) : undefined;
  if (asset) Object.assign(value, imageSettings(asset));
  Object.values(value).forEach((item) => syncManifestImageMetadata(item, assetsBySrc));
}

const engagementAssets = [
  ["/assets/dreamshoot/generated/pack-galleries/engagement/engagement-01.webp", "Lakeside proposal at sunset with one partner presenting an engagement ring", 1024, 1024],
  ["/assets/dreamshoot/generated/pack-galleries/engagement/engagement-02.webp", "Newly engaged couple smiling together while the engagement ring is visible", 1024, 1024],
  ["/assets/dreamshoot/generated/20260622-homepage-unique/proof-couple-engagement.webp", "Engaged couple posing together on a city rooftop at sunset", 1024, 1536],
  ["/assets/dreamshoot/frames/sample-engagement.webp", "Garden proposal with one partner presenting a ring to the other", 1024, 1536],
  ["/assets/dreamshoot/generated/pack-galleries/engagement/engagement-04.webp", "Engaged couple holding flowers and showing the ring after the proposal", 1024, 1024],
  ["/assets/dreamshoot/generated/pack-galleries/engagement/engagement-05.webp", "Surprise lakeside proposal framed by mountains at golden hour", 1024, 1024],
  ["/assets/dreamshoot/generated/pack-galleries/engagement/engagement-06.webp", "Close-up of an engagement ring on joined hands outdoors", 1024, 1024],
  ["/assets/dreamshoot/generated/pack-galleries/engagement/engagement-07.webp", "Engaged couple sharing the ring announcement beneath city lights", 1024, 1024],
  ["/assets/dreamshoot/generated/pack-galleries/engagement/engagement-08.webp", "Engaged couple holding sparklers together on a beach at sunset", 1024, 1024],
  ["/assets/dreamshoot/generated/pack-galleries/engagement/engagement-10.webp", "Close-up of an engagement ring held in warm candlelight", 1024, 1024],
  ["/assets/dreamshoot/generated/pack-galleries/engagement/engagement-12.webp", "Engaged couple posing together in a sunlit field with the ring visible", 1024, 1024]
].map(([src, alt, width, height], index) => ({
  src,
  alt,
  width,
  height,
  role: index < 3 ? "hero" : "content",
  filename: src.split("/").pop(),
  loading: index < 3 ? "eager" : "lazy",
  fetchPriority: index === 0 ? "high" : "auto",
  caption: alt
}));

function repairPage(slug, source) {
  let json = clone(source);
  if (slug === "/ai-save-the-date/christmas") {
    assignBlockImages(json, "christmas_photo_ideas", [
      "hero-ai-christmas-family-gift.jpg", "hero-ai-christmas-snowy-cabin.jpg", "hero-ai-christmas-santa-lantern.jpg",
      "ai-christmas-cozy-cocoa-portrait.jpg", "ai-christmas-dog-santa-hat.jpg", "ai-christmas-gift-wrapping.jpg"
    ]);
    assignBlockImages(json, "christmas_scene_ideas", [
      "hero-ai-christmas-family-gift.jpg", "hero-ai-christmas-snowy-cabin.jpg", "hero-ai-christmas-santa-lantern.jpg",
      "ai-christmas-cozy-cocoa-portrait.jpg", "ai-christmas-dog-santa-hat.jpg", "ai-christmas-photo-capture.jpg",
      "ai-christmas-gift-wrapping.jpg", "ai-christmas-couple-market-lights.jpg", "ai-christmas-kids-baking-cookies.jpg",
      "ai-christmas-living-room-fireplace.jpg", "ai-christmas-friends-selfie.jpg"
    ]);
    assignBlockImages(json, "christmas_video_ideas", [
      "hero-ai-christmas-family-gift.jpg", "ai-christmas-photo-capture.jpg",
      "ai-christmas-gift-wrapping.jpg", "ai-christmas-couple-market-lights.jpg"
    ]);
  }
  if (slug === "/ai-save-the-date/thanksgiving") {
    assignBlockImages(json, "thanksgiving_use_cases", [
      "hero-ai-thanksgiving-family-dinner.jpg", "ai-thanksgiving-friendsgiving-toast.jpg", "ai-thanksgiving-turkey-feast.jpg",
      "hero-ai-thanksgiving-greeting-card.jpg", "ai-thanksgiving-home-decor.jpg", "ai-thanksgiving-table-photo.jpg"
    ]);
    assignBlockImages(json, "thanksgiving_scene_ideas", [
      "hero-ai-thanksgiving-family-dinner.jpg", "hero-ai-thanksgiving-kids-pumpkins.jpg", "hero-ai-thanksgiving-greeting-card.jpg",
      "ai-thanksgiving-turkey-feast.jpg", "ai-thanksgiving-family-cooking.jpg", "ai-thanksgiving-harvest-decor.jpg",
      "ai-thanksgiving-table-photo.jpg", "ai-thanksgiving-friendsgiving-toast.jpg", "ai-thanksgiving-home-decor.jpg",
      "ai-thanksgiving-dog-porch.jpg", "ai-thanksgiving-family-autumn-walk.jpg"
    ]);
    json.sections.thanksgiving_use_cases.settings.intro = "Choose the Thanksgiving moment that best matches the people, food, setting, and message you want to share.";
    json.sections.thanksgiving_scene_ideas.settings.intro = "Use each scene as a distinct visual direction, then review people, hands, food, and seasonal details before sharing.";
  }
  if (slug === "/ai-save-the-date/wedding-ceremony") {
    assignBlockImages(json, "wedding_ceremony_reasons", [
      "hero-ai-wedding-ceremony-first-kiss.jpg", "hero-ai-wedding-ceremony-vows.jpg",
      "wedding-ceremony-bride-aisle.jpg", "wedding-ceremony-beach-processional.jpg",
      "wedding-ceremony-guests-reaction.jpg", "wedding-ceremony-venue-setup.jpg"
    ]);
    assignBlockImages(json, "wedding_ceremony_workflow", [
      "wedding-ceremony-bride-aisle.jpg", "hero-ai-wedding-ceremony-vows.jpg",
      "wedding-ceremony-ring-exchange.jpg", "wedding-ceremony-venue-setup.jpg"
    ]);
    assignBlockImages(json, "wedding_ceremony_scene_ideas", [
      "hero-ai-wedding-ceremony-first-kiss.jpg", "hero-ai-wedding-ceremony-recessional.jpg", "hero-ai-wedding-ceremony-vows.jpg",
      "wedding-ceremony-ring-exchange.jpg", "wedding-ceremony-church-atmosphere.jpg", "wedding-ceremony-bride-aisle.jpg",
      "wedding-ceremony-guests-reaction.jpg", "wedding-ceremony-bouquet-detail.jpg", "wedding-ceremony-venue-setup.jpg",
      "wedding-ceremony-officiant-wide.jpg", "wedding-ceremony-beach-processional.jpg"
    ]);
    json.sections.wedding_ceremony_definition.blocks[0].settings.text = "A ceremony story focuses on the event sequence from the processional through vows, rings, reactions, the first kiss, and the recessional. Proposal, engagement, invitation, and reception stories cover different moments.";
    removeSection(json, "wedding_ceremony_evidence", "evidence");
  }
  if (slug === "/ai-save-the-date/valentines-day") {
    assignBlockImages(json, "save_date_story_styles", [
      "hero-valentines-day-save-the-date-couple-candlelight.jpg", "hero-valentines-day-save-the-date-city-couple.jpg", "hero-valentines-day-save-the-date-proposal.jpg"
    ]);
    assignBlockImages(json, "save_date_ideas", [
      "valentines-day-save-the-date-rose-garden-couple.jpg", "valentines-day-save-the-date-beach-couple.jpg",
      "valentines-day-save-the-date-candlelight-dinner.jpg", "valentines-day-save-the-date-heart-bokeh-couple.jpg",
      "hero-valentines-day-save-the-date-proposal.jpg"
    ]);
    json.sections.save_date_final_cta.settings = {
      ...json.sections.save_date_final_cta.settings,
      ...imageSettings(manifestMap(json).get("valentines-day-save-the-date-invitation-envelope.jpg"))
    };
  }
  if (slug === "/ai-save-the-date/proposal") {
    assignBlockImages(json, "proposal_use_cases", [
      "hero-ai-proposal-rooftop-surprise-night.jpg", "ai-proposal-ring-closeup.jpg", "ai-proposal-city-rooftop-candlelight.jpg",
      "hero-ai-proposal-beach-sunset.jpg", "ai-proposal-memory-photos-planning.jpg", "ai-proposal-after-yes-embrace.jpg",
      "ai-proposal-video-recording.jpg"
    ]);
    json.sections.proposal_final_cta.settings = {
      ...json.sections.proposal_final_cta.settings,
      ...imageSettings(manifestMap(json).get("ai-proposal-garden-walk-after-yes.jpg"))
    };
    json.sections.proposal_faq.blocks[6].settings.answer = "A proposal story centers on the question and immediate reaction. An engagement announcement focuses on sharing the news afterward.";
    json.sections.proposal_faq.blocks[7].settings.answer = "Use media and personal details you have permission to use, and review the current privacy policy before uploading.";
  }
  if (slug === "/holidays-events/wedding-invitation") {
    assignBlockImages(json, "wedding_invitation_styles_use_cases", [
      "ai-wedding-invitation-card-closeup.jpg", "hero-ai-wedding-invitation-garden-couple.jpg",
      "ai-wedding-invitation-design-selection.jpg", "ai-wedding-invitation-venue-display.jpg",
      "ai-wedding-invitation-digital-share.jpg", "ai-wedding-invitation-envelope-prep.jpg"
    ]);
    json.sections.wedding_invitation_what_is.settings = {
      ...json.sections.wedding_invitation_what_is.settings,
      ...imageSettings(manifestMap(json).get("ai-wedding-invitation-reception-table.jpg"))
    };
    json.sections.wedding_invitation_accuracy.settings = {
      ...json.sections.wedding_invitation_accuracy.settings,
      ...imageSettings(manifestMap(json).get("ai-wedding-invitation-bridesmaid-review.jpg"))
    };
  }
  if (slug === "/ai-save-the-date/save-the-date") {
    assignBlockImages(json, "save_date_use_cases", [
      "save-the-date-planning-together.jpg", "hero-ai-save-the-date-video-announcement.jpg",
      "save-the-date-destination-beach-portrait.jpg", "hero-ai-save-the-date-garden-portrait.jpg",
      "hero-ai-save-the-date-couple-sunset.jpg", "save-the-date-couple-city-walk.jpg"
    ]);
    json.sections.save_date_boundaries.settings.title = "Keep the Save the Date Focused on the Date Announcement";
    json.seo.keywords = "ai save the date video maker; save the date video; AI save the date announcement video; wedding save the date video maker; save the date video from photos; personalized save the date video; digital save the date announcement";
    json.mediaManifest[7].caption = "Use a short ring detail as supporting context and review fingers, jewelry geometry, reflections, and continuity before sharing.";
    json.mediaManifest[8].caption = "A proposal memory can appear briefly when it helps explain the couple's story before the date announcement.";
    removeSection(json, "save_date_evidence", "evidence");
  }
  if (slug === "/ai-save-the-date/engagement") {
    const previousManifest = json.mediaManifest || [];
    const replacements = new Map(previousManifest.map((asset, index) => [asset.src, engagementAssets[index].src]));
    json = replaceStrings(json, replacements);
    json.mediaManifest = engagementAssets;
    json.seo.ogImage = engagementAssets[0].src;
    json.seo.keywords = "ai engagement photo maker; ai engagement video maker; engagement announcement video; engagement photo to video; save the date engagement video; engagement ring announcement";
    json.sections.engagement_hero.settings = { ...json.sections.engagement_hero.settings, ...imageSettings(engagementAssets[0]) };
    json.sections.engagement_hero.blocks.forEach((block, index) => { block.settings = { ...block.settings, ...imageSettings(engagementAssets[index]) }; });
    assignBlockImages(json, "engagement_workflow_creates", [
      "engagement-04.webp", "engagement-05.webp", "engagement-06.webp", "engagement-07.webp",
      "engagement-08.webp", "engagement-10.webp", "engagement-12.webp"
    ]);
    json.sections.engagement_workflow.settings = {
      ...json.sections.engagement_workflow.settings,
      ...imageSettings(engagementAssets[1])
    };
    json.sections.engagement_boundaries.settings.title = "How Engagement Announcements Differ From Other Wedding Moments";
    json.sections.engagement_publishing.blocks[7].settings.text = "Confirm that names, dates, locations, and visible details are accurate before sharing.";
    removeSection(json, "engagement_evidence", "evidence");
  }
  if (slug === "/ai-save-the-date/halloween") {
    json.sections.halloween_faq.blocks[1].settings.answer = "Yes. Start with clear photos you have permission to use, choose a Halloween direction, and review the generated result before sharing it.";
    json.sections.halloween_faq.blocks[4].settings.answer = "Yes. You can plan still images and short video concepts from the same approved source set when both formats fit your project.";
    json.sections.halloween_faq.blocks[3].settings.answer = "Use a mix of playful, cute, cinematic, and spooky directions so the collection feels varied without relying on gore.";
    json.sections.halloween_quality.settings.intro = "The strongest Halloween visuals show a recognizable transformation at a glance instead of relying on generic pumpkins alone.";
    json.sections.halloween_quality.blocks[4].settings.text = "enough visual contrast to stay clear in small social crops or wide banner layouts";
  }
  if (slug === "/ai-save-the-date/new-year") {
    json.sections.new_year_faq.blocks[1].settings.answer = "Yes. You can plan both still images and short video concepts from the same approved New Year source set.";
  }
  if (slug === "/ai-save-the-date/mothers-day") {
    json.sections.mothers_day_faq.blocks[4].settings.answer = "Yes. Flowers, gifts, brunch scenes, self-care moments, and appreciation-focused imagery all work well for Mother's Day.";
    json.sections.mothers_day_family_match.settings.intro = "Mother's Day works naturally with family photos, including scenes with children, multi-generational gatherings, meaningful gifts, breakfast tables, and relaxed spring settings.";
    json.mediaManifest[7].caption = "Use a family-toast scene to include a multi-generational celebration or family gathering.";
  }
  if (slug === "/ai-save-the-date/fathers-day") {
    const galleryId = "fathers_day_gallery";
    if (!json.sectionsOrder.includes(galleryId)) json.sectionsOrder.splice(6, 0, galleryId);
    json.sections.fathers_day_faq.blocks[1].settings.question = "Can I create both Father's Day photos and short videos?";
    json.mediaManifest[7].caption = "Use a clean gift still life for Father's Day cards, gifts, and visual inspiration.";
  }
  if (slug === "/ai-save-the-date/wedding-anniversary") {
    json.seo = {
      ...json.seo,
      title: "AI Wedding Anniversary Photos and Video Ideas | myDreamshoots",
      description: "Create private AI wedding anniversary photos and video concepts from approved couple images for milestone messages, albums, and celebration keepsakes.",
      keywords: "AI wedding anniversary photos, wedding anniversary video ideas, anniversary couple images, milestone celebration keepsakes",
      canonicalPath: slug,
      canonical: `https://www.mydreamshoots.com${slug}`,
      index: false,
      follow: true,
      robots: { ...json.seo?.robots, index: false, follow: true, maxImagePreview: "large" }
    };
    json.mediaManifest = [];
  }
  if (slug === "/ai-save-the-date/save-the-date") {
    json.sections.save_date_boundaries.blocks[2].settings.text = "Formal wording, event logistics, and RSVP collection.";
  }
  if (slug === "/ai-save-the-date/wedding-ceremony") {
    json.sections.wedding_ceremony_faq.blocks[0].settings.answer = "It is a ceremony-focused visual story built around moments such as the processional, officiant, vows, ring exchange, guest reactions, first kiss, and recessional. Proposal, invitation, reception, and anniversary stories cover different moments.";
    json.sections.wedding_ceremony_boundaries.blocks[2].settings.text = "Save the Date: a pre-event date announcement.";
    json.sections.wedding_ceremony_boundaries.blocks[3].settings.text = "Wedding Invitation: formal wording, schedule, venue details, and RSVP collection.";
    json.mediaManifest[4].caption = "A vows-and-officiant scene makes the ceremony moment immediately clear.";
    json.mediaManifest[9].caption = "A wide officiant view makes the event structure and ceremony setting clear.";
  }
  syncManifestImageMetadata(json.sections, new Map((json.mediaManifest || []).map((asset) => [asset.src, asset])));
  return json;
}

function assertPublicBoundary(page) {
  const serialized = JSON.stringify(page);
  assert.doesNotMatch(serialized, /\b(?:keyword ownership|search intent|query ownership|indexation|do not index|before launch|product evidence|same query|page owns|landing-page hero|multiple intents|RSVP intent|date-announcement intent|ceremony-specific intent)\b/i, "internal authoring instruction remains in public page JSON");
  assert.equal(page.sectionsOrder.length, page.contentContract?.requiredSections?.length ?? page.sectionsOrder.length, "section contract/order mismatch");
  assert(page.sectionsOrder.every((id) => page.sections[id]), "ordered section missing");
}

const targetSlugs = [
  "/ai-save-the-date/valentines-day", "/ai-save-the-date/engagement", "/ai-save-the-date/proposal",
  "/ai-save-the-date/save-the-date", "/holidays-events/wedding-invitation", "/ai-save-the-date/wedding-ceremony",
  "/ai-save-the-date/christmas", "/ai-save-the-date/halloween", "/ai-save-the-date/thanksgiving",
  "/ai-save-the-date/new-year", "/ai-save-the-date/mothers-day", "/ai-save-the-date/fathers-day",
  "/ai-save-the-date/wedding-anniversary"
];

const prisma = new PrismaClient();
try {
  const [pages, settings] = await Promise.all([
    prisma.themePage.findMany({ where: { siteId: SITE_ID, slug: { in: targetSlugs } }, select: { id: true, slug: true, draftJson: true } }),
    prisma.themeSettings.findUnique({ where: { siteId: SITE_ID }, select: { draftJson: true } })
  ]);
  assert.equal(pages.length, targetSlugs.length, "target ThemePage inventory changed");
  assert(settings, "ThemeSettings missing");
  const changes = pages.map((page) => {
    const repaired = repairPage(page.slug, page.draftJson);
    assertPublicBoundary(repaired);
    return {
      id: page.id,
      slug: page.slug,
      repaired,
      beforeHash: contentHash(page.draftJson),
      afterHash: contentHash(repaired)
    };
  });
  const nextSettings = clone(settings.draftJson);
  const engagementNav = nextSettings.saveTheDateNavigation?.groups?.flatMap((group) => group.items || []).find((item) => item.href === "/ai-save-the-date/engagement");
  assert(engagementNav, "Engagement navigation item missing");
  engagementNav.imageUrl = engagementAssets[0].src;
  engagementNav.imageAlt = engagementAssets[0].alt;

  if (APPLY) {
    await prisma.$transaction(async (tx) => {
      for (const change of changes) {
        await tx.themePage.update({ where: { id: change.id }, data: { draftJson: change.repaired, publishedJson: change.repaired } });
      }
      await tx.themeSettings.update({ where: { siteId: SITE_ID }, data: { draftJson: nextSettings } });
      for (const asset of engagementAssets) {
        const id = `media_${SITE_ID}_${crypto.createHash("sha256").update(asset.src).digest("hex").slice(0, 24)}`;
        await tx.mediaAsset.upsert({
          where: { siteId_storageKey: { siteId: SITE_ID, storageKey: asset.src } },
          create: { id, siteId: SITE_ID, label: asset.filename, storageKey: asset.src, mimeType: "image/webp", usageType: "theme", sourceType: "engagement-editorial-source", previewUrl: asset.src, originUrl: asset.src, altText: asset.alt, notes: asset.caption },
          update: { label: asset.filename, mimeType: "image/webp", usageType: "theme", sourceType: "engagement-editorial-source", previewUrl: asset.src, originUrl: asset.src, altText: asset.alt, notes: asset.caption }
        });
      }
    });
  }

  console.log(JSON.stringify({
    siteId: SITE_ID,
    mode: APPLY ? "applied-local-draft" : "dry-run",
    changedPages: changes.filter((change) => change.beforeHash !== change.afterHash).map((change) => change.slug),
    engagementMediaAssets: engagementAssets.length,
    themeSettingsChanged: JSON.stringify(settings.draftJson) !== JSON.stringify(nextSettings),
    publicOwner: "ThemePage.draftJson + ThemeSettings.draftJson + MediaAsset"
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
