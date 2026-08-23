"use client";

import { Camera, Coffee, Heart, ImageIcon, Map as MapIcon, Mountain, PlayCircle, Scissors, Sparkles, Sun, Users } from "lucide-react";
import { usePathname } from "next/navigation";
import { ClickMegaMenu } from "@/components/storefront/click-mega-menu";
import { DreamShootMegaToolsPanel, getToolBlocksForMenu } from "@/components/storefront/dreamshoot-tools-mega-menu";
import { HeaderPhotoPackageMegaPanel, HeaderVideoGenerationMegaPanel, type HeaderPhotoPackageMegaGroup, type HeaderVideoGenerationTopic } from "@/components/storefront/header-mega-menu-panels";
import { StorefrontInstantLink } from "@/components/storefront/storefront-instant-link";
import { hostAwareSitePath } from "@/lib/domain-routing";
import { isMydreamshootsVideoFrameworkSite, mydreamshootsVideoGenerationParentCategories, parentVideoGenerationCategorySlugForChild, videoGenerationCreatePath } from "@/lib/mydreamshoots-video-framework";
import { getPhotoPackageMegaGroups } from "@/lib/photo-package-taxonomy";
import { isSpanishStorefrontSite } from "@/lib/spanish-storefronts";
import { isAidreamcapesSite as isAidreamcapesCapabilitySite, isPrimaryMydreamshootsSite as isPrimaryMydreamshootsCapabilitySite } from "@/lib/storefront-context/capabilities";
import type { CreativePack, CreativePackCategory, PublicCustomer, PublishedVideoNavigationProjection, Site, ToolMenuItem, VideoTheme, VideoThemeCategory } from "@/lib/types";
import type { LucideIcon } from "lucide-react";
import { CustomerSignOutButton } from "@/components/storefront/customer-sign-out-button";

type CustomerShellHeaderSite = Pick<Site, "id" | "slug" | "name" | "branding" | "primaryDomain">;
type MenuGroupItem = { label: string; href: string };
type MenuGroupEntry = { label: string; accent: string; icon: LucideIcon; items: MenuGroupItem[] };
type MenuGroup = MenuGroupEntry[];

const packageGroups = [
  { label: "Best Themes & Presets", accent: "#c958f2", icon: Heart, items: [{ label: "Engagement Photo", href: "/ai-image-generation/engagement-photo" }, { label: "Wedding Photo", href: "/ai-image-generation/wedding-photo" }, { label: "Valentines Photo", href: "/ai-image-generation/valentines-photo" }, { label: "Christmas Photo", href: "/ai-image-generation/christmas-photo" }, { label: "Halloween Photo", href: "/ai-image-generation/halloween-photo" }, { label: "Thanksgiving Photo", href: "/ai-image-generation/thanksgiving-photo" }] },
  { label: "Professional", accent: "#ff7b2f", icon: Users, items: [{ label: "Avatar", href: "/ai-image-generation/avatar" }, { label: "Headshot", href: "/ai-image-generation/headshot" }, { label: "Gala Photo", href: "/ai-image-generation/gala-photo" }, { label: "Portrait Photo", href: "/ai-image-generation/portrait-photo" }, { label: "Black Friday", href: "/ai-image-generation/black-friday" }, { label: "Only Fans", href: "/ai-image-generation/only-fans" }, { label: "Singles Awareness Day", href: "/ai-image-generation/singles-awareness-day" }] },
  { label: "Lifestyle & Creative", accent: "#38a8ff", icon: Camera, items: [{ label: "Cyberpunk", href: "/ai-image-generation/cyberpunk" }, { label: "Boudoir", href: "/ai-image-generation/boudoir" }, { label: "Holiday", href: "/ai-image-generation/holiday" }, { label: "Cannes", href: "/ai-image-generation/cannes" }, { label: "Nightlife", href: "/ai-image-generation/nightlife" }, { label: "Rich Lifestyle", href: "/ai-image-generation/rich-lifestyle" }, { label: "Bikini", href: "/ai-image-generation/bikini" }, { label: "Swimsuit", href: "/ai-image-generation/swimsuit" }, { label: "Travel", href: "/ai-image-generation/travel" }, { label: "Soccer", href: "/ai-image-generation/soccer" }, { label: "Urban", href: "/ai-image-generation/urban" }, { label: "Street Style", href: "/ai-image-generation/street-style" }, { label: "Mafia", href: "/ai-image-generation/mafia" }] },
  { label: "Magic", accent: "#36d399", icon: Sparkles, items: [{ label: "Hairstyle Generator", href: "/ai-image-generation/hairstyle-generator" }, { label: "Virtual Try-On", href: "/ai-image-generation/virtual-try-on" }, { label: "Motion Generator", href: "/ai-video-generation/motion-generator" }] },
  { label: "Photo Tools", accent: "#f4c542", icon: Scissors, items: [{ label: "Background Changer", href: "/ai-image-generation/background-changer" }, { label: "Background Remover", href: "/ai-image-generation/background-remover" }, { label: "Magic Eraser", href: "/ai-image-generation/magic-eraser" }, { label: "Photo Enhancer", href: "/ai-image-generation/photo-enhancer" }, { label: "Portrait Retouch", href: "/ai-image-generation/portrait-retouch" }, { label: "Unblur Image", href: "/ai-image-generation/unblur-image" }, { label: "Color Correction", href: "/ai-image-generation/color-correction" }, { label: "Old Photo Restoration", href: "/ai-image-generation/old-photo-restoration" }, { label: "Edit By Prompt", href: "/ai-image-generation/edit-by-prompt" }] }
];

const aidreamcapesPackageGroups = [
  {
    label: "Scene Atlases",
    accent: "#38bdf8",
    icon: MapIcon,
    items: [
      { label: "Route Portrait Albums", href: "/collections/route-portrait-albums" },
      { label: "Coastal Light Sets", href: "/collections/coastal-light-sets" },
      { label: "Old Quarter Walks", href: "/collections/old-quarter-walks" },
      { label: "Island Balcony Scenes", href: "/collections/island-resort-scenes" }
    ]
  },
  {
    label: "Open-Air Routes",
    accent: "#c084fc",
    icon: Mountain,
    items: [
      { label: "Alpine Trail Frames", href: "/collections/alpine-trail-frames" },
      { label: "Roadside Escape Frames", href: "/collections/road-trip-frames" },
      { label: "Scenic Outlooks", href: "/collections/scenic-overlooks" }
    ]
  },
  {
    label: "Journal Sets",
    accent: "#34d399",
    icon: Coffee,
    items: [
      { label: "Cafe & Street Stories", href: "/collections/cafe-street-stories" },
      { label: "Route Moodboards", href: "/collections/route-moodboards" },
      { label: "Postcard Story Sets", href: "/collections/postcard-story-sets" }
    ]
  }
];

const dreamshootLogoSrc = "/assets/dreamshoot/brand/dreamshootai-logo-refined.svg?v=20260621b";
const aidreamcapesLogoSrc = "/assets/sites/site_aidreamcapes/brand/aidreamcapesai-logo-refined.svg?v=20260708c";
const myDreamShootsDisplayName = "myᕲreamshoots";
const aidreamcapesDisplayName = "ልiጋreamርapes";

function iconForMenuGroup(seed: string): LucideIcon {
  const normalized = seed.toLowerCase();
  if (normalized.includes("beauty") || normalized.includes("hair") || normalized.includes("edit")) return Scissors;
  if (normalized.includes("creator") || normalized.includes("headshot") || normalized.includes("profile")) return Users;
  if (normalized.includes("couple") || normalized.includes("wedding") || normalized.includes("boudoir")) return Heart;
  if (normalized.includes("travel") || normalized.includes("nature") || normalized.includes("route") || normalized.includes("cultural")) return MapIcon;
  if (normalized.includes("sport") || normalized.includes("video") || normalized.includes("motion")) return PlayCircle;
  if (normalized.includes("season") || normalized.includes("holiday")) return Sun;
  if (normalized.includes("avatar") || normalized.includes("anime")) return ImageIcon;
  if (normalized.includes("creative") || normalized.includes("gala")) return Sparkles;
  return Camera;
}

function dynamicPackageGroupsFromPacks(creativePacks?: CreativePack[], creativePackCategories?: CreativePackCategory[]): MenuGroup {
  return getPhotoPackageMegaGroups(creativePacks ?? [], creativePackCategories ?? [])
    .map((group, index) => ({
      label: group.label,
      accent: packageGroups[index % packageGroups.length]?.accent ?? "#38a8ff",
      icon: iconForMenuGroup(`${group.slug} ${group.label} ${group.icon ?? ""}`),
      items: group.items.map((item) => ({ label: item.label, href: item.href }))
    }))
    .filter((group) => group.items.length > 0);
}

function headerPackageGroupsForClient(basePath: string, groups: MenuGroup): HeaderPhotoPackageMegaGroup[] {
  return groups.map((group) => ({
    label: group.label,
    slug: group.label.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    accent: group.accent,
    items: group.items.map((item) => ({
      label: item.label,
      slug: `${group.label}-${item.href}`,
      href: `${basePath}${item.href}`
    }))
  }));
}

function videoGenerationTopicsForMenu(siteId: string, basePath: string, categories: VideoThemeCategory[], themes: VideoTheme[]): HeaderVideoGenerationTopic[] {
  if (siteId !== "site_dreamshoot") return [];
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const parentDefinitionsBySlug = new Map<string, (typeof mydreamshootsVideoGenerationParentCategories)[number]>(
    mydreamshootsVideoGenerationParentCategories.map((category) => [category.slug, category])
  );
  return themes
    .filter((theme) => theme.status === "active" && theme.slug !== "text-to-video" && theme.slug !== "image-to-video")
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .flatMap((theme) => {
      const category = theme.categoryId ? categoriesById.get(theme.categoryId) : undefined;
      if (category && category.status !== "active") return [];
      const configuredParent = category?.parent ?? (category?.parentId ? categoriesById.get(category.parentId) : undefined);
      const parentSlug = configuredParent?.slug ?? parentVideoGenerationCategorySlugForChild(theme.slug);
      const parentDefinition = parentSlug ? parentDefinitionsBySlug.get(parentSlug) : undefined;
      return [{
        id: theme.id,
        slug: theme.slug,
        label: theme.name,
        href: `${basePath}${videoGenerationCreatePath(theme.slug)}`,
        parentSlug,
        parentLabel: configuredParent?.label ?? parentDefinition?.label,
        parentSortOrder: configuredParent?.sortOrder ?? parentDefinition?.sortOrder,
        sortOrder: theme.sortOrder
      }];
    });
}

function publishedVideoGenerationTopicsForMenu(basePath: string, topics: PublishedVideoNavigationProjection[]): HeaderVideoGenerationTopic[] {
  return topics.map((topic) => ({
    id: topic.id,
    slug: topic.slug,
    label: topic.label,
    description: topic.description,
    href: `${basePath}${topic.canonicalPath}`,
    imageUrl: topic.imageUrl,
    parentSlug: topic.parentSlug,
    parentLabel: topic.parentLabel,
    parentSortOrder: topic.parentSortOrder,
    sortOrder: topic.sortOrder
  }));
}

export function CustomerShellHeader({
  site,
  customer,
  tone = "dark",
  creativePackCategories = [],
  creativePacks = [],
  toolMenuItems = [],
  videoThemeCategories = [],
  videoThemes = [],
  publishedVideoGenerationTopics
}: {
  site: CustomerShellHeaderSite;
  customer: PublicCustomer;
  tone?: "light" | "dark";
  creativePackCategories?: CreativePackCategory[];
  creativePacks?: CreativePack[];
  toolMenuItems?: ToolMenuItem[];
  videoThemeCategories?: VideoThemeCategory[];
  videoThemes?: VideoTheme[];
  publishedVideoGenerationTopics?: PublishedVideoNavigationProjection[];
}) {
  const pathname = usePathname();
  const pathModeBasePath = pathname.match(/^\/site\/[^/]+/)?.[0];
  const basePath = pathModeBasePath ?? hostAwareSitePath(site, "/").replace(/\/$/, "");
  const isAidreamcapes = isAidreamcapesCapabilitySite(site);
  const isSpanishXby = isSpanishStorefrontSite(site);
  const isMyDreamShoots = isPrimaryMydreamshootsCapabilitySite(site);
  const logoText = isSpanishXby ? site.branding.logoText || site.name : isAidreamcapes ? aidreamcapesDisplayName : isMyDreamShoots ? myDreamShootsDisplayName : site.branding.logoText || site.name;
  const readableLogoText = isSpanishXby ? site.branding.logoText || site.name : isAidreamcapes ? "Aidreamcapes" : isMyDreamShoots ? "MyDreamShoots" : logoText;
  const homeHref = basePath || "/";
  const workflowHref = `${basePath}/workflow`;
  const logoSrc = (site.branding as { logoImageUrl?: string }).logoImageUrl || (isAidreamcapes ? aidreamcapesLogoSrc : dreamshootLogoSrc);
  const logoAlt = isSpanishXby
    ? isAidreamcapes
      ? `${readableLogoText} logo para albumes privados de fans y recuerdos festivos`
      : `${readableLogoText} logo para paquetes de fotos con IA y galerias privadas`
    : isAidreamcapes
      ? "Aidreamcapes logo for private fan-scene and holiday photo albums"
      : isMyDreamShoots
        ? "MyDreamShoots heart camera logo for AI photo packages and private galleries"
        : `${readableLogoText} logo`;
  const dynamicPackageGroups = dynamicPackageGroupsFromPacks(creativePacks, creativePackCategories);
  const fallbackPackageGroups = isAidreamcapes ? aidreamcapesPackageGroups : packageGroups;
  const hasCatalogData = creativePacks.length > 0 || creativePackCategories.length > 0;
  const activePackageGroups = hasCatalogData ? dynamicPackageGroups : fallbackPackageGroups;
  const menuSite = { ...site, __storefrontBasePath: basePath };
  const primaryMyDreamShoots = isMyDreamShoots && !isSpanishXby;
  const useVideoGenerationToolsMenu = isMydreamshootsVideoFrameworkSite(site) && !isSpanishXby;
  const videoGenerationMenuTopics = useVideoGenerationToolsMenu
    ? publishedVideoGenerationTopics !== undefined
      ? publishedVideoGenerationTopicsForMenu(basePath, publishedVideoGenerationTopics)
      : videoGenerationTopicsForMenu(site.id, basePath, videoThemeCategories, videoThemes)
    : [];
  const videoGenerationMenuHref = `${basePath}${videoGenerationCreatePath()}`;
  const activeToolBlocks = useVideoGenerationToolsMenu ? [] : getToolBlocksForMenu(menuSite, toolMenuItems);
  const packageRootHref = isMyDreamShoots && !isSpanishXby ? "/ai-image-generation" : "/collections";
  const toolRootHref = useVideoGenerationToolsMenu ? videoGenerationCreatePath() : primaryMyDreamShoots ? "/ai-video-generation" : "/tools";
  const packagePrefetchPaths = Array.from(new Set([
    `${basePath}${packageRootHref}`,
    ...activePackageGroups.flatMap((group) => group.items.map((item) => `${basePath}${item.href}`))
  ])).slice(0, 10);
  const toolPrefetchPaths = Array.from(new Set([
    useVideoGenerationToolsMenu ? videoGenerationMenuHref : `${basePath}${toolRootHref}`,
    ...(useVideoGenerationToolsMenu ? videoGenerationMenuTopics.slice(0, 8).map((topic) => topic.href) : activeToolBlocks.map((tool) => `${basePath}${String(tool.settings.href ?? toolRootHref)}`))
  ])).slice(0, 8);
  const headerPackageGroups = headerPackageGroupsForClient(basePath, activePackageGroups);
  const dark = tone === "dark";
  const navClass = dark
    ? "inline-flex items-center gap-2 whitespace-nowrap border-white/16 bg-white/[0.035] text-white hover:border-white/28 hover:bg-white/[0.08]"
    : "inline-flex items-center gap-2 whitespace-nowrap border-[#d6cadc] bg-white/92 text-[#171514] shadow-[0_10px_30px_-24px_rgba(52,39,88,0.4)] hover:border-[#9f8bd7] hover:bg-white";
  const desktopNavClass = `${navClass} px-2 py-2 text-[0.78rem] min-[1440px]:px-2.5 min-[1536px]:px-3 min-[1800px]:px-4 min-[1800px]:py-2.5 min-[1800px]:text-sm`;
  const signedInClassName = dark
    ? "flex min-w-0 items-center gap-1.5 rounded-full border border-white/55 bg-transparent px-1.5 py-1 text-[11px] leading-tight text-white min-[1536px]:gap-2 min-[1536px]:px-2 min-[1800px]:gap-2.5 min-[1800px]:px-3 min-[1800px]:text-xs"
    : "flex min-w-0 items-center gap-1.5 rounded-full border border-[#dfd3c4] bg-white px-1.5 py-1 text-[11px] leading-tight text-[#171514] min-[1536px]:gap-2 min-[1536px]:px-2 min-[1800px]:gap-2.5 min-[1800px]:px-3 min-[1800px]:text-xs";
  const signOutClassName = dark
    ? "inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-white/55 bg-transparent px-2.5 py-2 text-xs font-semibold text-white transition hover:bg-white/[0.08] min-[1800px]:px-3.5 min-[1800px]:py-2.5 min-[1800px]:text-sm"
    : "inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-[#171514] bg-[#171514] px-2.5 py-2 text-xs font-semibold text-white transition hover:bg-black min-[1800px]:px-3.5 min-[1800px]:py-2.5 min-[1800px]:text-sm";
  const accountIconClassName = dark
    ? "grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-[#101114] min-[1800px]:h-9 min-[1800px]:w-9"
    : "grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#15171a] text-white min-[1800px]:h-9 min-[1800px]:w-9";
  const accountTextClassName = dark
    ? "hidden max-w-[8rem] truncate text-[0.82rem] font-semibold sm:block min-[1800px]:max-w-[10rem] min-[1800px]:text-sm"
    : "hidden max-w-[8rem] truncate text-[0.82rem] font-semibold sm:block min-[1800px]:max-w-[10rem] min-[1800px]:text-sm";
  const accountEmailClassName = dark
    ? "hidden max-w-[8.5rem] truncate text-[11px] text-white/72 sm:block min-[1800px]:max-w-[11rem] min-[1800px]:text-xs"
    : "hidden max-w-[8.5rem] truncate text-[11px] text-[#706961] sm:block min-[1800px]:max-w-[11rem] min-[1800px]:text-xs";
  const accountHref = `${basePath}/account`;
  const accountAvatarUrl = customer.profile?.avatarUrl;

  return (
    <header className={`sticky top-0 z-50 border-b font-sans backdrop-blur ${dark ? "border-white/10 bg-[#05070E]/[0.94] text-white" : "border-[#eadfce] bg-[#fbf6ee]/[0.96] text-[#171514]"}`}>
      <div className="mx-auto grid min-w-0 max-w-[1680px] gap-2 px-5 py-2">
        <p className={`text-center text-xs font-semibold ${dark ? "text-white/80" : "text-[#171514]/68"}`}>
          {isSpanishXby
            ? isAidreamcapes
              ? "Crea albumes privados de fans y recuerdos festivos desde fotos aprobadas."
              : "Crea sets privados de fotos con IA desde selfies cotidianos."
            : isAidreamcapes ? "Create private fan-scene and holiday albums from approved photos." : "Create private AI photo sets from everyday selfies."}
        </p>
        <div className="flex h-[72px] min-w-0 flex-nowrap items-center justify-between gap-1.5 xl:gap-2 min-[1536px]:gap-2.5 min-[1800px]:h-[76px] min-[1800px]:gap-5">
          <StorefrontInstantLink aria-label={`${readableLogoText} home`} className="order-1 flex min-w-0 max-w-[13.2rem] shrink items-center gap-2 min-[1536px]:max-w-[16rem] min-[1800px]:max-w-[24rem] min-[1800px]:gap-3" href={homeHref} title={`${readableLogoText} home`}>
            <span className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[13px] bg-transparent min-[1800px]:h-12 min-[1800px]:w-12 min-[1800px]:rounded-[15px]">
              <img className="h-10 w-10 object-contain min-[1800px]:h-12 min-[1800px]:w-12" src={logoSrc} alt={logoAlt} width={48} height={48} />
            </span>
            <span className="min-w-0">
              <span aria-label={readableLogoText} className={`block truncate text-[1.18rem] font-semibold leading-none tracking-normal [font-family:var(--site-title-font)] min-[1440px]:text-[1.28rem] min-[1536px]:text-[1.4rem] min-[1800px]:text-[1.52rem] ${dark ? "text-white" : "text-[#171514]"}`} title={readableLogoText}>
                <span aria-hidden="true">{logoText}</span>
              </span>
              <span className="sr-only">{readableLogoText}</span>
            </span>
          </StorefrontInstantLink>

          <nav className="order-2 hidden min-w-0 flex-1 flex-nowrap items-center justify-center gap-1 text-[0.78rem] font-semibold xl:flex min-[1440px]:gap-1.5 min-[1536px]:gap-2 min-[1800px]:gap-2.5">
            <ClickMegaMenu
              buttonClassName={`rounded-[15px] border transition ${desktopNavClass}`}
              label={isSpanishXby ? isAidreamcapes ? "Albumes de ocasion" : "Ver paquetes" : isAidreamcapes ? "Occasion Albums" : primaryMyDreamShoots ? "AI Image Generation" : "Browse packages"}
              panelClassName="fixed left-1/2 top-[78px] z-[180] max-h-[calc(100dvh-6.5rem)] w-[min(92vw,1120px)] -translate-x-1/2 overflow-y-auto overscroll-contain transition duration-200 ease-out"
              prefetchPaths={packagePrefetchPaths}
            >
              <HeaderPhotoPackageMegaPanel
                aidreamcapes={isAidreamcapes}
                collectionsHref={`${basePath}${packageRootHref}`}
                groups={headerPackageGroups}
                spanish={isSpanishXby}
                variant="dark"
              />
            </ClickMegaMenu>
            <ClickMegaMenu
              buttonClassName={`rounded-[15px] border transition ${desktopNavClass}`}
              label={isSpanishXby ? "Herramientas" : useVideoGenerationToolsMenu ? "AI Video Generation" : primaryMyDreamShoots ? "AI Video Generation" : "Tools"}
              panelClassName="fixed left-1/2 top-[78px] z-[180] max-h-[calc(100dvh-6.5rem)] w-[min(92vw,1120px)] -translate-x-1/2 overflow-y-auto overscroll-contain transition duration-200 ease-out"
              prefetchPaths={toolPrefetchPaths}
            >
              {useVideoGenerationToolsMenu ? (
                <HeaderVideoGenerationMegaPanel
                  topics={videoGenerationMenuTopics}
                  ctaHref={`${basePath}/ai-video-generation`}
                  ctaLabel="View all themes"
                  variantTone="dark"
                />
              ) : (
                <DreamShootMegaToolsPanel
                  ctaHref={toolRootHref}
                  ctaLabel={isSpanishXby ? "Ver todas las herramientas" : primaryMyDreamShoots ? "View all video generators" : "View all tools"}
                  site={menuSite}
                  tools={activeToolBlocks}
                  variant="popover"
                  variantTone="dark"
                />
              )}
            </ClickMegaMenu>
            {!isSpanishXby ? (
              <StorefrontInstantLink className={`rounded-full border transition ${desktopNavClass}`} href={`${basePath}/best-packages`}>
                Best Packages
              </StorefrontInstantLink>
            ) : null}
            <StorefrontInstantLink className={`rounded-full border transition ${desktopNavClass}`} href={workflowHref}>
              {isSpanishXby ? "Como funciona" : "How it works"}
            </StorefrontInstantLink>
            {!isSpanishXby ? (
              <StorefrontInstantLink className={`rounded-full border transition ${desktopNavClass}`} href={`${basePath}/blog`}>
                Blog
              </StorefrontInstantLink>
            ) : null}
            <StorefrontInstantLink className={`rounded-full border transition ${desktopNavClass}`} href={`${basePath}/pricing`}>
              {isSpanishXby ? "Precios" : "Pricing"}
            </StorefrontInstantLink>
            <StorefrontInstantLink className={`rounded-full border transition ${desktopNavClass}`} href={`${basePath}/app/create`} prefetch>
              {isSpanishXby ? "Espacio privado" : "Workspace"}
            </StorefrontInstantLink>
            {isSpanishXby ? (
              <StorefrontInstantLink className={`rounded-full border transition ${desktopNavClass}`} href={`${basePath}/faq`}>
                Preguntas
              </StorefrontInstantLink>
            ) : null}
          </nav>

          <div className="order-3 ml-auto min-w-0 shrink-0 min-[1800px]:ml-0" data-storefront-header-controls="">
            <div className={signedInClassName}>
              <StorefrontInstantLink aria-label={isSpanishXby ? "Abrir cuenta" : "Open account"} className="inline-flex min-w-0 items-center gap-2 rounded-full pr-1 transition hover:opacity-80 min-[1800px]:gap-3" href={accountHref} prefetch>
                <span className={accountIconClassName}>
                  {accountAvatarUrl ? (
                    <img className="h-full w-full rounded-full object-cover" src={accountAvatarUrl} alt="" />
                  ) : (
                    <Users className="h-4 w-4" strokeWidth={1.8} />
                  )}
                </span>
                <span className="min-w-0 text-left">
                  <span className={accountTextClassName}>{customer.name}</span>
                  <span className={accountEmailClassName}>{customer.email}</span>
                </span>
              </StorefrontInstantLink>
              <CustomerSignOutButton className={signOutClassName} label={isSpanishXby ? "Cerrar sesion" : "Sign out"} logoutHref={`/api/sites/${site.id}/auth/logout`} pendingLabel={isSpanishXby ? "Cerrando sesion..." : "Signing out..."} redirectHref={`${basePath}/login`} siteId={site.id} />
            </div>
          </div>
        </div>
      </div>
      {dark ? <div className="h-px w-full bg-[linear-gradient(90deg,#ff9f43,#ec4bdd,#2f6fed,#16dcf0)] opacity-70" /> : null}
    </header>
  );
}
