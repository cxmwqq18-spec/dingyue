#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const state = JSON.parse(fs.readFileSync(path.join(repoRoot, "data", "platform-state.json"), "utf8"));
const failures = [];

const insertedOrder = ["tutorial_video_1", "tutorial_image_video_1", "mobile_video_1"];
const expected = {
  site_dreamshoot: {
    introImage: "/assets/dreamshoot/generated/20260622-homepage-unique/hero-package-wall.png",
    video: "/assets/dreamshoot/generated/homepage-showcase/videos/mydreamshoots-i2v-tutorial-45s.mp4",
    imageVideo: "/assets/dreamshoot/generated/homepage-showcase/videos/mydreamshoots-ai-image-tutorial-55s.mp4",
    mobileImage: "/assets/dreamshoot/generated/20260622-homepage-unique/flow-private-album-workspace.png",
    mobileLeftVideo: "/assets/dreamshoot/generated/homepage-showcase/videos/mydreamshoots-ai-image-mobile-tutorial-55s.mp4",
    mobileRightVideo: "/assets/dreamshoot/generated/homepage-showcase/videos/mydreamshoots-i2v-mobile-tutorial-45s.mp4",
    mobileLeftPoster: "/assets/dreamshoot/generated/homepage-showcase/posters/mydreamshoots-ai-image-mobile-tutorial-55s.jpg",
    mobileRightPoster: "/assets/dreamshoot/generated/homepage-showcase/posters/mydreamshoots-i2v-mobile-tutorial-45s.jpg"
  },
  site_aidreamcapes: {
    introImage: "/assets/sites/site_aidreamcapes/fan-holiday-theme/covers/private-fan-scene-album.webp",
    video: "/assets/sites/site_aidreamcapes/homepage-showcase/videos/aidreamcapes-i2v-tutorial-55s.mp4",
    imageVideo: "/assets/sites/site_aidreamcapes/homepage-showcase/videos/aidreamcapes-ai-image-tutorial-55s.mp4",
    mobileImage: "/assets/sites/site_aidreamcapes/fan-holiday-theme/gallery/private-fan-scene-album-01.webp",
    mobileLeftVideo: "/assets/sites/site_aidreamcapes/homepage-showcase/videos/aidreamcapes-ai-image-mobile-tutorial-55s.mp4",
    mobileRightVideo: "/assets/sites/site_aidreamcapes/homepage-showcase/videos/aidreamcapes-i2v-mobile-tutorial-55s.mp4",
    mobileLeftPoster: "/assets/sites/site_aidreamcapes/homepage-showcase/posters/aidreamcapes-ai-image-mobile-tutorial-55s.jpg",
    mobileRightPoster: "/assets/sites/site_aidreamcapes/homepage-showcase/posters/aidreamcapes-i2v-mobile-tutorial-55s.jpg"
  }
};

function fail(message) {
  failures.push(message);
}

function stripVersion(value) {
  return String(value || "").split("?")[0].split("#")[0];
}

function localAssetPath(value) {
  return path.join(repoRoot, "public", stripVersion(value).replace(/^\/assets\//, "assets/"));
}

function requireAsset(value, label) {
  if (!value) {
    fail(`missing_asset_setting:${label}`);
    return;
  }
  const filePath = localAssetPath(value);
  if (!fs.existsSync(filePath)) fail(`missing_asset_file:${label}:${stripVersion(value)}`);
}

function workflowPage(siteId) {
  const site = state.sites?.find((item) => item.id === siteId);
  if (!site) {
    fail(`missing_site:${siteId}`);
    return undefined;
  }
  const page = site.pages?.find((item) => item.slug === "/workflow");
  if (!page) fail(`missing_workflow_page:${siteId}`);
  return page;
}

function requireWorkflowJson(siteId, jsonName, json) {
  if (!json?.sections || !Array.isArray(json.sectionsOrder)) {
    fail(`invalid_workflow_json:${siteId}:${jsonName}`);
    return;
  }
  const introIndex = json.sectionsOrder.indexOf("workflow_intro_1");
  const actualInsert = json.sectionsOrder.slice(introIndex + 1, introIndex + 1 + insertedOrder.length);
  if (introIndex === -1 || JSON.stringify(actualInsert) !== JSON.stringify(insertedOrder)) {
    fail(`bad_workflow_video_order:${siteId}:${jsonName}:${json.sectionsOrder.join(",")}`);
  }

  const tutorialVideo = json.sections.tutorial_video_1;
  const tutorialImageVideo = json.sections.tutorial_image_video_1;
  const mobileVideo = json.sections.mobile_video_1;
  const intro = json.sections.workflow_intro_1;
  if (tutorialVideo?.type !== "video_feature") fail(`bad_tutorial_video_type:${siteId}:${jsonName}:${tutorialVideo?.type}`);
  if (tutorialImageVideo?.type !== "video_feature") fail(`bad_tutorial_image_video_type:${siteId}:${jsonName}:${tutorialImageVideo?.type}`);
  if (mobileVideo?.type !== "mobile_video_showcase") fail(`bad_mobile_video_type:${siteId}:${jsonName}:${mobileVideo?.type}`);

  requireAsset(tutorialVideo?.settings?.imageUrl, `${siteId}:${jsonName}:tutorial_video_poster`);
  requireAsset(tutorialVideo?.settings?.videoUrl, `${siteId}:${jsonName}:tutorial_video_file`);
  requireAsset(tutorialImageVideo?.settings?.imageUrl, `${siteId}:${jsonName}:tutorial_image_video_poster`);
  requireAsset(tutorialImageVideo?.settings?.videoUrl, `${siteId}:${jsonName}:tutorial_image_video_file`);
  requireAsset(mobileVideo?.settings?.imageUrl, `${siteId}:${jsonName}:mobile_left_image`);
  requireAsset(mobileVideo?.settings?.leftVideoUrl, `${siteId}:${jsonName}:mobile_left_video`);
  requireAsset(mobileVideo?.settings?.rightVideoUrl, `${siteId}:${jsonName}:mobile_right_video`);
  requireAsset(mobileVideo?.settings?.leftVideoPoster, `${siteId}:${jsonName}:mobile_left_poster`);
  requireAsset(mobileVideo?.settings?.rightVideoPoster, `${siteId}:${jsonName}:mobile_right_poster`);
  requireAsset(mobileVideo?.settings?.videoUrl, `${siteId}:${jsonName}:mobile_legacy_video`);
  requireAsset(mobileVideo?.settings?.videoPoster, `${siteId}:${jsonName}:mobile_video_poster`);

  const expectedSite = expected[siteId];
  if (expectedSite) {
    requireAsset(intro?.settings?.imageUrl || expectedSite.introImage, `${siteId}:${jsonName}:workflow_intro_image`);
    if (stripVersion(intro?.settings?.imageUrl || expectedSite.introImage) !== expectedSite.introImage) fail(`wrong_workflow_intro_image:${siteId}:${jsonName}`);
    if (stripVersion(tutorialVideo?.settings?.videoUrl) !== expectedSite.video) fail(`wrong_tutorial_video:${siteId}:${jsonName}`);
    if (stripVersion(tutorialImageVideo?.settings?.videoUrl) !== expectedSite.imageVideo) fail(`wrong_tutorial_image_video:${siteId}:${jsonName}`);
    if (stripVersion(mobileVideo?.settings?.imageUrl) !== expectedSite.mobileImage) fail(`wrong_mobile_image:${siteId}:${jsonName}`);
    if (stripVersion(mobileVideo?.settings?.leftVideoUrl) !== expectedSite.mobileLeftVideo) fail(`wrong_mobile_left_video:${siteId}:${jsonName}`);
    if (stripVersion(mobileVideo?.settings?.rightVideoUrl) !== expectedSite.mobileRightVideo) fail(`wrong_mobile_right_video:${siteId}:${jsonName}`);
    if (stripVersion(mobileVideo?.settings?.leftVideoPoster) !== expectedSite.mobileLeftPoster) fail(`wrong_mobile_left_poster:${siteId}:${jsonName}`);
    if (stripVersion(mobileVideo?.settings?.rightVideoPoster) !== expectedSite.mobileRightPoster) fail(`wrong_mobile_right_poster:${siteId}:${jsonName}`);
  }
  if (stripVersion(mobileVideo?.settings?.videoUrl) !== expectedSite?.mobileRightVideo) fail(`mobile_video_should_match_right_video:${siteId}:${jsonName}`);
  if (stripVersion(mobileVideo?.settings?.videoPoster) !== expectedSite?.mobileRightPoster) fail(`mobile_video_poster_should_match_right_poster:${siteId}:${jsonName}`);
}

for (const siteId of Object.keys(expected)) {
  const page = workflowPage(siteId);
  if (!page) continue;
  requireWorkflowJson(siteId, "draftJson", page.draftJson);
  requireWorkflowJson(siteId, "publishedJson", page.publishedJson);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("PASS workflow video sections smoke");
