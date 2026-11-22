#!/usr/bin/env node
// Guides Text to Video: rewrite the tutorial around prompt writing.
//
// The site owner confirmed the Text to Video flow is prompt-first: there is no
// storyboard step. This replaces the storyboard/optimize copy with a prompt
// guide, uses the homepage Text to Video card as the hero, and uses the
// homepage moisturizer review clip as the example.
//
// Run from the current production release directory:
//   node scripts/apply-aidreamcapes-guides-t2v-prompt-guide.mjs
//   node scripts/apply-aidreamcapes-guides-t2v-prompt-guide.mjs --apply-production \
//     --confirm=guides-t2v-prompt-guide
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { loadRuntimeEnv } from "./load-runtime-env.mjs";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

loadRuntimeEnv();
const applying = process.argv.includes("--apply-production");
const confirmed = process.argv.includes("--confirm=guides-t2v-prompt-guide");
assertDatabaseTarget({
  expectedTarget: "production",
  requireProductionConfirmation: applying,
  productionConfirmed: applying && confirmed
});

const SITE_ID = "site_aidreamcapes";
const SLUGS = ["/guides/how-do-text-to-video", "/guides"];

const stable = (value) => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
    : value;
const hash = (value) => crypto.createHash("sha256")
  .update(value === undefined ? "<undefined>" : JSON.stringify(stable(value)))
  .digest("hex");

const edits = [];
const record = (slug, fieldPath, before, after) => {
  edits.push({ slug, path: fieldPath, beforeHash: hash(before), afterHash: hash(after) });
};

const H1 = "Text to Video: How to Write a Prompt That Produces the Clip You Want";
const LEAD = "A clear prompt names the product, the scene, the action, and the look. This tutorial shows how to write one, then generate and review the clip.";
const DESCRIPTION = "Learn how to write a Text to Video prompt: name the product, setting, action, camera, look, and length, then generate and review the clip.";
const OG_IMAGE = "/ai-image-generation/text-to-video-home-card.webp";
const OG_ALT = "Homepage Text to Video card with a prompt, creation controls, and a motion preview.";
const HERO = {
  alt: "Homepage Text to Video card with a prompt, creation controls, and a motion preview.",
  src: OG_IMAGE,
  width: 1386,
  height: 888
};

const INTRO = [
  "Text to Video turns one written prompt into a short video. You do not need a product photo or a storyboard — the prompt is the input. Use it when you have an idea and want to start from words. If you want to build from product photos, compare it with [AI Video](/guides/how-do-ai-video); if you are starting from a public listing, use [URL to Video](/guides/how-do-url-to-video).",
  "The example below uses a 15-second moisturizer review prompt. The clip shows the kind of result a clear prompt can produce.",
  "You can draft without an account. Sign up when you're ready to generate — creating an account is free, and credits are only spent when you confirm a generation. A 15-second clip typically costs about 30 credits and takes 3–5 minutes to generate. The exact estimate is shown before you confirm."
];

const DEMO = {
  title: "One prompt → one clip",
  lead: "The prompt names the product, the format, and the length. The clip shows a presenter reviewing a moisturizer; play it to see the result.",
  panel: {
    tabs: ["Text to Video", "AI Video", "AI Image"],
    activeTab: 0,
    input: "Give this moisturizer a 15-second review.",
    chips: ["Product", "Presenter", "9:16", "15s"]
  },
  result: {
    frames: [
      {
        tag: "Example clip · 15-second moisturizer review",
        video: {
          src: "/ai-video-generation/bathroom-review-moisturizer-p10.mp4",
          poster: "/assets/sites/site_aidreamcapes/v2-responsive/ai-image-generation/bathroom-review-moisturizer-ref--640.webp"
        }
      }
    ],
    prompt: "What made this prompt work: it named the product, the format (a review), and the length (15 seconds). Add the setting, the camera, and the look only when the result needs them."
  }
};

const SECTIONS = [
  {
    h2: "What a good Text to Video prompt includes",
    paras: ["You do not need a storyboard. Write one clear paragraph and add detail only where the result needs it."],
    bullets: [
      "**Product:** what it is, plus the color, material, or packaging details that must stay accurate.",
      "**Setting:** where the clip happens — a bathroom counter, a kitchen table, or a plain studio background.",
      "**Action:** one visible thing that happens — a presenter holds the product up, opens the lid, or pours it.",
      "**Camera:** how the shot is framed — close-up, medium shot, handheld phone framing, or a slow push-in.",
      "**Look:** natural light, soft shadows, a clean background, and realistic product texture.",
      "**Format and length:** 9:16 vertical and 15 seconds (or the format and length you choose in the workspace)."
    ]
  },
  {
    h2: "Weak prompt vs strong prompt",
    cards: [
      { tag: "Weak", title: "Too vague", body: "Make a video of my moisturizer." },
      { tag: "Strong", title: "Clear and specific", body: "A 15-second vertical review of a light-blue moisturizer jar. A presenter holds the jar beside their face in a bright bathroom, turns it to show the label, then opens the lid. Natural light, handheld phone framing, no on-screen text." }
    ]
  },
  {
    h2: "Keep the prompt easy to follow",
    bullets: [
      "Put the product first, then the setting, then the action.",
      "Keep one main action per clip; split a longer idea into two clips.",
      "Use plain descriptions, not brand claims you cannot verify.",
      "If the result drifts, shorten the prompt before adding more detail."
    ]
  }
];

const STEPS = [
  {
    title: "Open Text to Video",
    body: "Go straight to [Text to Video](/app/create/text-to-video). If the workspace asks you to sign in, return to this tool after signing in."
  },
  {
    title: "Name the product and the action",
    body: "Start with the product and one visible thing that happens. For this example: “A presenter holds a light-blue moisturizer jar beside their face and turns it to show the label.”"
  },
  {
    title: "Add the setting and the look",
    body: "Say where the clip happens and how it should look. For this example: “In a bright bathroom, natural light, handheld phone framing.”"
  },
  {
    title: "Choose the format and length",
    body: "Use the workspace controls to set 9:16 and 15 seconds (or the format and length you need). The same prompt can produce a different result at a different length."
  },
  {
    title: "Review the estimate and generate",
    body: "Check the model, format, length, and credit estimate shown by the workspace. Start the job only after the estimate is visible."
  },
  {
    title: "Play the clip and compare it with the prompt",
    body: "Check the product, the action, and the look. If something drifts, shorten the prompt to one product and one action, then generate another version."
  }
];

const CHECKLIST = [
  "The prompt names the product and one visible action.",
  "The prompt states the setting, format, and length.",
  "Every product detail is visible in the product or verified by you.",
  "The generated clip matches the product and the action.",
  "The downloaded file plays with the expected audio and captions."
];

const FAQ = [
  {
    q: "Do I need a product photo?",
    a: "No. Text to Video starts from a written prompt. Describe the product in words and review the result."
  },
  {
    q: "How long should the prompt be?",
    a: "One short paragraph is enough. Start with the product, setting, and action; add camera and look details only if the result needs them."
  },
  {
    q: "Can I change the prompt after generating?",
    a: "Yes. Edit the prompt and generate another version; keep the clip you approve."
  },
  {
    q: "Why did the clip ignore part of my prompt?",
    a: "Long prompts with several actions are harder to follow. Keep one main action, shorten the sentence, and generate again."
  }
];

const STEPS_INTRO = {
  title: "From one prompt to one clip",
  lead: "Write the prompt, choose the format and length, then review the estimate before generation."
};

const TIP = {
  title: "If the clip drifts",
  body: "Shorten the prompt to one product and one action. Keep the details that must stay accurate, remove the rest, and generate another version. Check the estimate before each paid generation."
};

const CTA = {
  href: "/app/create/text-to-video",
  title: "Open Text to Video",
  lead: "Write a prompt, choose the format and length, and review the estimate before you generate."
};

const META = ["Short prompt", "Prompt-first workflow", "Estimate before generation"];

function editTextToVideo(howto, seo) {
  assert.equal(howto.h1, "Text to Video: Build an Editable Storyboard from a Short Brief", "text-to-video h1 drifted");
  assert.equal(howto.image.src, "/assets/sites/site_aidreamcapes/guides/li-ch02-home-composer.webp", "text-to-video hero drifted");

  record("/guides/how-do-text-to-video", "howto/h1", howto.h1, H1);
  howto.h1 = H1;
  record("/guides/how-do-text-to-video", "howto/lead", howto.lead, LEAD);
  howto.lead = LEAD;
  record("/guides/how-do-text-to-video", "howto/image", howto.image, HERO);
  howto.image = structuredClone(HERO);
  record("/guides/how-do-text-to-video", "howto/intro", howto.intro, INTRO);
  howto.intro = [...INTRO];
  record("/guides/how-do-text-to-video", "howto/demo", howto.demo, DEMO);
  howto.demo = structuredClone(DEMO);
  record("/guides/how-do-text-to-video", "howto/sections", howto.sections, SECTIONS);
  howto.sections = structuredClone(SECTIONS);
  record("/guides/how-do-text-to-video", "howto/steps", howto.steps, STEPS);
  howto.steps = structuredClone(STEPS);
  record("/guides/how-do-text-to-video", "howto/stepsIntro", howto.stepsIntro, STEPS_INTRO);
  howto.stepsIntro = structuredClone(STEPS_INTRO);
  record("/guides/how-do-text-to-video", "howto/tip", howto.tip, TIP);
  howto.tip = structuredClone(TIP);
  record("/guides/how-do-text-to-video", "howto/checklist", howto.checklist, CHECKLIST);
  howto.checklist = [...CHECKLIST];
  record("/guides/how-do-text-to-video", "howto/faq", howto.faq, FAQ);
  howto.faq = structuredClone(FAQ);
  record("/guides/how-do-text-to-video", "howto/meta", howto.meta, META);
  howto.meta = [...META];
  record("/guides/how-do-text-to-video", "howto/cta", howto.cta, CTA);
  howto.cta = structuredClone(CTA);

  record("/guides/how-do-text-to-video", "seo/title", seo.title, "Text to Video: How to Write a Prompt That Works | AIVideosUGC");
  seo.title = "Text to Video: How to Write a Prompt That Works | AIVideosUGC";
  record("/guides/how-do-text-to-video", "seo/description", seo.description, DESCRIPTION);
  seo.description = DESCRIPTION;
  record("/guides/how-do-text-to-video", "seo/keywords", seo.keywords, "text to video prompt, ai video prompt, how to write a text to video prompt, product video prompt");
  seo.keywords = "text to video prompt, ai video prompt, how to write a text to video prompt, product video prompt";
  record("/guides/how-do-text-to-video", "seo/primaryKeyword", seo.primaryKeyword, "text to video prompt");
  seo.primaryKeyword = "text to video prompt";
  record("/guides/how-do-text-to-video", "seo/ogImage", seo.ogImage, OG_IMAGE);
  seo.ogImage = OG_IMAGE;
  record("/guides/how-do-text-to-video", "seo/ogImageAlt", seo.ogImageAlt, OG_ALT);
  seo.ogImageAlt = OG_ALT;
  record("/guides/how-do-text-to-video", "seo/twitterDescription", seo.twitterDescription, "Write one clear prompt, choose the format and length, then generate and review the clip.");
  seo.twitterDescription = "Write one clear prompt, choose the format and length, then generate and review the clip.";

  const article = seo.jsonLd["@graph"].find((node) => node["@type"] === "Article");
  assert.ok(article, "text-to-video Article JSON-LD missing");
  record("/guides/how-do-text-to-video", "seo/jsonLd/Article/headline", article.headline, H1);
  article.headline = H1;
  record("/guides/how-do-text-to-video", "seo/jsonLd/Article/description", article.description, LEAD);
  article.description = LEAD;

  const howTo = seo.jsonLd["@graph"].find((node) => node["@type"] === "HowTo");
  assert.ok(howTo, "text-to-video HowTo JSON-LD missing");
  const howToSteps = STEPS.map((step) => ({ name: step.title, text: step.body, "@type": "HowToStep" }));
  record("/guides/how-do-text-to-video", "seo/jsonLd/HowTo", howTo, {
    ...howTo,
    name: H1,
    step: howToSteps,
    image: { url: `https://www.aivideosugc.com${OG_IMAGE}`, "@type": "ImageObject", caption: OG_ALT },
    description: LEAD
  });
  howTo.name = H1;
  howTo.step = howToSteps;
  howTo.image = { url: `https://www.aivideosugc.com${OG_IMAGE}`, "@type": "ImageObject", caption: OG_ALT };
  howTo.description = LEAD;

  const faqNode = seo.jsonLd["@graph"].find((node) => node["@type"] === "FAQPage");
  assert.ok(faqNode, "text-to-video FAQPage JSON-LD missing");
  const faqEntities = FAQ.map((item) => ({
    name: item.q,
    "@type": "Question",
    acceptedAnswer: { text: item.a, "@type": "Answer" }
  }));
  record("/guides/how-do-text-to-video", "seo/jsonLd/FAQPage/mainEntity", faqNode.mainEntity, faqEntities);
  faqNode.mainEntity = faqEntities;
}

function editHub(hub) {
  const item = hub.howTos.items.find((entry) => entry.href === "/guides/how-do-text-to-video");
  assert.ok(item, "hub Text to Video card missing");
  record("/guides", `hub/howTos/${hub.howTos.items.indexOf(item)}`, item, {
    ...item,
    title: "Write a prompt that produces the clip you want",
    body: "Name the product, setting, action, and look, then generate and review the clip.",
    image: { alt: "Homepage Text to Video card with a prompt, creation controls, and a motion preview.", src: OG_IMAGE, width: 1386, height: 888 }
  });
  item.title = "Write a prompt that produces the clip you want";
  item.body = "Name the product, setting, action, and look, then generate and review the clip.";
  item.image = { alt: OG_ALT, src: OG_IMAGE, width: 1386, height: 888 };
}

const db = new PrismaClient();
try {
  const rows = await db.livePage.findMany({
    where: { siteId: SITE_ID, slug: { in: SLUGS } },
    orderBy: { slug: "asc" }
  });
  assert.equal(rows.length, SLUGS.length, `expected ${SLUGS.length} rows, found ${rows.length}`);

  const nextById = new Map();
  for (const row of rows) {
    const next = structuredClone(row.contentJson);
    const data = next.sections.v2_main.settings.data;
    if (row.slug === "/guides/how-do-text-to-video") editTextToVideo(data.howto, next.seo);
    else if (row.slug === "/guides") editHub(data.hub);
    nextById.set(row.id, next);
  }

  const manifestDoc = {
    siteId: SITE_ID,
    generatedAt: new Date().toISOString(),
    applying,
    editCount: edits.length,
    pages: SLUGS,
    edits
  };
  const manifestDir = process.env.MANIFEST_DIR
    ? path.resolve(process.env.MANIFEST_DIR)
    : path.join(process.cwd(), "scripts", "manifests");
  fs.mkdirSync(manifestDir, { recursive: true });
  const manifestPath = path.join(
    manifestDir,
    `aidreamcapes-guides-t2v-prompt-guide-${new Date().toISOString().slice(0, 10)}.json`
  );
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifestDoc, null, 2)}\n`);

  if (!applying) {
    console.log(JSON.stringify({ pages: SLUGS, editCount: edits.length, manifestPath }, null, 2));
    console.error(`dry run: ${edits.length} field edit(s) across ${SLUGS.length} page(s); manifest written to ${manifestPath}`);
    process.exit(0);
  }

  const otherBefore = hash(await db.livePage.findMany({
    where: { siteId: { not: SITE_ID } },
    orderBy: { id: "asc" },
    select: { id: true, contentJson: true }
  }));
  let applied = 0;
  for (const row of rows) {
    const next = nextById.get(row.id);
    const result = await db.livePage.updateMany({
      where: { siteId: SITE_ID, id: row.id, updatedAt: row.updatedAt },
      data: { contentJson: next }
    });
    assert.equal(result.count, 1, `${row.slug}: compare-and-set failed (the row changed after the manifest was read)`);
    const readback = await db.livePage.findFirstOrThrow({ where: { siteId: SITE_ID, id: row.id } });
    assert.equal(hash(readback.contentJson), hash(next), `${row.slug}: readback does not match the manifest`);
    applied += 1;
  }
  const otherAfter = hash(await db.livePage.findMany({
    where: { siteId: { not: SITE_ID } },
    orderBy: { id: "asc" },
    select: { id: true, contentJson: true }
  }));
  assert.equal(otherBefore, otherAfter, "a row outside site_aidreamcapes changed during the apply");

  console.log(JSON.stringify({ applied, editCount: edits.length, manifestPath }, null, 2));
} finally {
  await db.$disconnect();
}
