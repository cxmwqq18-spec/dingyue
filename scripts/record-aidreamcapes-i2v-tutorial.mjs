import "./load-runtime-env.mjs";

process.env.TUTORIAL_BASE_URL = process.env.AIDREAMCAPES_TUTORIAL_BASE_URL || "http://127.0.0.1:3002";
process.env.TUTORIAL_SITE_ID = "site_aidreamcapes";
process.env.TUTORIAL_SITE_SLUG = "aidreamcapes";
process.env.TUTORIAL_BRAND_NAME = "Aidreamcapes";
process.env.TUTORIAL_RUN_SLUG = "aidreamcapes-i2v-tutorial-real-work";
process.env.TUTORIAL_TARGET_SECONDS = "55";
process.env.TUTORIAL_OUTPUT_MP4 = "output/aidreamcapes-i2v-tutorial-55s.mp4";
process.env.TUTORIAL_REAL_GENERATION = process.env.AIDREAMCAPES_TUTORIAL_REAL_GENERATION === "1" ? "1" : "0";
process.env.TUTORIAL_MAX_ATTEMPTS = process.env.AIDREAMCAPES_TUTORIAL_MAX_ATTEMPTS || "1";
process.env.TUTORIAL_VOICE = process.env.AIDREAMCAPES_TUTORIAL_VOICE || "Samantha";
process.env.TUTORIAL_VOICE_RATE = process.env.AIDREAMCAPES_TUTORIAL_VOICE_RATE || "160";
process.env.TUTORIAL_BACKGROUND_MUSIC = process.env.AIDREAMCAPES_TUTORIAL_BACKGROUND_MUSIC || "1";
process.env.TUTORIAL_BACKGROUND_VOLUME = process.env.AIDREAMCAPES_TUTORIAL_BACKGROUND_VOLUME || "0.08";
process.env.TUTORIAL_CUSTOMER_EMAIL =
  process.env.AIDREAMCAPES_TUTORIAL_CUSTOMER_EMAIL ||
  process.env.SMOKE_AIDREAMCAPES_CUSTOMER_EMAIL ||
  "aria@aidreamcapes.localhost";
process.env.TUTORIAL_CUSTOMER_PASSWORD =
  process.env.AIDREAMCAPES_TUTORIAL_CUSTOMER_PASSWORD ||
  process.env.SMOKE_AIDREAMCAPES_CUSTOMER_PASSWORD ||
  "aria123";
process.env.TUTORIAL_SOURCE_FRAME_IMAGE =
  process.env.AIDREAMCAPES_TUTORIAL_SOURCE_FRAME_IMAGE ||
  "public/assets/sites/site_aidreamcapes/fan-holiday-theme/gallery/private-fan-scene-album-01.webp";
process.env.TUTORIAL_MASK_NAMES =
  process.env.AIDREAMCAPES_TUTORIAL_MASK_NAMES ||
  "Aria,Aria Stone,Aidreamcapes Demo,Nora Whitman,Nora,Mira,Lena,Rowan";
process.env.TUTORIAL_PROMPT_TEXT = `Create a 6-second image-to-video clip from the selected frame. Keep the adult subject, outfit, lighting, background, and color mood consistent. Add a slow cinematic push-in, subtle natural movement, gentle background glow, natural blinking, and a calm polished expression. No extra people, no logos, no watermark, no captions, no distorted hands, and no sudden scene changes. End on a steady close portrait frame.`;
process.env.TUTORIAL_NARRATION_JSON = JSON.stringify([
  { duration: 5, text: "First, sign in to your private Aidreamcapes workspace." },
  { duration: 5, text: "Open the Image to Video workspace from your account." },
  { duration: 7, text: "Click Upload, then choose a clean frame image from your computer." },
  { duration: 5, text: "Wait for the frame to finish uploading before you continue." },
  { duration: 5, text: "Select the uploaded image so the video follows this reference." },
  { duration: 9, text: "Paste clear motion instructions, then keep the video format at sixteen by nine, seven twenty p, and six seconds." },
  { duration: 5, text: "Click Generate video to submit the request through the active provider." },
  { duration: 6, text: "The request appears in Video results while the account tracks delivery." },
  { duration: 8, text: "Open the preview, press play, and review the finished video." }
]);
process.env.TUTORIAL_CAPTURE_DURATIONS_JSON = JSON.stringify({
  login: 5,
  workspace: 5,
  uploadChooser: 4,
  uploadSelected: 3,
  uploaded: 5,
  select: 5,
  prompt: 9,
  generate: 5,
  progress: 6,
  result: 8
});
process.env.TUTORIAL_CAPTIONS_JSON = JSON.stringify({
  login: "Sign in to your private Aidreamcapes workspace",
  workspace: "Open the Image to Video workspace",
  upload: "Click Upload and choose a frame image",
  uploaded: "Wait for the uploaded frame to appear",
  select: "Select the frame image to guide the video",
  prompt: "Paste the prompt and keep 16:9 / 720P / 6s",
  generate: "Click Generate video to submit",
  progress: "Track delivery in Video results",
  result: "Open preview and play the finished video"
});

await import("./record-mydreamshoots-i2v-tutorial.mjs");
