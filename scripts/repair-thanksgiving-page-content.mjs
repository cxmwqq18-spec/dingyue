#!/usr/bin/env node
import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";

const siteId = process.env.THANKSGIVING_SITE_ID || "site_dreamshoot";
const slug = "/ai-save-the-date/thanksgiving";
const prisma = new PrismaClient();

const image = (src, alt, loading = "lazy") => ({
  imageUrl: src,
  imageAlt: alt,
  imageWidth: 1600,
  imageHeight: 1000,
  imageLoading: loading,
  imageFetchPriority: loading === "eager" ? "high" : "auto"
});

const assets = {
  family: image("/assets/dreamshoot/seasonal/thanksgiving/hero-ai-thanksgiving-family-dinner.jpg", "Multigenerational family gathered around a Thanksgiving dinner table while carving turkey and sharing side dishes."),
  kids: image("/assets/dreamshoot/seasonal/thanksgiving/hero-ai-thanksgiving-kids-pumpkins.jpg", "Two smiling children holding pumpkins outdoors during golden-hour fall weather."),
  card: image("/assets/dreamshoot/seasonal/thanksgiving/hero-ai-thanksgiving-greeting-card.jpg", "Autumn Thanksgiving greeting card surrounded by pumpkins, candles, pinecones, and fall leaves on a rustic wooden table."),
  turkey: image("/assets/dreamshoot/seasonal/thanksgiving/ai-thanksgiving-turkey-feast.jpg", "Roasted Thanksgiving turkey surrounded by mashed potatoes, green beans, stuffing, pie, and candlelit autumn decor."),
  cooking: image("/assets/dreamshoot/seasonal/thanksgiving/ai-thanksgiving-family-cooking.jpg", "Family cooking together in a warm kitchen while preparing turkey, vegetables, pie, and holiday side dishes."),
  decor: image("/assets/dreamshoot/seasonal/thanksgiving/ai-thanksgiving-harvest-decor.jpg", "Harvest basket filled with pumpkins, gourds, corn, candles, and fall leaves against a rustic wooden background."),
  table: image("/assets/dreamshoot/seasonal/thanksgiving/ai-thanksgiving-table-photo.jpg", "Hand holding a smartphone to photograph a Thanksgiving table with turkey, pie, candles, and autumn decorations."),
  friends: image("/assets/dreamshoot/seasonal/thanksgiving/ai-thanksgiving-friendsgiving-toast.jpg", "Friends gathered around a holiday table raising wine glasses in a warm Friendsgiving toast."),
  home: image("/assets/dreamshoot/seasonal/thanksgiving/ai-thanksgiving-home-decor.jpg", "Cozy living room with fireplace, pumpkins, candles, pie, and autumn decorations for Thanksgiving season.")
};

const block = (id, type, settings) => ({ id, type, settings });
const paragraph = (id, text) => block(id, "paragraph", { text });
const faq = (id, question, answer) => block(id, "faq_item", { question, answer });

try {
  const page = await prisma.themePage.findUnique({ where: { siteId_slug: { siteId, slug } } });
  if (!page) throw new Error(`Theme page not found: ${siteId} ${slug}`);

  const current = page.draftJson || page.publishedJson;
  if (!current?.sections) throw new Error("Thanksgiving page JSON has no sections");
  const next = structuredClone(current);

  next.sections.thanksgiving_definition.blocks = [
    paragraph("thanksgiving-definition-1", "An AI Thanksgiving photo and video generator helps create Thanksgiving-specific visuals around gathering, gratitude, food, decor, and seasonal storytelling."),
    paragraph("thanksgiving-definition-2", "Use a clear family, Friendsgiving, food, or still-life direction, then review the result for believable details before sharing it in a greeting, social post, or private holiday album.")
  ];
  next.sections.thanksgiving_quality.intro = "Strong Thanksgiving visuals make the occasion immediately recognizable while keeping the people, food, and message easy to read.";
  next.sections.thanksgiving_quality.blocks = [
    block("thanksgiving-quality-do", "guidance_group", { title: "Do", items: ["Make the Thanksgiving context obvious.", "Use warm fall color and believable family or food moments.", "Match the visual to the intended use case."] }),
    block("thanksgiving-quality-avoid", "guidance_group", { title: "Avoid", items: ["Generic fall content with no Thanksgiving signal.", "Cluttered visuals with weak focal hierarchy.", "Overusing text inside the image."] })
  ];
  next.sections.thanksgiving_formats.intro = "Choose the visual direction and delivery format before the final edit so the important people, food, and message remain clear in every crop.";
  next.sections.thanksgiving_formats.blocks = [
    block("thanksgiving-format-photo", "format", { title: "Photo direction", text: "Use a focused family, food, decor, or greeting-card frame for posts, messages, and keepsake albums.", ...assets.card }),
    block("thanksgiving-format-video", "format", { title: "Video direction", text: "Sequence a few short beats such as preparation, gathering, and a final gratitude message for seasonal storytelling.", ...assets.cooking }),
    block("thanksgiving-format-social", "format", { title: "Social sharing", text: "Plan a readable vertical or square crop with the main subject away from interface edges before publishing.", ...assets.table })
  ];
  next.sections.thanksgiving_market.blocks = [
    paragraph("thanksgiving-market-1", "This package focuses on North American Thanksgiving patterns such as family dinners, Friendsgiving gatherings, pie, turkey, harvest decor, and late-fall seasonal storytelling."),
    paragraph("thanksgiving-market-2", "Use those cues as creative direction rather than proof of a real event, venue, recipe, or guest list. Keep greeting copy and factual details in an editable text layer.")
  ];
  next.sections.thanksgiving_faq.blocks = [
    faq("thanksgiving-faq-1", "What is an AI Thanksgiving photo and video generator?", "It is a workflow for creating Thanksgiving-themed photos and videos around family gatherings, Friendsgiving, food, decor, gratitude messages, and seasonal storytelling."),
    faq("thanksgiving-faq-2", "What Thanksgiving scenes work best?", "Family dinners, Friendsgiving toasts, food close-ups, greeting-card still lifes, cozy home scenes, and outdoor autumn moments all give the occasion a clear visual signal."),
    faq("thanksgiving-faq-3", "Can I create Thanksgiving content for social media?", "Yes. Choose a vertical or square crop when needed, keep important text editable, and review the final framing before sharing."),
    faq("thanksgiving-faq-4", "Can Thanksgiving decor work without people?", "Yes. Harvest decor, table settings, pumpkins, candles, and greeting still lifes can communicate Thanksgiving without a person in the frame."),
    faq("thanksgiving-faq-5", "Can I use Thanksgiving content for Friendsgiving too?", "Yes. Friendsgiving can use the same warm seasonal direction with a friend-group gathering, toast, shared meal, or casual home scene as the focal point.")
  ];
  next.contentContract = { ...next.contentContract, faqCount: 5 };
  next.version = Number(next.version || 0) + 1;

  await prisma.themePage.update({ where: { id: page.id }, data: { draftJson: next, publishedJson: next, title: next.sections[next.sectionsOrder[0]]?.settings?.title || page.title } });
  console.log(JSON.stringify({ ok: true, siteId, slug, version: next.version, sections: Object.fromEntries(Object.entries(next.sections).map(([id, section]) => [id, section.blocks?.length ?? 0])) }, null, 2));
} finally {
  await prisma.$disconnect();
}
