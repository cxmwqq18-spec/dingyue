import { Fragment } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Camera,
  CheckCircle2,
  Globe2,
  Heart,
  ImageIcon,
  Layers3,
  PackageOpen,
  PlayCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  Youtube
} from "lucide-react";
import { StorefrontInstantLink } from "@/components/storefront/storefront-instant-link";
import { cleanHost, hostAwareSitePath } from "@/lib/domain-routing";
import { isSpanishStorefrontSite } from "@/lib/spanish-storefronts";
import { themeValueToString } from "@/lib/theme-values";
import type { SectionBlockInstance, Site, ToolMenuItem } from "@/lib/types";

export type DreamShootToolsMenuSite = Pick<Site, "id" | "slug" | "name" | "branding" | "primaryDomain"> & {
  __storefrontBasePath?: string;
};

const aidreamcapesAccent = "#6D3DFF";
const aidreamcapesCopper = "#D88A4B";

const dreamshootStaticToolSlugByKey: Record<string, string> = {
  mega_tool_headshot: "headshot",
  "professional-headshot-maker": "headshot",
  "professional-headshots": "headshot",
  "headshot-photo-generator": "headshot",
  "headshot-generator": "headshot",
  mega_tool_creator: "creator-portrait",
  "creator-portrait-studio": "creator-portrait",
  "creator-portraits": "creator-portrait",
  mega_tool_worldcup: "world-cup-fan-photos",
  "world-cup-fan-photos": "world-cup-fan-photos",
  mega_tool_cyberpunk: "cyberpunk-portrait",
  "cyberpunk-portrait-maker": "cyberpunk-portrait",
  mega_tool_gala: "gala-photo",
  "gala-photo-maker": "gala-photo",
  mega_tool_noir: "noir-portrait",
  "noir-character-portraits": "noir-portrait",
  mega_tool_anime: "anime-avatar",
  "anime-avatar-builder": "anime-avatar",
  mega_tool_nature: "nature-adventure",
  "nature-adventure-photos": "nature-adventure",
  mega_tool_fashion: "fashion-editorial",
  "fashion-editorial-set": "fashion-editorial",
  mega_tool_product: "product-lifestyle",
  "product-lifestyle-photos": "product-lifestyle",
  mega_edit_background: "background-changer",
  "background-changer": "background-changer",
  mega_edit_remove_bg: "background-remover",
  "background-remover": "background-remover",
  "image-background-remover": "background-remover",
  mega_edit_magic_eraser: "magic-eraser",
  "magic-eraser": "magic-eraser",
  mega_edit_enhancer: "photo-enhancer",
  "photo-enhancer": "photo-enhancer",
  mega_edit_retouch: "portrait-retouch",
  "portrait-retouch": "portrait-retouch",
  mega_edit_unblur: "unblur-image",
  "unblur-image": "unblur-image",
  mega_edit_color: "color-correction",
  "color-correction": "color-correction",
  mega_edit_restore: "old-photo-restoration",
  "old-photo-restoration": "old-photo-restoration",
  mega_edit_prompt: "edit-by-prompt",
  "edit-by-prompt": "edit-by-prompt",
  "photo-edit-by-prompt": "edit-by-prompt",
  mega_edit_upscale: "magic-upscaler",
  "magic-upscaler": "magic-upscaler",
  mega_video_image: "image-to-video",
  "image-to-video": "image-to-video",
  "image-to-video-concept": "image-to-video",
  mega_video_profile: "profile-clip",
  "profile-clip-maker": "profile-clip",
  mega_video_fan: "fan-poster-motion",
  "fan-poster-motion": "fan-poster-motion",
  mega_video_intro: "creator-intro-video",
  "creator-intro-video": "creator-intro-video",
  mega_video_product: "product-teaser-clip",
  "product-teaser-clip": "product-teaser-clip",
  mega_video_avatar: "animated-avatar",
  "animated-avatar-preview": "animated-avatar",
  mega_video_fashion: "fashion-reel",
  "fashion-reel-starter": "fashion-reel",
  mega_video_album: "album-story-video",
  "album-story-video": "album-story-video"
};

function blockValue(block: SectionBlockInstance, key: string, fallback = ""): string {
  const value = themeValueToString(block.settings[key], "");
  return value.trim() ? value : fallback;
}

function instanceKey(item: { id?: string; type?: string }, index: number, prefix: string): string {
  return item.id?.trim() ? item.id : `${prefix}_${item.type ?? "item"}_${index}`;
}

function legacyInstanceKey(item: { id?: string }, index: number, prefix: string): string {
  if (item.id?.startsWith(`${prefix}_`)) return item.id;
  return `${prefix}_${index + 1}`;
}

function xfcartBlockAttrs(block: SectionBlockInstance, index: number, prefix: string) {
  return {
    "data-xfcart-block-id": instanceKey(block, index, prefix),
    "data-xfcart-block-type": block.type,
    "data-xfcart-block-legacy-id": legacyInstanceKey(block, index, prefix)
  };
}

function routedSitePath(site: DreamShootToolsMenuSite, path = "/"): string {
  const normalizedPath = !path || path === "/" ? "/" : path.startsWith("/") ? path : `/${path}`;
  const basePath = site.__storefrontBasePath;
  if (typeof basePath === "string") {
    if (!basePath) return normalizedPath;
    return normalizedPath === "/" ? basePath : `${basePath}${normalizedPath}`;
  }
  return hostAwareSitePath(site, normalizedPath);
}

function hrefFor(site: DreamShootToolsMenuSite, href: string): string {
  if (!href) return routedSitePath(site);
  if (href === "javascript:void(0);") return "#";
  if (/^(mailto:|tel:|sms:)/i.test(href)) return href;
  if (href === "#workflow" || href === "/#workflow") return routedSitePath(site, "/workflow");
  if (href === "#faq" || href === "/#faq") return routedSitePath(site, "/faq");
  if (href.startsWith("#")) return href;
  if (/^https?:/i.test(href)) {
    try {
      const url = new URL(href);
      const targetHost = cleanHost(url.host).replace(/^www\./, "");
      const siteHost = cleanHost(site.primaryDomain).replace(/^www\./, "");
      if (targetHost && siteHost && targetHost === siteHost) {
        const normalizedPath = url.pathname === "/help"
          ? "/faq"
          : url.pathname === "/how-it-works" || url.hash === "#workflow"
            ? "/workflow"
            : url.pathname;
        const normalizedHash = url.hash === "#workflow" ? "" : url.hash;
        return `${routedSitePath(site, normalizedPath)}${url.search}${normalizedHash}`;
      }
    } catch {
      return href;
    }
    return href;
  }
  const legacyPrefix = `/site/${site.slug}`;
  if (href === legacyPrefix) return routedSitePath(site, "/");
  if (href.startsWith(`${legacyPrefix}/`)) return routedSitePath(site, href.slice(legacyPrefix.length));
  if ((href === "/tools/image-studio" || href === "/tools/ai-image-studio") && /dreamshoot/i.test(`${site.slug} ${site.name} ${site.branding.logoText}`)) {
    return routedSitePath(site, "/tools");
  }
  return routedSitePath(site, href);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isAidreamcapesSite(site: DreamShootToolsMenuSite): boolean {
  return /aidreamcapes/i.test(`${site.id} ${site.slug} ${site.name} ${site.primaryDomain} ${site.branding.logoText}`);
}

function isSpanishXbySite(site: DreamShootToolsMenuSite): boolean {
  return isSpanishStorefrontSite(site);
}

function shortAccessibleText(value: string, fallback: string): string {
  const text = value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text || fallback;
}

function cardLinkLabel(action: string, title: string, fallbackTitle = "this item"): string {
  return `${shortAccessibleText(action, "Open")} ${shortAccessibleText(title, fallbackTitle)}`;
}

function storefrontPaidToolText(value: string): string {
  const freeWord = String.fromCharCode(70, 114, 101, 101);
  const freeWordInsensitive = `[${freeWord[0]}${freeWord[0].toLowerCase()}]${freeWord.slice(1)}`;
  return value
    .replace(new RegExp(`\\b${freeWord} AI Tools Collection\\b`, "g"), "AI Tools Collection")
    .replace(new RegExp(`\\b${freeWordInsensitive} AI photo tools\\b`, "g"), "AI photo tools")
    .replace(new RegExp(`\\b${freeWordInsensitive} AI tools\\b`, "g"), "AI tools")
    .replace(new RegExp(`\\b${freeWordInsensitive} tools\\b`, "g"), "Studio tools")
    .replace(new RegExp(`\\b${freeWordInsensitive} tool\\b`, "g"), "Studio tool")
    .replace(new RegExp(`\\b${freeWordInsensitive}\\b`, "g"), "credit-based")
    .trim();
}

function storefrontPaidToolBlockValue(block: SectionBlockInstance, key: string, fallback = ""): string {
  return storefrontPaidToolText(blockValue(block, key, fallback));
}

export function normalizeDreamshootToolCategory(category: string): string {
  const normalized = category.trim().toLowerCase().replace(/\s+/g, " ");
  if (!normalized) return "Photo AI";
  if (["photo package edit", "photo edit", "ai photo edit", "image edit", "photo editing"].includes(normalized)) return "AI Photo Edit";
  if (["ai video", "video tools", "video tool", "video ai"].includes(normalized)) return "Video AI";
  if (["portrait studio", "portrait makers", "photo tools", "photo tool", "photo ai"].includes(normalized)) return "Photo AI";
  return category.trim();
}

function dreamshootToolLookupKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^\/tools\//, "")
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function toolMenuDisplayLabel(value: string): string {
  return value.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function dreamshootStaticToolPath(fallbackToolId = "", fallbackToolTitle = ""): string {
  const slug = dreamshootStaticToolSlugByKey[fallbackToolId] ?? dreamshootStaticToolSlugByKey[dreamshootToolLookupKey(fallbackToolId)] ?? dreamshootStaticToolSlugByKey[dreamshootToolLookupKey(fallbackToolTitle)];
  return slug ? `/tools/${slug}` : "/tools";
}

function toolBlockSlug(block: SectionBlockInstance): string {
  const href = blockValue(block, "href", "");
  const pathSlug = href.split("?")[0]?.split("#")[0]?.split("/tools/")[1] ?? "";
  return dreamshootToolLookupKey(pathSlug || block.id || blockValue(block, "title", ""));
}

function toolActionHref(site: DreamShootToolsMenuSite, href: string, fallbackToolId = "", fallbackToolTitle = ""): string {
  const normalizedHref = href || "/tools";
  if (normalizedHref.startsWith("#") || normalizedHref.startsWith("http")) return hrefFor(site, normalizedHref);

  const [pathWithMaybeHash, existingSearch = ""] = normalizedHref.split("?");
  const [path, hash = ""] = pathWithMaybeHash.split("#");
  const params = new URLSearchParams(existingSearch);
  const toolId = params.get("tool") || params.get("preset") || fallbackToolId;

  if ((path || "/tools") === "/tools/image-studio" || (path || "/tools") === "/tools/ai-image-studio") {
    const staticPath = dreamshootStaticToolPath(toolId, fallbackToolTitle);
    if (staticPath !== "/tools") return hrefFor(site, `${staticPath}${hash ? `#${hash}` : ""}`);
  }

  const query = params.toString();
  return hrefFor(site, `${path || "/tools"}${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`);
}

function dreamshootDefaultToolTitle(slug: string): string {
  const explicit: Record<string, string> = {
    "headshot": "Professional Headshot Maker",
    "creator-portrait": "Creator Portrait Studio",
    "world-cup-fan-photos": "World Cup Fan Photos",
    "cyberpunk-portrait": "Cyberpunk Portrait Maker",
    "gala-photo": "Gala Photo Maker",
    "noir-portrait": "Noir Character Portraits",
    "anime-avatar": "Anime Avatar Builder",
    "nature-adventure": "Nature Adventure Photos",
    "fashion-editorial": "Fashion Editorial Set",
    "product-lifestyle": "Product Lifestyle Photos",
    "background-changer": "Background Changer",
    "background-remover": "Background Remover",
    "magic-eraser": "Magic Eraser",
    "photo-enhancer": "Photo Enhancer",
    "portrait-retouch": "Portrait Retouch",
    "unblur-image": "Unblur Image",
    "color-correction": "Color Correction",
    "old-photo-restoration": "Old Photo Restoration",
    "edit-by-prompt": "Edit by Prompt",
    "magic-upscaler": "Magic Upscaler",
    "image-to-video": "Image to Video Concept",
    "profile-clip": "Profile Clip Maker",
    "fan-poster-motion": "Fan Poster Motion",
    "creator-intro-video": "Creator Intro Video",
    "product-teaser-clip": "Product Teaser Clip",
    "animated-avatar": "Animated Avatar Preview",
    "fashion-reel": "Fashion Reel Starter",
    "album-story-video": "Album Story Video"
  };
  return explicit[slug] ?? slug.split(/[-_]+/g).map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(" ");
}

function dreamshootDefaultToolCategory(slug: string): string {
  if (slug.includes("video") || slug.includes("clip") || slug.includes("motion") || slug.includes("reel")) return "Video AI";
  if (slug.includes("background") || slug.includes("eraser") || slug.includes("enhancer") || slug.includes("unblur") || slug.includes("correction") || slug.includes("restoration") || slug.includes("prompt") || slug.includes("retouch") || slug.includes("upscaler")) return "AI Photo Edit";
  return "Photo AI";
}

function dreamshootDefaultToolBlocks(): SectionBlockInstance[] {
  return [
    "headshot",
    "creator-portrait",
    "world-cup-fan-photos",
    "cyberpunk-portrait",
    "gala-photo",
    "noir-portrait",
    "anime-avatar",
    "nature-adventure",
    "fashion-editorial",
    "product-lifestyle",
    "image-to-video",
    "profile-clip",
    "fan-poster-motion",
    "creator-intro-video",
    "product-teaser-clip",
    "animated-avatar",
    "fashion-reel",
    "album-story-video",
    "background-changer",
    "background-remover",
    "magic-eraser",
    "photo-enhancer",
    "portrait-retouch",
    "unblur-image",
    "color-correction",
    "old-photo-restoration",
    "edit-by-prompt",
    "magic-upscaler"
  ].map((slug) => ({
    id: `default_tool_${slug}`,
    type: "tool_card",
    settings: {
      title: dreamshootDefaultToolTitle(slug),
      category: dreamshootDefaultToolCategory(slug),
      categoryTitle: dreamshootDefaultToolCategory(slug),
      href: `/tools/${slug}`
    }
  }));
}

function aidreamcapesDefaultToolBlocks(): SectionBlockInstance[] {
  return [
    ["fan-scene-album-builder", "Fan-Scene Album Builder", "Fan-Scene Builders"],
    ["backstage-meetup-scene-builder", "Backstage Meetup Scene Builder", "Fan-Scene Builders"],
    ["supporter-photo-wall-maker", "Supporter Photo Wall Maker", "Fan-Scene Builders"],
    ["fan-keepsake-card-maker", "Fan Keepsake Card Maker", "Fan-Scene Builders"],
    ["game-day-group-portrait-maker", "Game-Day Group Portrait Maker", "Game-Day Builders"],
    ["stadium-night-fan-set-maker", "Stadium Night Fan Set Maker", "Game-Day Builders"],
    ["watch-party-album-builder", "Watch Party Album Builder", "Game-Day Builders"],
    ["premiere-portrait-set-builder", "Premiere Portrait Set Builder", "Premiere Creator Tools"],
    ["vip-arrival-photo-maker", "VIP Arrival Photo Maker", "Premiere Creator Tools"],
    ["award-night-album-studio", "Award Night Album Studio", "Premiere Creator Tools"],
    ["new-year-countdown-album-maker", "New Year Countdown Album Maker", "Occasion Card Tools"],
    ["christmas-group-album-studio", "Christmas Group Album Studio", "Holiday Album Tools"],
    ["cozy-card-portrait-maker", "Cozy Card Portrait Maker", "Occasion Card Tools"],
    ["winter-fan-greeting-maker", "Winter Fan Greeting Maker", "Holiday Album Tools"],
    ["thanksgiving-keepsake-set-maker", "Thanksgiving Keepsake Set Maker", "Holiday Album Tools"],
    ["friendsgiving-memory-maker", "Friendsgiving Memory Maker", "Occasion Card Tools"],
    ["halloween-party-portrait-maker", "Halloween Party Portrait Maker", "Holiday Album Tools"],
    ["costume-cast-album-builder", "Costume Cast Album Builder", "Holiday Album Tools"],
    ["birthday-fan-moment-maker", "Birthday Fan Moment Maker", "Occasion Card Tools"],
    ["permission-safe-photo-planner", "Permission-Safe Photo Planner", "Safety Prep Tools"]
  ].map(([slug, title, category]) => ({
    id: `default_tool_${slug}`,
    type: "tool_card",
    settings: {
      title,
      category,
      categoryTitle: category,
      href: `/tools/${slug}`
    }
  }));
}

export function getDreamshootToolBlocks(blocks: SectionBlockInstance[] | undefined, site?: DreamShootToolsMenuSite): SectionBlockInstance[] {
  const configured = (blocks ?? []).filter((block) => block.type === "tool_card").map((block) => withNormalizedToolCategory(block));
  if (configured.length) return configured;
  return site && isAidreamcapesSite(site) ? aidreamcapesDefaultToolBlocks() : dreamshootDefaultToolBlocks();
}

export function mergeDreamshootToolBlocks(blocks: SectionBlockInstance[], site?: DreamShootToolsMenuSite): SectionBlockInstance[] {
  const merged = new Map<string, SectionBlockInstance>();
  for (const block of getDreamshootToolBlocks(undefined, site)) {
    merged.set(toolBlockSlug(block), block);
  }
  for (const block of blocks.map((item) => withNormalizedToolCategory(item))) {
    merged.set(toolBlockSlug(block), block);
  }
  return Array.from(merged.values());
}

function withNormalizedToolCategory(block: SectionBlockInstance): SectionBlockInstance {
  const category = normalizeDreamshootToolCategory(blockValue(block, "category", "Photo AI"));
  const categoryTitle = normalizeDreamshootToolCategory(blockValue(block, "categoryTitle", category));
  return {
    ...block,
    settings: {
      ...block.settings,
      category,
      categoryTitle
    }
  };
}

export function getToolBlocksFromMenuItems(items: ToolMenuItem[]): SectionBlockInstance[] {
  return items
    .filter((item) => item.status === "active")
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title))
    .map((item) => {
      const parent = item.category?.parent;
      const category = normalizeDreamshootToolCategory(parent?.label || item.category?.label || "AI Tools");
      const badge = item.category?.parent ? item.category.label : item.badge || item.category?.label || "Tool";
      const categoryDescription = parent?.description || item.category?.description || "";
      const categoryIcon = parent?.icon || parent?.iconName || item.category?.icon || item.category?.iconName || "";
      return {
        id: `tool_menu_${item.id}`,
        type: "tool_card",
        settings: {
          title: toolMenuDisplayLabel(item.title),
          description: item.description ?? "",
          category,
          categoryTitle: category,
          categoryDescription,
          categoryIcon,
          badge,
          icon: item.icon || item.category?.icon || item.category?.iconName || parent?.icon || parent?.iconName || "",
          imageUrl: item.imageUrl ?? "",
          href: item.href || `/tools/${item.slug}`
        }
      } satisfies SectionBlockInstance;
    });
}

export function getToolBlocksForMenu(site: DreamShootToolsMenuSite, toolMenuItems: ToolMenuItem[] = [], configuredBlocks?: SectionBlockInstance[]): SectionBlockInstance[] {
  const dynamicBlocks = getToolBlocksFromMenuItems(toolMenuItems);
  if (dynamicBlocks.length) return dynamicBlocks;
  const fallbackBlocks = getDreamshootToolBlocks(configuredBlocks, site);
  return configuredBlocks?.length ? mergeDreamshootToolBlocks(fallbackBlocks, site) : fallbackBlocks;
}

function dreamshootMegaCategoryMeta(category: string) {
  const normalized = category.toLowerCase();
  if (normalized.includes("video")) {
    return {
      accent: "#38a8ff",
      description: "Turn finished visuals into short-form clips, teasers, and animated promos.",
      icon: PlayCircle,
      panelTitle: "Motion builders",
      title: "Motion Lab"
    };
  }
  if (normalized.includes("edit")) {
    return {
      accent: "#ff7b2f",
      description: "Clean up, restore, retouch, and reshape source photos before delivery.",
      icon: Sparkles,
      panelTitle: "Cleanup tools",
      title: "Retouch Lab"
    };
  }
  if (normalized.includes("fan") || normalized.includes("game") || normalized.includes("holiday") || normalized.includes("safety")) {
    return {
      accent: "#38bdf8",
      description: "Plan fan-scene albums, game-day group portraits, holiday memories, and private occasion galleries.",
      icon: Globe2,
      panelTitle: category,
      title: category
    };
  }
  return {
    accent: "#c958f2",
    description: "Build portraits, styled scenes, and package-ready photo concepts.",
    icon: Camera,
    panelTitle: "Portrait makers",
    title: "Portrait Studio"
  };
}

function dreamshootToolIcon(index: number, category: string) {
  const normalized = category.toLowerCase();
  if (normalized.includes("video")) return [PlayCircle, Youtube, Layers3, ImageIcon][index % 4];
  if (normalized.includes("edit")) return [Sparkles, Search, CheckCircle2, BadgeCheck, ShieldCheck][index % 5];
  if (normalized.includes("travel") || normalized.includes("destination") || normalized.includes("route")) return [Globe2, Camera, ImageIcon, Sparkles][index % 4];
  return [Camera, ImageIcon, Heart, Globe2, Users, PackageOpen][index % 6];
}

function dreamshootToolGroupMeta(category: string, items: SectionBlockInstance[]) {
  const base = dreamshootMegaCategoryMeta(category);
  const first = items[0];
  const categoryTitle = first ? blockValue(first, "categoryTitle", category) : category;
  const categoryDescription = first ? blockValue(first, "categoryDescription", base.description) : base.description;
  return {
    ...base,
    description: categoryDescription || base.description,
    panelTitle: categoryTitle || base.panelTitle,
    title: categoryTitle || base.title
  };
}

function dreamshootToolCategoryHref(category: string): string {
  const normalized = category.toLowerCase();
  if (normalized.includes("video")) return "/tools/video-ai";
  if (normalized.includes("edit")) return "/tools/ai-photo-edit";
  return "/tools/photo-ai";
}

function spanishToolCategoryLabel(value: string, aidreamcapes: boolean): string {
  const normalized = value.toLowerCase();
  if (normalized.includes("destination")) return "Destino";
  if (normalized.includes("travel moment") || normalized.includes("moments")) return "Momentos";
  if (normalized.includes("adventure")) return "Aventura";
  if (normalized.includes("creator")) return "Creador";
  if (normalized.includes("route") || normalized.includes("portrait")) return aidreamcapes ? "Retratos de viaje" : "Retrato IA";
  if (normalized.includes("edit")) return "Edicion IA";
  if (normalized.includes("video")) return "Video IA";
  if (normalized.includes("tool")) return "Herramientas IA";
  if (normalized.includes("photo")) return "Foto IA";
  return value;
}

function spanishToolCategoryDescription(value: string, aidreamcapes: boolean): string {
  const normalized = value.toLowerCase();
  if (normalized.includes("video")) return "Convierte imagenes terminadas en clips cortos y vistas previas para compartir.";
  if (normalized.includes("edit")) return "Limpia, restaura y ajusta fotos antes de crear el resultado final.";
  if (normalized.includes("route") || normalized.includes("travel") || normalized.includes("destination")) {
    return aidreamcapes
      ? "Prepara retratos de viaje, rutas visuales y albumes privados con IA."
      : "Crea escenas de viaje y retratos listos para paquetes privados.";
  }
  return aidreamcapes
    ? "Crea retratos de destino y galerias privadas desde tus fotos."
    : "Crea retratos, escenas y paquetes de fotos con tus subidas.";
}

function orderedToolCategories(categories: string[]): string[] {
  const preferred = ["Photo AI", "Video AI", "AI Photo Edit"];
  const ordered = preferred.filter((category) => categories.includes(category));
  return [...ordered, ...categories.filter((category) => !ordered.includes(category))];
}

export function DreamShootMegaToolsPanel({
  site,
  tools,
  ctaLabel,
  ctaHref,
  variant = "section",
  variantTone = "dark"
}: {
  site: DreamShootToolsMenuSite;
  tools: SectionBlockInstance[];
  ctaLabel: string;
  ctaHref: string;
  variant?: "section" | "popover";
  variantTone?: "dark" | "warm";
}) {
  const warm = variantTone === "warm";
  const aidreamcapes = isAidreamcapesSite(site);
  const spanishXby = isSpanishXbySite(site);
  const normalizedTools = tools.map((tool) => withNormalizedToolCategory(tool));
  const categories = Array.from(new Set(normalizedTools.map((tool) => blockValue(tool, "category", "Photo AI"))));
  const allCategories = orderedToolCategories(categories);
  const summaryCategories = (variant === "popover" ? allCategories : allCategories.slice(0, 3)).slice(0, 3);
  const groupedCategories = allCategories.map((category) => ({
    category,
    items: normalizedTools.filter((tool) => blockValue(tool, "category", "Photo AI") === category),
    meta: dreamshootMegaCategoryMeta(category)
  })).map((group) => {
    const meta = dreamshootToolGroupMeta(group.category, group.items);
    if (!spanishXby) return { ...group, meta };
    const title = spanishToolCategoryLabel(group.category, aidreamcapes);
    return {
      ...group,
      meta: {
        ...meta,
        description: spanishToolCategoryDescription(group.category, aidreamcapes),
        panelTitle: title,
        title
      }
    };
  });
  const summaryGroups = groupedCategories.filter((group) => summaryCategories.includes(group.category));
  const detailGroups = groupedCategories;
  const detailColumns = variant === "popover"
    ? (() => {
        const columnCount = Math.min(3, Math.max(1, detailGroups.length));
        const columns = Array.from({ length: columnCount }, () => ({ groups: [] as typeof detailGroups, weight: 0 }));
        detailGroups.forEach((group) => {
          const firstColumn = columns[0];
          if (!firstColumn) return;
          const target = columns.reduce((shortest, column) => (column.weight < shortest.weight ? column : shortest), firstColumn);
          target.groups.push(group);
          target.weight += group.items.length + 1;
        });
        return columns.map((column) => column.groups);
      })()
    : detailGroups.map((group) => [group]);
  const detailGridStyle = variant === "popover"
    ? { gridTemplateColumns: "repeat(auto-fit, minmax(min(16rem, 100%), 1fr))" }
    : undefined;
  const detailGridClassName = warm
    ? `mt-5 grid gap-6 border-t border-[#eadfce] pt-5 ${variant === "popover" ? "" : "lg:grid-cols-[1.22fr_1fr_1fr]"}`
    : `mt-5 grid gap-6 border-t border-[#263247] pt-5 ${variant === "popover" ? "" : "lg:grid-cols-[1.22fr_1fr_1fr]"}`;
  return (
    <div
      className={
        warm
          ? "overflow-hidden rounded-[18px] border border-[#eadfce] bg-[#fffaf3]/[0.99] p-4 text-[#1e1712] shadow-[0_34px_110px_-62px_rgba(114,82,48,0.34)] ring-1 ring-[#d8b17e]/20 backdrop-blur-xl"
          : variant === "popover"
            ? "overflow-hidden rounded-[18px] border border-[#263247] bg-[#070708]/[0.99] p-4 text-white shadow-[0_34px_110px_-52px_rgba(0,0,0,0.95)] ring-1 ring-white/[0.04] backdrop-blur-xl"
            : "overflow-hidden rounded-[20px] border border-[#263247] bg-[#070708] p-4 text-white shadow-[0_34px_110px_-62px_rgba(0,0,0,0.88)] ring-1 ring-white/[0.04]"
      }
    >
      <span className={warm ? "mb-4 block text-center text-[0.98rem] font-semibold tracking-tight text-[#1e1712] sm:text-[1.02rem]" : "mb-4 block text-center text-[0.98rem] font-semibold tracking-tight text-white sm:text-[1.02rem]"}>
        {spanishXby ? "Herramientas del estudio" : "Studio tools"}
      </span>
      <div className="flex flex-wrap items-stretch gap-3">
        {summaryGroups.map((group, index) => {
          const Icon = group.meta.icon;
          const categoryHref = aidreamcapes
            ? hrefFor(site, `/tools#tools-${slugify(group.category)}`)
            : hrefFor(site, dreamshootToolCategoryHref(group.category));
          return (
            <Fragment key={`mega_card_${group.category}`}>
              {index > 0 && <span className={warm ? "self-center text-sm font-bold text-[#a79078]" : "self-center text-sm font-bold text-white/28"}>/</span>}
              <StorefrontInstantLink
                aria-label={cardLinkLabel(spanishXby ? "Explorar" : "Browse", group.meta.title, spanishXby ? "esta categoria" : "this tool category")}
                className={warm ? "group flex min-h-[110px] min-w-[240px] flex-1 basis-[250px] gap-3 rounded-[14px] border border-[#eadfce] bg-white px-4 py-4 text-left transition hover:border-[#d8b17e] hover:bg-[#fff8ed]" : "group flex min-h-[110px] min-w-[240px] flex-1 basis-[250px] gap-3 rounded-[14px] border border-[#2b374c] bg-[#090a0c] px-4 py-4 text-left transition hover:border-white/28 hover:bg-white/[0.04]"}
                data-storefront-document-navigation={categoryHref.includes("#") ? "true" : undefined}
                href={categoryHref}
              >
                <span
                  className="mt-0.5 grid h-12 w-12 shrink-0 place-items-center rounded-full text-white shadow-[0_18px_46px_-28px_rgba(114,82,48,0.58)]"
                  style={{ background: warm ? `linear-gradient(135deg, ${aidreamcapesAccent}, ${aidreamcapesCopper})` : `linear-gradient(135deg, ${group.meta.accent}, #2f6fed)` }}
                >
                  <Icon className="h-5.5 w-5.5" strokeWidth={2} />
                </span>
                <span className="min-w-0">
                  <span className={warm ? "block text-[1.04rem] font-semibold leading-tight text-[#1e1712]" : "block text-[1.04rem] font-semibold leading-tight text-white"}>{group.meta.title}</span>
                  <span className={warm ? "mt-2 block text-[0.92rem] leading-6 text-[#6f6257]" : "mt-2 block text-[0.92rem] leading-6 text-white/72"}>{group.meta.description}</span>
                </span>
              </StorefrontInstantLink>
            </Fragment>
          );
        })}
      </div>
      <div className={detailGridClassName} style={detailGridStyle}>
        {detailColumns.map((column, columnIndex) => (
          <div className="grid content-start gap-6" key={`mega_group_column_${columnIndex}`}>
            {column.map((group) => (
              <div key={`mega_group_${group.category}`} id={slugify(group.category)}>
                <span className="mb-3 block text-[0.94rem] font-semibold" style={{ color: warm ? aidreamcapesCopper : group.meta.accent }}>
                  {group.meta.panelTitle}
                </span>
                <div className="grid gap-3">
                  {group.items.map((tool, index) => {
                    const Icon = dreamshootToolIcon(index, group.category);
                    const toolPrefix = aidreamcapes ? "aidreamcapes_mega_tool" : "dreamshoot_mega_tool";
                    return (
                      <StorefrontInstantLink
                        aria-label={cardLinkLabel(spanishXby ? "Abrir herramienta" : "Open tool", storefrontPaidToolBlockValue(tool, "title", spanishXby ? "herramienta IA" : "AI photo tool"), spanishXby ? "esta herramienta" : "this tool")}
                        className={warm ? "group/tool flex min-h-10 items-start gap-2.5 rounded-[10px] px-2 py-2 text-[0.94rem] leading-6 text-[#4b4037] transition hover:bg-[#f5eadf] hover:text-[#1e1712] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d88a4b]/70" : "group/tool flex min-h-10 items-start gap-2.5 rounded-[10px] px-2 py-2 text-[0.94rem] leading-6 text-white/82 transition hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16DCF0]/70"}
                        href={toolActionHref(site, blockValue(tool, "href", "/tools"), tool.id)}
                        key={instanceKey(tool, index, toolPrefix)}
                        {...xfcartBlockAttrs(tool, index, toolPrefix)}
                      >
                        <Icon className={warm ? "mt-0.5 h-4.5 w-4.5 shrink-0 text-[#b86e36] transition group-hover/tool:text-[#8f5327]" : "mt-0.5 h-4.5 w-4.5 shrink-0 text-white/72 transition group-hover/tool:text-white"} strokeWidth={1.8} />
                        <span className="text-[0.94rem] font-semibold leading-6">{storefrontPaidToolBlockValue(tool, "title", "AI photo tool")}</span>
                      </StorefrontInstantLink>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className={warm ? "mt-5 border-t border-[#eadfce] pt-3 text-center" : "mt-5 border-t border-[#263247] pt-3 text-center"}>
        <StorefrontInstantLink className={warm ? "inline-flex items-center gap-2 text-sm font-semibold text-[#b86e36] transition hover:text-[#8f5327]" : "inline-flex items-center gap-2 text-sm font-semibold text-[#ff8a2f] transition hover:text-[#ffa45d]"} href={hrefFor(site, ctaHref)}>
          {ctaLabel}
          <ArrowRight className="h-4 w-4" strokeWidth={1.9} />
        </StorefrontInstantLink>
      </div>
    </div>
  );
}
