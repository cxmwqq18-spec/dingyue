import type { CreativePack } from "@/lib/types";

type CreativePackSuggestionInput = Pick<CreativePack, "name" | "headline" | "description" | "category" | "outputCount" | "trainingRequired">;

export const creativePackCategoryPromptDirections: Record<CreativePack["category"], string> = {
  headshots: "premium professional headshot photography, clean studio background, confident but natural expression, refined business wardrobe, LinkedIn and founder profile ready",
  couple: "romantic couple portrait photography, authentic connection, elegant poses, warm cinematic lighting, tasteful editorial romance",
  wedding: "wedding-inspired portrait session, ceremony elegance, refined formal styling, soft natural light, album-ready emotional storytelling",
  dating: "polished dating profile portraits, approachable expression, lifestyle environment, flattering natural light, authentic confidence",
  fashion: "high-fashion editorial photography, refined wardrobe styling, magazine composition, expressive pose, premium commercial lighting",
  beauty: "beauty and styling preview photography, polished hair, makeup and wardrobe direction, clean facial detail, soft flattering light",
  travel: "destination travel portrait photography, scenic location, aspirational lifestyle mood, natural movement, premium vacation editorial",
  seasonal: "seasonal themed portrait photography, tasteful festive styling, warm atmosphere, greeting-card ready composition",
  copy: "visual concept planning for creative copy, clean commercial composition, campaign moodboard energy, product-ready narrative cues",
  creative: "cinematic creative portrait photography, dramatic atmosphere, stylized scene design, bold editorial lighting, premium AI photo package look",
  sports: "sports fan editorial portrait, stadium energy, team-color styling, dynamic match-day atmosphere, social poster ready",
  creator: "creator personal brand portrait, modern lifestyle setting, social profile ready framing, clean commercial polish, newsletter and landing page use",
  avatar: "stylized avatar portrait concept, recognizable identity preservation, polished character direction, social profile icon readability",
  video: "motion-ready cinematic portrait frame, clear subject separation, dynamic composition, reel and short-video storyboard energy",
  utility: "clean AI photo utility preview, before-after friendly composition, sharp detail, neutral background, practical enhancement outcome",
  boudoir: "tasteful private portrait photography, elegant intimate studio mood, soft directional light, confident styling, non-explicit premium album delivery",
  cultural: "respectful cultural celebration portrait, rich textile detail, formal styling, warm ceremony atmosphere, album-ready editorial quality"
};

export const defaultCreativePackCoverByCategory: Record<CreativePack["category"], string> = {
  headshots: "/assets/dreamshoot/generated/20260618/headshot-lifestyle-v1.png",
  couple: "/assets/dreamshoot/generated/20260618/city-date-night-v1.png",
  wedding: "/assets/dreamshoot/frames/sample-wedding-trip.png",
  dating: "/assets/dreamshoot/generated/20260618/city-date-night-v1.png",
  fashion: "/assets/dreamshoot/editorial-headshot-gpt2.png",
  beauty: "/assets/dreamshoot/generated/20260618/hairstyle-preview-v1.png",
  travel: "/assets/dreamshoot/generated/20260618/cliffside-holiday-v1.png",
  seasonal: "/assets/dreamshoot/generated/20260619/christmas-solo-card-v1.png",
  copy: "/assets/dreamshoot/generated/20260618/upscaler-utility-v1.png",
  creative: "/assets/dreamshoot/generated/20260619/cyberpunk-solo-city-v1.png",
  sports: "/assets/dreamshoot/generated/20260621-worldcup-pack/stadium-portrait.png",
  creator: "/assets/dreamshoot/avatar-nora-gpt2.png",
  avatar: "/assets/dreamshoot/frames/story-beauty-portrait.png",
  video: "/assets/dreamshoot/editorial-headshot-gpt2.png",
  utility: "/assets/dreamshoot/generated/20260618/upscaler-utility-v1.png",
  boudoir: "/assets/dreamshoot/beauty-portrait-gpt2.png",
  cultural: "/assets/dreamshoot/frames/story-wedding-look.png"
};

export function suggestedCreativePackCover(pack: Pick<CreativePack, "category" | "name">) {
  const name = pack.name.toLowerCase();
  if (name.includes("virtual") || name.includes("try")) return "/assets/dreamshoot/frames/tab-virtual-looks.png";
  if (name.includes("world cup")) return "/assets/dreamshoot/generated/20260621-worldcup-pack/stadium-portrait.png";
  if (name.includes("cyberpunk")) return "/assets/dreamshoot/generated/20260619/cyberpunk-solo-city-v1.png";
  if (name.includes("gala")) return "/assets/dreamshoot/frames/sample-gala.png";
  if (name.includes("mafia") || name.includes("noir")) return "/assets/dreamshoot/generated/20260619/mafia-noir-single-v1.png";
  if (name.includes("hairstyle")) return "/assets/dreamshoot/generated/20260618/hairstyle-preview-v1.png";
  if (name.includes("christmas")) return "/assets/dreamshoot/generated/20260619/christmas-solo-card-v1.png";
  return defaultCreativePackCoverByCategory[pack.category];
}

export function suggestedCreativePackPrompt(pack: CreativePackSuggestionInput) {
  const title = pack.headline?.trim() || pack.name;
  return [
    `Theme: ${title}.`,
    `Purpose: ${pack.description}`,
    "Use the uploaded customer reference photos as visual anchors for broad subject, pose, color, styling, and composition cues without verifying or recreating a real person's identity.",
    `Visual direction: ${creativePackCategoryPromptDirections[pack.category]}.`,
    "Create one standalone image for one package slot. The package may contain multiple outputs, but each generated file must contain exactly one finished portrait image.",
    pack.trainingRequired
      ? "If a trained personal model is available, prioritize consistent styling from that model for this single output."
      : "If no trained model is available, use the uploaded references conservatively and keep the result broadly aligned with the source.",
    "Photography language: photorealistic editorial quality, clean lens rendering, natural skin texture, controlled highlights, believable shadows, high-end commercial finish.",
    "Composition requirements: subject remains the hero, no text overlays, no logos, no watermarks, no UI elements, no collage, no grid, no contact sheet, no split panels.",
    "Safety and quality constraints: avoid distorted hands, extra limbs, duplicated faces, melted accessories, overly plastic skin, explicit nudity, minors, medical claims, celebrity imitation, or brand-trademark misuse.",
    "Output should feel like a curated DreamShootAI paid package, ready for private gallery delivery and frontend package previews."
  ].join("\n");
}
