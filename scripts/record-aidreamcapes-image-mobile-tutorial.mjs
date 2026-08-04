import "./load-runtime-env.mjs";

process.env.TUTORIAL_DEVICE = process.env.TUTORIAL_DEVICE || "mobile";
process.env.TUTORIAL_VIEWPORT_WIDTH = process.env.TUTORIAL_VIEWPORT_WIDTH || "390";
process.env.TUTORIAL_VIEWPORT_HEIGHT = process.env.TUTORIAL_VIEWPORT_HEIGHT || "844";
process.env.TUTORIAL_OUTPUT_WIDTH = process.env.TUTORIAL_OUTPUT_WIDTH || "1080";
process.env.TUTORIAL_OUTPUT_HEIGHT = process.env.TUTORIAL_OUTPUT_HEIGHT || "1920";
process.env.TUTORIAL_DEVICE_SCALE_FACTOR = process.env.TUTORIAL_DEVICE_SCALE_FACTOR || "2";

process.env.TUTORIAL_BASE_URL =
  process.env.AIDREAMCAPES_IMAGE_MOBILE_TUTORIAL_BASE_URL ||
  process.env.TUTORIAL_BASE_URL ||
  "http://127.0.0.1:3002";
process.env.TUTORIAL_RUN_KEY = process.env.TUTORIAL_RUN_KEY || "aidreamcapes-ai-image-mobile-tutorial";
process.env.TUTORIAL_WORK_DIR = process.env.TUTORIAL_WORK_DIR || "aidreamcapes-ai-image-mobile-tutorial-work";
process.env.TUTORIAL_TARGET_SECONDS = process.env.TUTORIAL_TARGET_SECONDS || "55";
process.env.TUTORIAL_OUTPUT_MP4 = process.env.TUTORIAL_OUTPUT_MP4 || "output/aidreamcapes-ai-image-mobile-tutorial-55s.mp4";
process.env.TUTORIAL_REAL_GENERATION = process.env.TUTORIAL_REAL_GENERATION || (process.env.AIDREAMCAPES_IMAGE_MOBILE_TUTORIAL_REAL_GENERATION === "1" ? "1" : "0");

await import("./record-aidreamcapes-image-tutorial.mjs");
