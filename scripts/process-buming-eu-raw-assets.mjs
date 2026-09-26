#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { writeProviderImageBundle } from "./lib/provider-image-output.mjs";

const RAW_ROOT = "/tmp/codex-buming-eu-raw-20260926";
const TASKS = [
  [1, "/assets/sites/site_aidreamcapes_eu/restored/originals/aidreamcapes-eu-no-crop-v1/provider-buming-20260926/proposal/hero-ai-proposal-beach-sunset.jpg"],
  [2, "/assets/sites/site_aidreamcapes_eu/restored/originals/aidreamcapes-eu-no-crop-v1/provider-buming-20260926/engagement/hero-ai-engagement-couple-sunset.jpg"],
  [3, "/assets/sites/site_aidreamcapes_eu/restored/originals/aidreamcapes-eu-no-crop-v1/provider-buming-20260926/motion-generator/ai-video-add-ons-02-product-motion.jpg"],
  [5, "/assets/sites/site_aidreamcapes_eu/restored/originals/aidreamcapes-eu-no-crop-v1/provider-buming-20260926/wedding-ceremony/hero-ai-wedding-ceremony-first-kiss.jpg"],
  [6, "/assets/sites/site_aidreamshoots/restored/originals/aidreamshoots-eu-no-crop-v1/provider-buming-20260926/talking-photo/talking-photo-birthday-greeting-woman-cake.jpg"],
  [7, "/assets/sites/site_aidreamshoots/restored/originals/aidreamshoots-eu-no-crop-v1/provider-buming-20260926/talking-photo/talking-photo-personal-message-older-man.jpg"],
  [8, "/assets/sites/site_aidreamshoots/restored/originals/aidreamshoots-eu-no-crop-v1/provider-buming-20260926/talking-photo/talking-photo-education-explainer-teacher.jpg"],
  [9, "/assets/sites/site_aidreamshoots/restored/originals/aidreamshoots-eu-no-crop-v1/provider-buming-20260926/talking-photo/talking-photo-social-video-creator.jpg"],
  [10, "/assets/sites/site_aidreamshoots/restored/originals/aidreamshoots-eu-no-crop-v1/provider-buming-20260926/talking-photo/talking-photo-product-intro-spokesperson.jpg"],
  [11, "/assets/sites/site_aidreamshoots/restored/originals/aidreamshoots-eu-no-crop-v1/provider-buming-20260926/talking-photo/talking-photo-holiday-greeting-woman-gift.jpg"]
];

const results = [];
for (const [taskNumber, publicUrl] of TASKS) {
  const rawPath = path.join(RAW_ROOT, String(taskNumber).padStart(2, "0") + ".bin");
  const displayPath = path.resolve("public" + publicUrl);
  const originalPathBase = path.resolve("public" + publicUrl.replace(/\.[^.]+$/, "")) + ".provider-output";
  const buffer = await fs.readFile(rawPath);
  const bundle = await writeProviderImageBundle({ buffer, originalPathBase, displayPath, displayWidth: 3840, label: publicUrl });
  results.push({ taskNumber, publicUrl, bytes: buffer.length, ...bundle });
}
console.log(JSON.stringify({ ok: true, processed: results.length, results }, null, 2));
