#!/usr/bin/env node
import "./load-runtime-env.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";

const SITE_ID = "site_aidreamcapes_xby";
const PROVIDER_LABEL = "buming-image";
const MODEL = "gpt-image-2";
const REQUEST_SIZE = "1536x1024";
const QUALITY = "high";
const TARGET_WIDTH = 3840;
const TARGET_HEIGHT = 2160;
const PRICE_PER_REQUEST_USD = 0.0075;
const MAX_PAID_CREATE_ATTEMPTS = 11;
const PUBLIC_BASE = "/assets/sites/site_aidreamcapes_eu/mirror/aidreamcapes/dreamshoot/save-the-date/valentines-day-4k-vendor-v1";
const LOCAL_BASE = path.resolve("public", PUBLIC_BASE.slice(1));
const REPORT_PATH = path.join(LOCAL_BASE, "_provider-results", "vendor-gpt-image-2-run.json");
const DRY_RUN = process.argv.includes("--dry-run");
const APPLY = process.argv.includes("--apply");

const tasks = [
  {
    filename: "hero-valentines-day-save-the-date-city-couple.jpg",
    prompt: `
Scene: blue hour on a European waterfront promenade, distant city lights reflected in calm water, warm restaurant windows and soft red accents in the background.
Subject: an original fictional adult engaged couple in elegant eveningwear, the man in a black tuxedo and the woman in a deep red satin dress, standing close together and looking at each other with quiet affection, positioned in the right third of the wide frame.
Important Details: cinematic natural-light editorial photography, cool navy shadows balanced by warm amber lights and deep crimson details, subtle Valentine atmosphere, shallow depth of field, realistic skin texture and hands, generous clean negative space on the left for a save-the-date headline overlay, premium wedding announcement mood.
Use Case: wide hero photograph for a Valentine's Day save-the-date video landing page.
Constraints: original fictional adults only; no readable text, signage, logos, watermarks, UI, borders, collage, duplicated people, distorted anatomy, or extra limbs. Keep the left third visually calm and uncluttered.`,
  },
  {
    filename: "hero-valentines-day-save-the-date-couple-candlelight.jpg",
    prompt: `
Scene: intimate upscale restaurant dinner on Valentine's Day, a dark wood table with glowing votive candles and a low arrangement of red roses, softly blurred amber lights behind the couple.
Subject: an original fictional adult engaged couple sharing a tender close moment at the table, the man in a black dinner jacket and the woman in an elegant red satin dress, framed as a warm medium-wide portrait.
Important Details: candlelight catching glassware and rose petals, rich burgundy, ruby, cream, and honey palette, believable romantic eye contact, natural skin texture, realistic hands, gentle cinematic contrast, editorial wedding keepsake photography.
Use Case: story image for a Valentine's Day save-the-date video theme.
Constraints: no readable menu text, signage, logos, watermarks, UI, border, collage, duplicated subjects, distorted anatomy, or extra limbs; keep the image tasteful and suitable for a wedding announcement.`,
  },
  {
    filename: "hero-valentines-day-save-the-date-proposal.jpg",
    prompt: `
Scene: rose garden pathway at blue hour, climbing red roses and warm string lights framing a small outdoor proposal setting, lanterns glowing along the path.
Subject: an original fictional adult man kneeling to offer a ring to an adult woman in an elegant floor-length red dress; she reacts with joyful surprise, both faces visible and emotionally natural.
Important Details: romantic Valentine palette of crimson roses, soft blush highlights, warm gold practical lights, realistic ring scale, natural hands and posture, cinematic medium-wide composition with the couple centered on the path and room around them.
Use Case: proposal moment for a Valentine's Day save-the-date video story.
Constraints: no readable text, signage, logos, watermarks, UI, collage, duplicated people, distorted anatomy, or extra limbs; original fictional adults only; keep the proposal ring small and physically believable.`,
  },
  {
    filename: "valentines-day-save-the-date-beach-couple.jpg",
    prompt: `
Scene: quiet European beach at sunset, long shoreline, pastel peach sky fading into rose and violet, gentle waves and smooth wet sand.
Subject: an original fictional adult engaged couple embracing near the waterline, dressed in refined neutral evening-casual clothing with a small red accent, facing each other with relaxed affection.
Important Details: wide cinematic composition, warm sunset rim light, soft reflection in wet sand, natural wind in fabric and hair, restrained Valentine mood, realistic skin texture and hands, clean horizon, editorial wedding keepsake photography.
Use Case: romantic beach frame for a Valentine's Day save-the-date announcement video.
Constraints: no readable text, signage, logos, watermarks, UI, collage, duplicated subjects, distorted anatomy, or extra limbs; keep the beach quiet and the couple clearly the focal point.`,
  },
  {
    filename: "valentines-day-save-the-date-candlelight-dinner.jpg",
    prompt: `
Scene: elegant candlelit dinner table for two on Valentine's Day, dark burgundy tablecloth, cream taper candles, red roses, crystal glasses, and a softly glowing restaurant interior.
Subject: an original fictional adult engaged couple raising champagne glasses in a gentle toast, both seated and smiling naturally across the table, framed from a slightly elevated eye-level angle.
Important Details: champagne bubbles, candle reflections in glass, tactile satin and linen, deep red and warm amber palette, subtle background bokeh, realistic hands and glass proportions, polished editorial photograph with a clear central toast.
Use Case: detail image for a Valentine's Day save-the-date video landing page.
Constraints: no readable menu text, signage, logos, watermarks, UI, border, collage, duplicated subjects, distorted anatomy, or extra limbs; the scene must remain romantic and wedding-appropriate.`,
  },
  {
    filename: "valentines-day-save-the-date-celebration-hug.jpg",
    prompt: `
Scene: romantic garden terrace at dusk with warm fairy lights overhead, lanterns along the ground, rose petals on a stone path, and soft evening foliage.
Subject: an original fictional adult couple celebrating their engagement by embracing warmly, joyful but natural expressions, elegant eveningwear with a red and charcoal palette.
Important Details: warm gold practical lights, deep green shadows, crimson rose petals, gentle motion in fabric, realistic skin texture and hands, balanced medium-wide framing, emotionally candid wedding keepsake photography.
Use Case: celebration frame for a Valentine's Day save-the-date video story.
Constraints: no readable text, signage, logos, watermarks, UI, collage, duplicated subjects, distorted anatomy, or extra limbs; use original fictional adults and a tasteful romantic pose.`,
  },
  {
    filename: "valentines-day-save-the-date-couple-planning.jpg",
    prompt: `
Scene: warm home planning table on Valentine's Day, cream paper stationery, a single red rose, soft lamp light, and an open laptop with an abstract blank preview screen.
Subject: an original fictional adult engaged couple reviewing wedding plans together, seated side by side and leaning toward the laptop with collaborative smiles, casual refined clothing in cream, burgundy, and charcoal.
Important Details: overhead three-quarter composition, tactile paper and linen, a small champagne glass and rose nearby, believable laptop reflections, cozy amber light with soft burgundy shadows, realistic hands and faces, editorial lifestyle photography.
Use Case: planning step image for a Valentine's Day save-the-date video landing page.
Constraints: laptop screen contains only soft abstract color shapes with zero readable text; no logos, watermarks, UI controls, collage, duplicated people, distorted anatomy, or extra limbs.`,
  },
  {
    filename: "valentines-day-save-the-date-beach-walk.jpg",
    prompt: `
Scene: quiet beach at late sunset, smooth sand and shallow shoreline reflecting a peach, rose, and lavender sky.
Subject: an original fictional adult couple walking hand in hand along the water, seen in a natural three-quarter rear view with enough profile to show affection; a simple heart is drawn physically in the sand beside their path.
Important Details: wide airy composition, footprints leading toward the couple, subtle red scarf accent, soft backlight, gentle wave texture, romantic Valentine symbolism that feels physical and believable, premium editorial wedding keepsake photography.
Use Case: story transition image for a Valentine's Day save-the-date video.
Constraints: the heart is only a real shape in the sand, with no letters or words; no readable text, signage, logos, watermarks, UI, collage, duplicated people, distorted anatomy, or extra limbs.`,
  },
  {
    filename: "valentines-day-save-the-date-heart-bokeh-couple.jpg",
    prompt: `
Scene: elegant evening terrace after sunset, city lights far behind, a few out-of-focus heart-shaped practical lights glowing softly in red and blush bokeh.
Subject: an original fictional adult engaged couple in formal eveningwear standing close together, the man in a dark suit and the woman in a deep red dress, looking toward one another in a calm portrait.
Important Details: medium-wide portrait, heart bokeh remains secondary and softly blurred, cool blue ambient shadows with warm red highlights, natural skin texture and hands, refined cinematic color grade, clear faces, polished wedding editorial mood.
Use Case: romantic portrait image for a Valentine's Day save-the-date announcement.
Constraints: heart shapes appear only as subtle background bokeh; no readable text, signage, logos, watermarks, UI, border, collage, duplicated subjects, distorted anatomy, or extra limbs.`,
  },
  {
    filename: "valentines-day-save-the-date-invitation-envelope.jpg",
    prompt: `
Scene: softly lit wedding stationery table with cream paper, red rose petals, a small candle, and warm neutral background tones.
Subject: an original fictional adult couple holding a closed cream envelope together, the envelope sealed with one simple red heart wax seal; their hands and faces are both visible in a natural over-the-shoulder lifestyle composition.
Important Details: tactile paper fibers, satin sleeves, warm side light, shallow depth of field, restrained burgundy and ivory palette, the envelope angled toward camera, realistic fingers and seal texture, premium Valentine's Day save-the-date editorial photography.
Use Case: invitation detail image for a Valentine's Day save-the-date video landing page.
Constraints: envelope has no writing or printed marks; no readable text, logos, watermarks, UI, collage, duplicated people, distorted anatomy, or extra limbs.`,
  },
  {
    filename: "valentines-day-save-the-date-rose-garden-couple.jpg",
    prompt: `
Scene: rose garden pathway at early evening, red and blush roses on both sides, low lanterns and warm string lights guiding the path, calm blue sky beyond.
Subject: an original fictional adult couple walking together beside the roses, dressed in elegant wedding-announcement eveningwear, sharing a gentle glance while moving naturally through the garden.
Important Details: wide closing-frame composition with breathing room on the left, warm lantern glow against cool twilight, rose petals and leafy texture, believable proportions and hands, cinematic depth, rich crimson, blush, cream, and midnight-blue palette.
Use Case: closing image for a Valentine's Day save-the-date video story.
Constraints: no readable text, signage, logos, watermarks, UI, collage, duplicated people, distorted anatomy, or extra limbs; original fictional adults only; preserve a calm open area on the left for optional overlay copy.`,
  }
];

function imageBase64(body) {
  return body?.data?.[0]?.b64_json ?? body?.data?.[0]?.image_base64 ?? body?.output?.[0]?.b64_json ?? body?.output?.[0]?.image_base64 ?? body?.image_base64;
}

function imageUrl(body) {
  return body?.data?.[0]?.url ?? body?.data?.[0]?.image_url ?? body?.output?.[0]?.url ?? body?.output?.[0]?.image_url ?? body?.output?.image_url ?? body?.url ?? body?.image_url;
}

function providerBaseUrl(value) {
  const base = String(value ?? "").trim().replace(/\/+$/, "");
  return base.endsWith("/v1") ? base : `${base}/v1`;
}

async function responseImageBuffer(body) {
  const base64 = imageBase64(body);
  if (base64) return Buffer.from(base64, "base64");
  const url = imageUrl(body);
  if (!url) throw new Error("provider_response_missing_image");
  const response = await fetch(String(url));
  if (!response.ok) throw new Error(`provider_image_download_failed:${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function write4kJpeg(buffer, outputPath) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await sharp(buffer)
    .rotate()
    .resize(TARGET_WIDTH, TARGET_HEIGHT, { fit: "cover", position: "centre" })
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4", mozjpeg: true })
    .toFile(outputPath);
}

async function writeReport(report) {
  await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
}

if (!DRY_RUN && !APPLY) {
  throw new Error("paid_generation_requires_--apply");
}

const plan = {
  siteId: SITE_ID,
  providerLabel: PROVIDER_LABEL,
  model: MODEL,
  endpoint: "/v1/images/generations",
  method: "POST",
  requestSize: REQUEST_SIZE,
  outputSize: `${TARGET_WIDTH}x${TARGET_HEIGHT}`,
  quality: QUALITY,
  maxPaidCreateAttempts: MAX_PAID_CREATE_ATTEMPTS,
  estimatedMaxCostUsd: Number((MAX_PAID_CREATE_ATTEMPTS * PRICE_PER_REQUEST_USD).toFixed(4)),
  attempts: []
};

if (DRY_RUN) {
  console.log(JSON.stringify({ ...plan, dryRun: true, files: tasks.map((task) => task.filename) }, null, 2));
  process.exit(0);
}

const existing = [];
for (const task of tasks) {
  const outputPath = path.join(LOCAL_BASE, task.filename);
  try {
    const stat = await fs.stat(outputPath);
    if (stat.isFile() && stat.size > 0) existing.push(task.filename);
  } catch {
    // Expected for a fresh vendor run.
  }
}
if (existing.length) throw new Error(`refusing_to_overwrite_existing_vendor_assets:${existing.join(",")}`);

const prisma = new PrismaClient();
let paidAttempts = 0;
try {
  const provider = await prisma.platformAiProvider.findFirst({
    where: { label: PROVIDER_LABEL, modelType: MODEL, providerType: "image", enabled: true },
    select: { label: true, aiUrl: true, apiKey: true }
  });
  if (!provider?.apiKey || !provider.aiUrl) throw new Error("configured_vendor_provider_missing_api_credentials");
  const baseUrl = providerBaseUrl(provider.aiUrl);
  console.log(`paid provider plan: POST ${baseUrl}/images/generations model=${MODEL} quality=${QUALITY} requestSize=${REQUEST_SIZE} outputSize=${TARGET_WIDTH}x${TARGET_HEIGHT} maxPaidCreateAttempts=${MAX_PAID_CREATE_ATTEMPTS} attemptsPerImage=1 stopOnFirstError=true`);
  console.log(`using vendor API provider: ${provider.label}`);

  for (const task of tasks) {
    if (paidAttempts >= MAX_PAID_CREATE_ATTEMPTS) throw new Error("paid_create_cap_reached");
    paidAttempts += 1;
    const requestId = `aidreamcapes:${SITE_ID}:valentines-vendor-v1:${task.filename}`;
    console.log(`generating vendor asset ${paidAttempts}/${MAX_PAID_CREATE_ATTEMPTS}: ${task.filename}`);
    const response = await fetch(`${baseUrl}/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
        "Idempotency-Key": requestId
      },
      body: JSON.stringify({
        model: MODEL,
        prompt: task.prompt.trim(),
        size: REQUEST_SIZE,
        quality: QUALITY,
        n: 1,
        response_format: "b64_json"
      })
    });
    const body = await response.json().catch(() => ({}));
    const attempt = {
      filename: task.filename,
      requestId,
      providerRequestId: response.headers.get("x-request-id") ?? response.headers.get("request-id") ?? "",
      status: response.status,
      ok: response.ok,
      providerTaskId: body?.id ?? body?.task_id ?? body?.data?.[0]?.id ?? "",
      usage: body?.usage ?? undefined,
      createdAt: new Date().toISOString()
    };
    plan.attempts.push(attempt);
    await writeReport(plan);
    if (!response.ok) throw new Error(`${task.filename}:provider_create_failed:${response.status}`);
    const sourceBuffer = await responseImageBuffer(body);
    const outputPath = path.join(LOCAL_BASE, task.filename);
    await write4kJpeg(sourceBuffer, outputPath);
    const metadata = await sharp(outputPath).metadata();
    if (metadata.width !== TARGET_WIDTH || metadata.height !== TARGET_HEIGHT) {
      throw new Error(`${task.filename}:unexpected_output_dimensions:${metadata.width}x${metadata.height}`);
    }
    console.log(`generated vendor asset: ${PUBLIC_BASE}/${task.filename} -> ${TARGET_WIDTH}x${TARGET_HEIGHT}`);
    await writeReport(plan);
  }
  plan.completed = true;
  plan.paidCreateAttempts = paidAttempts;
  plan.actualMaxCostUsd = Number((paidAttempts * PRICE_PER_REQUEST_USD).toFixed(4));
  await writeReport(plan);
  console.log(JSON.stringify({ ok: true, completed: tasks.length, paidCreateAttempts: paidAttempts, estimatedMaxCostUsd: plan.estimatedMaxCostUsd, actualMaxCostUsd: plan.actualMaxCostUsd, reportPath: REPORT_PATH }, null, 2));
} catch (error) {
  plan.completed = false;
  plan.paidCreateAttempts = paidAttempts;
  plan.failure = error instanceof Error ? error.message : String(error);
  await writeReport(plan);
  throw error;
} finally {
  await prisma.$disconnect();
}
