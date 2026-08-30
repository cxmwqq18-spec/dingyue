#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import createJiti from "jiti";

const repoRoot = process.cwd();
const jiti = createJiti(import.meta.url);
const { aiVideoTopicLandingContentByKey } = jiti("./seed-mydreamshoots-ai-video-topic-content.ts");
const { talkingPhotoContent } = jiti("./seed-mydreamshoots-talking-photo-content.ts");
const { aiVideoTopicLandingContentFromSection } = jiti("../src/lib/ai-video-topic-content.ts");
const { talkingPhotoContentFromSection } = jiti("../src/lib/talking-photo-content.ts");

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveFilename(request, ...args) {
  let resolved = request.startsWith("@/") ? path.join(repoRoot, "src", request.slice(2)) : request;
  if (request.startsWith("@/") && fs.existsSync(`${resolved}.ts`)) resolved = `${resolved}.ts`;
  return originalResolveFilename.call(this, resolved, ...args);
};
const { compileMydreamshootsVideoTopicPublication } = jiti("../src/lib/mydreamshoots-video-topic-publication.ts");
Module._resolveFilename = originalResolveFilename;

const expected = {
  "instagram-reels": {
    src: "/assets/dreamshoot/instagram-reels/turn-photos-and-ideas-into-reels-that-fit-your-feed.mp4",
    poster: "/assets/dreamshoot/instagram-reels/turn-photos-and-ideas-into-reels-that-fit-your-feed.webp",
    label: "Turn Photos and Ideas Into Reels That Fit Your Feed",
    width: 496,
    height: 864,
    fit: "contain",
    caption: "Raw creator setup · cover-ready reveal · polished 9:16 Reel"
  },
  "cinematic-video": {
    src: "/assets/dreamshoot/cinematic-video/create-a-more-cinematic-video-without-a-full-film-crew.mp4",
    poster: "/assets/dreamshoot/cinematic-video/create-a-more-cinematic-video-without-a-full-film-crew.webp",
    label: "Create a More Cinematic Video Without a Full Film Crew",
    width: 864,
    height: 496,
    fit: "cover",
    caption: "Cinematic tracking shot, neon rain, shifting headlights, and a tense over-the-shoulder reveal."
  },
  "tiktok-video": {
    src: "/assets/dreamshoot/tiktok-video/turn-your-photos-and-ideas-into-tiktok-first-videos.mp4",
    poster: "/assets/dreamshoot/tiktok-video/turn-your-photos-and-ideas-into-tiktok-first-videos.webp",
    label: "Turn Your Photos and Ideas Into TikTok-First Videos",
    width: 496,
    height: 864,
    fit: "contain",
    caption: "Hand-cover transition · casual to polished · TikTok-first 9:16"
  },
  "music-video": {
    src: "/assets/dreamshoot/music-video/ai-music-video-generator-for-artist-visuals-and-performance-concepts.mp4",
    poster: "/assets/dreamshoot/music-video/ai-music-video-generator-for-artist-visuals-and-performance-concepts.webp",
    label: "AI Music Video Generator for Artist Visuals & Performance Concepts",
    width: 864,
    height: 496,
    fit: "cover",
    caption: "Artist identity -> Visual motif -> Performance or narrative -> Motion -> Sequence"
  }
};

const talkingExpected = {
  src: "/assets/dreamshoot/talking-photo/make-a-photo-talk-without-recording-another-take.mp4",
  poster: "/assets/dreamshoot/talking-photo/make-a-photo-talk-without-recording-another-take.webp",
  label: "Make a Photo Talk Without Recording Another Take",
  width: 752,
  height: 560,
  fit: "cover"
};

function sectionFor(content, type = "ai_video_topic_landing") {
  return { id: "test", type, settings: { content }, blocks: [] };
}

function topicPage(slug, content, type = "ai_video_topic_landing") {
  const sectionId = `${slug}-hero`;
  const json = {
    pageType: "ai_tool",
    version: 1,
    sectionsOrder: [sectionId],
    sections: { [sectionId]: sectionFor(content, type) },
    seo: { index: true, robots: { index: true, follow: true } }
  };
  return {
    id: `page-${slug}`,
    pageType: "ai_tool",
    slug: `/ai-video-generation/${slug}`,
    title: slug,
    draftJson: json,
    publishedJson: json
  };
}

for (const [slug, video] of Object.entries(expected)) {
  const content = aiVideoTopicLandingContentByKey[slug];
  const { caption, ...expectedVideo } = video;
  assert.deepEqual(content.hero.video, expectedVideo, `${slug} must publish the approved hero video contract`);
  assert.equal(content.hero.image.src, video.poster, `${slug} hero image must be the video poster`);
  assert.equal(content.hero.imageNote, caption, `${slug} must publish the approved hero caption`);
  assert(aiVideoTopicLandingContentFromSection(sectionFor(content)), `${slug} content parser must accept hero.video`);
}

assert.deepEqual(talkingPhotoContent.hero.video, talkingExpected, "talking-photo must publish the approved hero video contract");
assert.equal(talkingPhotoContent.hero.image.src, talkingExpected.poster);
assert(talkingPhotoContentFromSection(sectionFor(talkingPhotoContent, "talking_photo_landing")));
assert.equal(
  aiVideoTopicLandingContentByKey["product-video"].hero.imageNote,
  "Problem-to-payoff ad · product-focused storytelling · AI-generated commercial"
);

for (const [slug, video] of [...Object.entries(expected), ["talking-photo", talkingExpected]]) {
  for (const assetUrl of [video.src, video.poster]) {
    assert(fs.existsSync(path.join(repoRoot, "public", assetUrl)), `${slug} asset must exist: ${assetUrl}`);
  }
}

const publication = compileMydreamshootsVideoTopicPublication([
  ...Object.keys(expected).map((slug) => topicPage(slug, aiVideoTopicLandingContentByKey[slug])),
  topicPage("talking-photo", talkingPhotoContent, "talking_photo_landing")
]);
for (const media of publication.pageMedia) {
  const slug = media.pageEntityId.split(":").at(-1);
  const video = slug === "talking-photo" ? talkingExpected : expected[slug];
  assert.equal(media.primaryImage, video.poster, `${slug} homepage projection must use the approved poster`);
  assert(!media.primaryImage.endsWith(".mp4"), `${media.pageEntityId} primary media must remain an image poster`);
  assert(media.galleryImages.every((item) => !item.endsWith(".mp4")), `${media.pageEntityId} image gallery must exclude video files`);
}

const projectedSource = topicPage("instagram-reels", structuredClone(aiVideoTopicLandingContentByKey["instagram-reels"]));
const projectedPublication = compileMydreamshootsVideoTopicPublication([projectedSource]);
projectedSource.draftJson.sections["instagram-reels-hero"].settings.content.hero.video.src = "/unpublished-draft-video.mp4";
assert.equal(
  projectedPublication.navigation[0].videoUrl,
  expected["instagram-reels"].src,
  "homepage video must remain bound to its immutable publication projection after the source draft changes"
);
const themeStoreSource = fs.readFileSync(path.join(repoRoot, "src/lib/stores/theme-store.ts"), "utf8");
assert.match(themeStoreSource, /videoUrl:\s*item\.videoUrl/, "homepage must consume the projected video URL");
assert.doesNotMatch(themeStoreSource, /firstVideoUrl|videoUrl:\s*firstVideoUrl/, "homepage must not read playable media directly from ThemePage drafts");

console.log(JSON.stringify({ ok: true, topics: Object.keys(expected).length + 1, productCaption: true }, null, 2));
