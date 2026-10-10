import { isPrimaryMydreamshootsSlug } from "@/lib/storefront-context/capabilities";
import type { PlatformState } from "@/lib/types";

export type MydreamshootsTopicGroupKind = "image" | "video" | "save-the-date";

export type MydreamshootsTopicGroup = {
  id: string;
  kind: MydreamshootsTopicGroupKind;
  slug: string;
  path: string;
  parentPath: string;
  categorySlug: string;
  label: string;
  title: string;
  description: string;
  seoTitle: string;
  relatedGroupId: string;
};

export const MYDREAMSHOOTS_TOPIC_GROUPS: readonly MydreamshootsTopicGroup[] = [
  { id: "image-best-themes-presets", kind: "image", slug: "best-themes-presets", path: "/ai-image-generation/best-themes-presets", parentPath: "/ai-image-generation", categorySlug: "best-themes-presets", relatedGroupId: "image-lifestyle-creative", label: "Best Themes & Presets", title: "Seasonal AI Photo Themes & Presets", description: "Explore romantic portraits, holiday cards, and occasion-ready photo themes designed for personal keepsakes and sharing.", seoTitle: "Seasonal AI Photo Themes & Presets | myDreamshoots" },
  { id: "image-professional", kind: "image", slug: "professional", path: "/ai-image-generation/professional", parentPath: "/ai-image-generation", categorySlug: "professional", relatedGroupId: "image-photo-tools", label: "Professional", title: "Professional AI Headshots & Profile Photos", description: "Browse polished headshots, profile portraits, and creator-ready images for work profiles, bios, and social presence.", seoTitle: "Professional AI Headshots & Profile Photos | myDreamshoots" },
  { id: "image-lifestyle-creative", kind: "image", slug: "lifestyle-creative", path: "/ai-image-generation/lifestyle-creative", parentPath: "/ai-image-generation", categorySlug: "lifestyle-creative", relatedGroupId: "image-best-themes-presets", label: "Lifestyle & Creative", title: "Lifestyle & Creative AI Photo Themes", description: "Find expressive photo themes for travel, fashion, nightlife, sport, and personal albums with a distinct visual mood.", seoTitle: "Lifestyle & Creative AI Photo Themes | myDreamshoots" },
  { id: "image-magic", kind: "image", slug: "magic", path: "/ai-image-generation/magic", parentPath: "/ai-image-generation", categorySlug: "magic", relatedGroupId: "image-photo-tools", label: "Magic", title: "AI Photo Transformations & Try-On Themes", description: "Explore hairstyle previews, virtual try-on looks, and creative photo transformations made from images you choose.", seoTitle: "AI Photo Transformations & Try-On Themes | myDreamshoots" },
  { id: "image-photo-tools", kind: "image", slug: "photo-tools", path: "/ai-image-generation/photo-tools", parentPath: "/ai-image-generation", categorySlug: "photo-tools", relatedGroupId: "image-magic", label: "Photo Tools", title: "AI Photo Editing & Enhancement Tools", description: "Browse practical tools for background changes, restoration, enhancement, retouching, and prompt-guided edits.", seoTitle: "AI Photo Editing & Enhancement Tools | myDreamshoots" },
  { id: "video-core-ai-creation", kind: "video", slug: "core-ai-creation", path: "/ai-video-generation/group/core-ai-creation", parentPath: "/ai-video-generation", categorySlug: "core-ai-creation", relatedGroupId: "video-creative-lifestyle", label: "Core AI Creation", title: "Core AI Video Creation Themes", description: "Compare foundational AI video workflows, from animating a photo to shaping a short clip from a text prompt.", seoTitle: "Core AI Video Creation Themes | myDreamshoots" },
  { id: "video-social-creator", kind: "video", slug: "social-creator", path: "/ai-video-generation/group/social-creator", parentPath: "/ai-video-generation", categorySlug: "social-creator", relatedGroupId: "video-creative-lifestyle", label: "Social & Creator", title: "Social Media & Creator Video Themes", description: "Explore video formats for short-form social posts, creator introductions, stories, and platform-specific publishing.", seoTitle: "Social Media & Creator Video Themes | myDreamshoots" },
  { id: "video-marketing-commerce", kind: "video", slug: "marketing-commerce", path: "/ai-video-generation/group/marketing-commerce", parentPath: "/ai-video-generation", categorySlug: "marketing-commerce", relatedGroupId: "video-professional-business", label: "Marketing & Commerce", title: "Marketing & Commerce Video Themes", description: "Browse product demonstrations, promotional concepts, and advertising formats built around a clear audience and message.", seoTitle: "Marketing & Commerce Video Themes | myDreamshoots" },
  { id: "video-creative-lifestyle", kind: "video", slug: "creative-lifestyle", path: "/ai-video-generation/group/creative-lifestyle", parentPath: "/ai-video-generation", categorySlug: "creative-lifestyle", relatedGroupId: "video-social-creator", label: "Creative & Lifestyle", title: "Creative & Lifestyle Video Themes", description: "Find motion ideas for travel, fashion, food, music, fitness, and other personal or expressive stories.", seoTitle: "Creative & Lifestyle Video Themes | myDreamshoots" },
  { id: "video-professional-business", kind: "video", slug: "professional-business", path: "/ai-video-generation/group/professional-business", parentPath: "/ai-video-generation", categorySlug: "professional-business", relatedGroupId: "video-marketing-commerce", label: "Professional & Business", title: "Professional & Business Video Themes", description: "Explore presenter, explainer, real estate, and business video formats for clear, useful communication.", seoTitle: "Professional & Business Video Themes | myDreamshoots" },
  { id: "video-save-the-date", kind: "video", slug: "save-the-date", path: "/ai-video-generation/group/save-the-date", parentPath: "/ai-video-generation", categorySlug: "save-the-date", relatedGroupId: "save-the-date-love-wedding", label: "Save the Date", title: "AI Save the Date Video Themes", description: "Explore wedding and seasonal announcement videos, with related ideas for invitations, celebrations, and keepsakes.", seoTitle: "AI Save the Date Video Themes | myDreamshoots" },
  { id: "save-the-date-love-wedding", kind: "save-the-date", slug: "love-wedding", path: "/best-save-the-date/group/love-wedding", parentPath: "/best-save-the-date", categorySlug: "love-wedding", relatedGroupId: "video-save-the-date", label: "Love & Wedding", title: "Love & Wedding Announcement Videos", description: "Explore engagement, proposal, wedding, and anniversary video ideas for sharing important moments with the people you love.", seoTitle: "Love & Wedding Announcement Videos | myDreamshoots" },
  { id: "save-the-date-seasonal-holidays", kind: "save-the-date", slug: "seasonal-holidays", path: "/best-save-the-date/group/seasonal-holidays", parentPath: "/best-save-the-date", categorySlug: "seasonal-holidays", relatedGroupId: "video-save-the-date", label: "Seasonal Holidays", title: "Seasonal Holiday Announcement Videos", description: "Browse seasonal video ideas for holiday greetings, family celebrations, and moments worth sharing throughout the year.", seoTitle: "Seasonal Holiday Announcement Videos | myDreamshoots" }
] as const;

export const MYDREAMSHOOTS_TOPIC_GROUP_PATHS = MYDREAMSHOOTS_TOPIC_GROUPS.map((group) => group.path);

const groupsByPath = new Map(MYDREAMSHOOTS_TOPIC_GROUPS.map((group) => [group.path, group]));
const imageGroupsBySlug = new Map(MYDREAMSHOOTS_TOPIC_GROUPS.filter((group) => group.kind === "image").map((group) => [group.slug, group]));

export function mydreamshootsTopicGroupForPath(path: string): MydreamshootsTopicGroup | undefined {
  const normalized = path.split(/[?#]/)[0]?.replace(/\/+$/, "") || "/";
  return groupsByPath.get(normalized);
}

export function mydreamshootsImageTopicGroupForSlug(slug: string): MydreamshootsTopicGroup | undefined {
  return imageGroupsBySlug.get(slug.trim().toLowerCase());
}

export function isMydreamshootsTopicGroupPath(path: string): boolean {
  return Boolean(mydreamshootsTopicGroupForPath(path));
}

export function isMydreamshootsTopicGroupActive(state: PlatformState, siteId: string, group: MydreamshootsTopicGroup): boolean {
  if (group.kind === "image") {
    return (state.creativePackCategories || []).some((category) =>
      category.siteId === siteId && category.slug === group.categorySlug && !category.parentId && category.status === "active"
    );
  }
  const categories = (state.videoThemeCategories || []).filter((category) => category.siteId === siteId && category.status === "active");
  if (group.kind === "video") {
    return categories.some((category) => category.slug === group.categorySlug && !category.parentId);
  }
  const root = categories.find((category) => category.slug === "save-the-date" && !category.parentId);
  return Boolean(root && categories.some((category) => category.parentId === root.id && category.slug === group.categorySlug));
}

export function isMydreamshootsVideoTopicGroupPathRequest(siteSlug: string, path: string[]): boolean {
  return isPrimaryMydreamshootsSlug(siteSlug) && path.length === 3 && path[0] === "ai-video-generation" && path[1] === "group";
}

export function isMydreamshootsSaveDateTopicGroupPathRequest(siteSlug: string, path: string[]): boolean {
  return isPrimaryMydreamshootsSlug(siteSlug) && path.length === 3 && path[0] === "best-save-the-date" && path[1] === "group";
}
