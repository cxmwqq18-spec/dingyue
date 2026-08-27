#!/usr/bin/env node
import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

const siteId = process.env.SAVE_THE_DATE_SITE_ID || "site_dreamshoot";
const apply = process.argv.includes("--apply");
assertDatabaseTarget({ expectedTarget: "local" });
const clone = (value) => JSON.parse(JSON.stringify(value));
const image = (asset) => asset ? ({ imageUrl: asset.src, imageAlt: asset.alt || asset.altText || asset.filename, imageWidth: asset.width || 1600, imageHeight: asset.height || 1000, imageLoading: asset.loading || "lazy", imageFetchPriority: asset.fetchPriority || "auto" }) : {};
const section = (json, id) => json.sections?.[id];
const setBlockImage = (block, asset) => { if (block && asset) block.settings = { ...block.settings, ...image(asset) }; };
const setListImages = (list, assets) => (list || []).forEach((block, index) => setBlockImage(block, assets[index % assets.length]));

const prisma = new PrismaClient();
try {
  const paths = [
    "/ai-save-the-date/valentines-day",
    "/ai-save-the-date/engagement",
    "/ai-save-the-date/proposal",
    "/ai-save-the-date/save-the-date",
    "/ai-save-the-date/mothers-day",
    "/ai-save-the-date/fathers-day",
  ];
  const pages = await prisma.themePage.findMany({ where: { siteId, slug: { in: paths } }, select: { id: true, slug: true, publishedJson: true, draftJson: true } });
  const reports = [];
  for (const page of pages) {
    const json = clone(page.publishedJson || page.draftJson || {});
    const assets = Array.isArray(json.mediaManifest) ? json.mediaManifest : [];
    const byName = new Map(assets.map((asset) => [asset.filename, asset]));
    const before = JSON.stringify(json);
    if (page.slug === "/ai-save-the-date/engagement") {
      const scene = section(json, "engagement_scene_directions");
      const names = ["ai-engagement-proposal-moment.jpg", "ai-engagement-save-the-date-planning.jpg", "ai-engagement-garden-portrait.jpg", "ai-engagement-sunset-beach-portrait.jpg", "ai-engagement-couple-city-walk.jpg", "ai-engagement-ring-closeup.jpg", "ai-engagement-beach-walk.jpg", "ai-engagement-video-shoot.jpg"];
      names.forEach((name, index) => setBlockImage(scene?.blocks?.[index + 1], byName.get(name)));
      const format = section(json, "engagement_formats");
      setListImages(format?.blocks, [byName.get("ai-engagement-video-shoot.jpg"), byName.get("ai-engagement-ring-closeup.jpg"), byName.get("ai-engagement-video-shoot.jpg")]);
      const workflow = section(json, "engagement_workflow");
      setListImages(workflow?.blocks, [byName.get("ai-engagement-save-the-date-planning.jpg"), byName.get("ai-engagement-save-the-date-planning.jpg"), byName.get("ai-engagement-couple-city-walk.jpg"), byName.get("ai-engagement-proposal-moment.jpg"), byName.get("ai-engagement-video-shoot.jpg"), byName.get("ai-engagement-video-shoot.jpg")]);
      if (workflow) workflow.settings = { ...workflow.settings, ...image(byName.get("ai-engagement-save-the-date-planning.jpg")) };
    }
    if (page.slug === "/ai-save-the-date/save-the-date") {
      const scene = section(json, "save_date_scene_ideas");
      setListImages(scene?.blocks, assets.slice(0, 11));
      const format = section(json, "save_date_formats");
      setListImages(format?.blocks, [assets[10], assets[6], assets[9]]);
      const workflow = section(json, "save_date_workflow");
      setListImages(workflow?.blocks, [assets[3], assets[3], assets[7], assets[8], assets[10], assets[10]]);
      if (workflow) workflow.settings = { ...workflow.settings, ...image(assets[3]) };
      const cta = section(json, "save_date_final_cta");
      if (cta) cta.settings = { ...cta.settings, ...image(assets[10]) };
    }
    if (page.slug === "/ai-save-the-date/proposal") {
      const useCases = section(json, "proposal_use_cases");
      const useCaseTitles = ["Surprise proposal", "Ring reveal", "Rooftop or city proposal", "Beach or destination proposal", "Proposal story from relationship photos", "After-the-yes celebration", "Social announcement"];
      if (useCases) useCases.blocks = useCaseTitles.map((title, index) => ({ id: `proposal-use-case-${index + 1}`, type: "scene_card", settings: { title, text: title, ...image(assets[index + 3]) } }));
      const flow = section(json, "proposal_story_flow");
      const flowItems = [["Setup", "Open with the location, context, and couple details before the proposal moment."], ["Build-up", "Increase anticipation with a short sequence that stays believable."], ["Proposal", "Hold on the central question and ring reveal as the visual peak."], ["Reaction", "Give the answer and embrace enough time to read naturally."], ["Close", "Finish with a calm couple frame and editable message layer."]];
      if (flow) flow.blocks = flowItems.map(([title, text], index) => ({ id: `proposal-story-flow-${index + 1}`, type: "story_card", settings: { title, text, ...image([assets[0], assets[3], assets[4], assets[5], assets[6]][index]) } }));
      const workflow = section(json, "proposal_workflow");
      setListImages(workflow?.blocks, [assets[8], assets[0], assets[4], assets[5], assets[8], assets[9]]);
      if (workflow) workflow.settings = { ...workflow.settings, ...image(assets[8]) };
      const source = section(json, "proposal_source_media");
      if (source) source.settings = { ...source.settings, ...image(assets[9]) };
    }
    if (page.slug === "/ai-save-the-date/valentines-day") {
      const positioning = section(json, "save_date_positioning"); if (positioning) positioning.settings = { ...positioning.settings, ...image(assets[1]) };
      const details = section(json, "save_date_details"); if (details) { details.settings = { ...details.settings, ...image(assets[4]) }; setListImages(details.blocks, [assets[4], assets[7]]); }
      const workflow = section(json, "save_date_workflow"); if (workflow) { workflow.settings = { ...workflow.settings, ...image(assets[6]) }; }
      const ideas = section(json, "save_date_ideas"); if (ideas) setListImages(ideas.blocks, [assets[9], assets[7], assets[8], assets[9], assets[10]]);
      const formats = section(json, "save_date_formats"); if (formats) setListImages(formats.blocks, [assets[7], assets[5], assets[6]]);
      const cta = section(json, "save_date_final_cta"); if (cta) cta.settings = { ...cta.settings, ...image(assets[10]) };
    }
    if (page.slug === "/ai-save-the-date/fathers-day") {
      const useCases = section(json, "fathers_day_use_cases");
      if (useCases) setListImages(useCases.blocks, assets.slice(1, 5));
    }
    for (const asset of assets) {
        if (!asset?.src) continue;
        const safeName = String(asset.filename || asset.src).replace(/[^a-z0-9]+/gi, "_").toLowerCase();
        if (apply) await prisma.mediaAsset.upsert({
          where: { siteId_storageKey: { siteId, storageKey: asset.src } },
          create: { id: `media_${siteId}_${safeName}`, siteId, label: asset.filename || safeName, storageKey: asset.src, mimeType: "image/jpeg", usageType: "theme", sourceType: `theme-${page.slug.slice(1).replace(/[^a-z0-9]+/gi, "-")}-source`, previewUrl: asset.src, originUrl: asset.src, altText: asset.alt || asset.altText || asset.filename || safeName, notes: asset.caption || null },
          update: { altText: asset.alt || asset.altText || asset.filename || safeName, previewUrl: asset.src, originUrl: asset.src, notes: asset.caption || null }
        });
    }
    if (JSON.stringify(json) !== before) {
      if (apply) await prisma.themePage.update({ where: { id: page.id }, data: { draftJson: json } });
      reports.push({ slug: page.slug, updated: true });
    } else reports.push({ slug: page.slug, updated: false });
  }
  console.log(JSON.stringify({ siteId, mode: apply ? "draft-only" : "dry-run", reports, publicationRequired: true }, null, 2));
} finally { await prisma.$disconnect(); }
