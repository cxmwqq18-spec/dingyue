import "./load-runtime-env.mjs";

process.env.TUTORIAL_BASE_URL = process.env.AIDREAMCAPES_IMAGE_TUTORIAL_BASE_URL || "http://127.0.0.1:3002";
process.env.TUTORIAL_SITE_ID = "site_aidreamcapes";
process.env.TUTORIAL_SITE_SLUG = "aidreamcapes";
process.env.TUTORIAL_BRAND_NAME = "Aidreamcapes";
process.env.TUTORIAL_RUN_KEY = "aidreamcapes-ai-image-tutorial";
process.env.TUTORIAL_WORK_DIR = "aidreamcapes-ai-image-tutorial-work";
process.env.TUTORIAL_TARGET_SECONDS = "55";
process.env.TUTORIAL_OUTPUT_MP4 = "output/aidreamcapes-ai-image-tutorial-55s.mp4";
process.env.TUTORIAL_REAL_GENERATION = process.env.AIDREAMCAPES_IMAGE_TUTORIAL_REAL_GENERATION === "1" ? "1" : "0";
process.env.TUTORIAL_MAX_PAID_ATTEMPTS = process.env.AIDREAMCAPES_IMAGE_TUTORIAL_MAX_PAID_ATTEMPTS || "1";
process.env.TUTORIAL_VOICE = process.env.AIDREAMCAPES_IMAGE_TUTORIAL_VOICE || "Samantha";
process.env.TUTORIAL_VOICE_RATE = process.env.AIDREAMCAPES_IMAGE_TUTORIAL_VOICE_RATE || "190";
process.env.TUTORIAL_HIDE_HISTORICAL_ASSETS = process.env.AIDREAMCAPES_IMAGE_TUTORIAL_HIDE_HISTORICAL_ASSETS || "1";
process.env.TUTORIAL_PACKAGE_TITLE = process.env.AIDREAMCAPES_IMAGE_TUTORIAL_PACKAGE_TITLE || "Private Fan Scene Album";
process.env.TUTORIAL_CUSTOMER_EMAIL =
  process.env.AIDREAMCAPES_IMAGE_TUTORIAL_CUSTOMER_EMAIL ||
  process.env.SMOKE_AIDREAMCAPES_CUSTOMER_EMAIL ||
  "aria@aidreamcapes.localhost";
process.env.TUTORIAL_CUSTOMER_PASSWORD =
  process.env.AIDREAMCAPES_IMAGE_TUTORIAL_CUSTOMER_PASSWORD ||
  process.env.SMOKE_AIDREAMCAPES_CUSTOMER_PASSWORD ||
  "aria123";
process.env.TUTORIAL_SOURCE_IMAGE =
  process.env.AIDREAMCAPES_IMAGE_TUTORIAL_SOURCE_IMAGE ||
  "public/assets/sites/site_aidreamcapes/fan-holiday-theme/gallery/private-fan-scene-album-01.webp";
process.env.TUTORIAL_PROMPT_NOTE =
  process.env.AIDREAMCAPES_IMAGE_TUTORIAL_PROMPT_NOTE ||
  "Create a polished private fan-scene portrait album image from the selected approved source photo. Keep the adult subject natural, use warm cinematic event lighting, preserve clean facial detail, avoid logos, avoid public-figure resemblance, avoid text, and avoid watermarks.";

await import("./record-mydreamshoots-image-tutorial.mjs");
