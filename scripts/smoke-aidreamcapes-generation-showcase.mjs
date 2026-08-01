import { spawn } from "node:child_process";
import path from "node:path";
import assert from "node:assert/strict";
import ffmpegPath from "ffmpeg-static";

const url = process.env.AIDREAMCAPES_SHOWCASE_URL || "http://localhost:3002/site/aidreamcapes";
const response = await fetch(url);
assert.equal(response.ok, true, `Aidreamcapes page did not load: ${response.status}`);

const html = await response.text();
const imageTitle = "Fan and holiday image themes";
const videoTitle = "Customer travel video themes";
const imageStart = html.indexOf(imageTitle);
const videoStart = html.indexOf(videoTitle, imageStart);
assert.notEqual(imageStart, -1, `${imageTitle} section was not rendered`);
assert.notEqual(videoStart, -1, `${videoTitle} section was not rendered`);

const imageRailHtml = html.slice(imageStart, videoStart);
assert.equal(
  imageRailHtml.includes("fan-holiday-theme/images/"),
  false,
  "Aidreamcapes generation showcase should use current category assets, not legacy images/"
);

const hasChristmasChild = imageRailHtml.includes("christmas-group-albums.webp");
const hasChristmasParent = imageRailHtml.includes("christmas-holiday-albums.webp");
assert.equal(
  hasChristmasChild && hasChristmasParent,
  false,
  "Aidreamcapes generation showcase should not show both Christmas parent and child category cards"
);

const videoRailHtml = html.slice(videoStart);
assert.equal(
  videoRailHtml.includes("fan-holiday-theme/videos/"),
  false,
  "Aidreamcapes must not replace its real showcase videos with poster-derived fan-holiday fallback clips"
);
const videoSrcs = Array.from(videoRailHtml.matchAll(/homepage-showcase\/videos\/[^"'<\s]+?\.mp4(?:\?[^"'<\s]*)?/g), (match) => match[0].replace(/\\+$/, ""));
const uniqueVideoSrcs = Array.from(new Set(videoSrcs));
const expectedVideoSlugs = [
  "route-atlas-motion",
  "coastal-memory-clip",
  "old-quarter-walkthrough",
  "resort-balcony-motion",
  "scenic-overlook-pan",
  "alpine-trail-motion",
  "solo-traveler-profile-clip",
  "heritage-celebration-film"
].sort();
const actualVideoSlugs = uniqueVideoSrcs
  .map((source) => path.basename(source.split("?")[0], ".mp4"))
  .sort();
assert.deepEqual(actualVideoSlugs, expectedVideoSlugs, "Aidreamcapes should restore the original eight real travel showcase videos");
assert.equal(
  videoRailHtml.includes('data-showcase-card-kind="video"'),
  true,
  "Aidreamcapes motion showcase cards should expose video card styling semantics"
);

function readVideoFrame(filePath, timeSeconds) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath || "ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-ss",
      String(timeSeconds),
      "-i",
      filePath,
      "-frames:v",
      "1",
      "-vf",
      "scale=96:96,format=rgb24",
      "-f",
      "rawvideo",
      "pipe:1"
    ], { stdio: ["ignore", "pipe", "pipe"] });
    const chunks = [];
    let errorText = "";
    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.stderr.on("data", (chunk) => {
      errorText += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      const bytes = Buffer.concat(chunks);
      if (code !== 0 || bytes.length === 0) {
        reject(new Error(`Unable to read video frame from ${filePath}: ${errorText.slice(-500)}`));
        return;
      }
      resolve(bytes);
    });
  });
}

function meanAbsoluteDifference(left, right) {
  const length = Math.min(left.length, right.length);
  let total = 0;
  for (let index = 0; index < length; index += 1) total += Math.abs(left[index] - right[index]);
  return total / length;
}

const motionScores = [];
for (const source of uniqueVideoSrcs) {
  const relativeAssetPath = source.split("?")[0];
  const localVideoPath = path.join(
    process.cwd(),
    "public",
    "assets",
    "sites",
    "site_aidreamcapes",
    relativeAssetPath
  );
  const firstFrame = await readVideoFrame(localVideoPath, 0.1);
  const middleFrame = await readVideoFrame(localVideoPath, 3);
  const score = meanAbsoluteDifference(firstFrame, middleFrame);
  motionScores.push({ source, score });
  assert.ok(score > 5, `${source} appears to be a static poster fallback (frame difference ${score.toFixed(2)})`);
}

console.log(JSON.stringify({ ok: true, videoCount: uniqueVideoSrcs.length, motionScores }));
