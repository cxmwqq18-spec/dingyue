"use client";

import { ArrowRight, Camera, ChevronRight, Coffee, Heart, ImageIcon, Map as MapIcon, Mountain, PlayCircle, Scissors, Sparkles, Sun, Users } from "lucide-react";
import { usePathname } from "next/navigation";
import { ClickMegaMenu } from "@/components/storefront/click-mega-menu";
import { DreamShootMegaToolsPanel, getToolBlocksForMenu } from "@/components/storefront/dreamshoot-tools-mega-menu";
import { StorefrontInstantLink } from "@/components/storefront/storefront-instant-link";
import { hostAwareSitePath } from "@/lib/domain-routing";
import { getPhotoPackageMegaGroups } from "@/lib/photo-package-taxonomy";
import { isSpanishStorefrontSite } from "@/lib/spanish-storefronts";
import type { CreativePack, CreativePackCategory, PublicCustomer, Site, ToolMenuItem } from "@/lib/types";
import type { LucideIcon } from "lucide-react";
import { CustomerSignOutButton } from "@/components/storefront/customer-sign-out-button";

type CustomerShellHeaderSite = Pick<Site, "id" | "slug" | "name" | "branding" | "primaryDomain">;
type MenuGroupItem = { label: string; href: string };
type MenuGroupEntry = { label: string; accent: string; icon: LucideIcon; items: MenuGroupItem[] };
type MenuGroup = MenuGroupEntry[];

const packageGroups = [
  { label: "Avatar", accent: "#c958f2", icon: ImageIcon, items: [{ label: "Anime Avatar", href: "/collections/anime-avatar" }] },
  { label: "Beauty", accent: "#ff7b2f", icon: Sparkles, items: [{ label: "Hairstyle", href: "/collections/hairstyle" }, { label: "Virtual Try-On", href: "/collections/virtual-try-on" }] },
  { label: "Creative", accent: "#38a8ff", icon: Camera, items: [{ label: "Cyberpunk", href: "/collections/cyberpunk" }, { label: "Gala Photos", href: "/collections/gala-photos" }, { label: "Mafia", href: "/collections/mafia" }, { label: "Nature", href: "/collections/nature" }] },
  { label: "Creator", accent: "#36d399", icon: Users, items: [{ label: "Creator Portraits", href: "/collections/creator-portraits" }, { label: "Fashion Editorial", href: "/collections/fashion-editorial" }, { label: "Product Style", href: "/collections/product-style" }] },
  { label: "Couple", accent: "#ff5f8f", icon: Heart, items: [{ label: "Christmas Couple", href: "/collections/christmas-couple" }, { label: "Engagement", href: "/collections/engagement" }, { label: "Wedding Portraits", href: "/collections/wedding-portraits" }] },
  { label: "Sports", accent: "#f4c542", icon: PlayCircle, items: [{ label: "World Cup Fan Photos", href: "/collections/world-cup-fan-photos" }] }
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

function packageMegaColumns(groups: MenuGroup): MenuGroup[] {
  const columns: MenuGroup[] = [[], [], []];
  groups.forEach((group, index) => {
    columns[index % columns.length]?.push(group);
  });
  return columns;
}

function PackageMegaPanel({ basePath, groups = packageGroups, title = "Photo package studios" }: { basePath: string; groups?: MenuGroup; title?: string }) {
  const totalItems = groups.reduce((sum, group) => sum + group.items.length, 0);
  const columns = packageMegaColumns(groups);
  return (
    <div className="flex max-h-[var(--storefront-mega-panel-max-height,calc(100dvh-6.5rem))] flex-col overflow-hidden rounded-[18px] border border-[#263247] bg-[#070708]/[0.99] p-4 text-white shadow-[0_34px_110px_-52px_rgba(0,0,0,0.95)] ring-1 ring-white/[0.04] backdrop-blur-xl">
      <div className="mb-4 text-center">
        <span className="block text-[1.02rem] font-semibold tracking-tight">{title}</span>
        <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.16em] text-white/38">{groups.length} categories · {totalItems} themes</p>
      </div>
      <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto border-t border-[#263247] pt-5 pr-1 lg:grid-cols-3">
        {columns.map((column, columnIndex) => (
          <div className="grid content-start gap-3" key={`package_column_${columnIndex}`}>
            {column.map((group) => {
              const Icon = group.icon;
              return (
                <details className="group/category rounded-[14px] border border-[#2b374c] bg-[#090a0c] p-3 open:border-white/18 open:bg-white/[0.035]" key={group.label} open>
                  <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 text-[0.94rem] font-semibold marker:hidden group-open/category:border-b group-open/category:border-white/10 group-open/category:pb-2" style={{ color: group.accent }}>
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.06]">
                      <Icon className="h-4 w-4" strokeWidth={1.9} />
                    </span>
                    <span className="min-w-0 truncate text-[0.94rem] font-semibold leading-none">{group.label}</span>
                    <span className="ml-auto text-[11px] font-medium text-white/36">{group.items.length}</span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 rotate-90 text-white/36 transition group-open/category:-rotate-90" strokeWidth={2} />
                  </summary>
                  <div className="mt-3 grid gap-2">
                    {group.items.map((item, itemIndex) => (
                      <StorefrontInstantLink className="group/package flex min-h-10 items-start gap-2.5 rounded-[10px] px-2 py-2 text-[0.94rem] leading-6 text-white/82 transition hover:bg-white/[0.06] hover:text-white" href={`${basePath}${item.href}`} key={`${group.label}-${item.href}-${itemIndex}`}>
                        <span className="text-[0.94rem] font-semibold leading-6">{item.label}</span>
                        <ChevronRight className="ml-auto mt-1 h-3.5 w-3.5 shrink-0 text-white/28 transition group-hover/package:translate-x-0.5 group-hover/package:text-white/56" strokeWidth={2} />
                      </StorefrontInstantLink>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-5 border-t border-[#263247] pt-3 text-center">
        <StorefrontInstantLink className="inline-flex items-center gap-2 text-sm font-semibold text-[#ff8a2f] transition hover:text-[#ffa45d]" href={`${basePath}/collections`}>
          View all packages
          <ArrowRight className="h-4 w-4" strokeWidth={1.9} />
        </StorefrontInstantLink>
      </div>
    </div>
  );
}

export function CustomerShellHeader({
  site,
  customer,
  tone = "dark",
  creativePackCategories = [],
  creativePacks = [],
  toolMenuItems = []
}: {
  site: CustomerShellHeaderSite;
  customer: PublicCustomer;
  tone?: "light" | "dark";
  creativePackCategories?: CreativePackCategory[];
  creativePacks?: CreativePack[];
  toolMenuItems?: ToolMenuItem[];
}) {
  const pathname = usePathname();
  const pathModeBasePath = pathname.match(/^\/site\/[^/]+/)?.[0];
  const basePath = pathModeBasePath ?? hostAwareSitePath(site, "/").replace(/\/$/, "");
  const isAidreamcapes = /aidreamcapes/i.test(`${site.slug} ${site.name} ${site.primaryDomain} ${site.branding.logoText}`);
  const isSpanishXby = isSpanishStorefrontSite(site);
  const isMyDreamShoots = !isAidreamcapes && /mydreamshoots|dreamshoot/i.test(`${site.slug} ${site.name} ${site.primaryDomain} ${site.branding.logoText}`);
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
  const activeToolBlocks = getToolBlocksForMenu(menuSite, toolMenuItems);
  const packagePrefetchPaths = Array.from(new Set([
    `${basePath}/collections`,
    ...activePackageGroups.flatMap((group) => group.items.map((item) => `${basePath}${item.href}`))
  ])).slice(0, 10);
  const toolPrefetchPaths = Array.from(new Set([
    `${basePath}/tools`,
    ...activeToolBlocks.map((tool) => `${basePath}${String(tool.settings.href ?? "/tools")}`)
  ])).slice(0, 8);
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
    ? "block max-w-[8rem] truncate text-[0.82rem] font-semibold min-[1800px]:max-w-[10rem] min-[1800px]:text-sm"
    : "block max-w-[8rem] truncate text-[0.82rem] font-semibold min-[1800px]:max-w-[10rem] min-[1800px]:text-sm";
  const accountEmailClassName = dark
    ? "block max-w-[8.5rem] truncate text-[11px] text-white/72 min-[1800px]:max-w-[11rem] min-[1800px]:text-xs"
    : "block max-w-[8.5rem] truncate text-[11px] text-[#706961] min-[1800px]:max-w-[11rem] min-[1800px]:text-xs";

  return (
    <header className={`sticky top-0 z-50 border-b font-sans backdrop-blur ${dark ? "border-white/10 bg-[#05070E]/[0.94] text-white" : "border-[#eadfce] bg-[#fbf6ee]/[0.96] text-[#171514]"}`}>
      <div className="mx-auto grid max-w-[1680px] gap-2 px-5 py-2">
        <p className={`text-center text-xs font-semibold ${dark ? "text-white/80" : "text-[#171514]/68"}`}>
          {isSpanishXby
            ? isAidreamcapes
              ? "Crea albumes privados de fans y recuerdos festivos desde fotos aprobadas."
              : "Crea sets privados de fotos con IA desde selfies cotidianos."
            : isAidreamcapes ? "Create private fan-scene and holiday albums from approved photos." : "Create private AI photo sets from everyday selfies."}
        </p>
        <div className="flex h-[72px] flex-nowrap items-center justify-between gap-1.5 xl:gap-2 min-[1536px]:gap-2.5 min-[1800px]:h-[76px] min-[1800px]:gap-5">
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
              label={isSpanishXby ? isAidreamcapes ? "Albumes de ocasion" : "Ver paquetes" : isAidreamcapes ? "Occasion Albums" : isMyDreamShoots ? "Photoshoot Studio" : "Browse packages"}
              panelClassName="fixed left-1/2 top-[78px] z-[180] max-h-[calc(100dvh-6.5rem)] w-[min(92vw,1120px)] -translate-x-1/2 overflow-y-auto overscroll-contain transition duration-200 ease-out"
              prefetchPaths={packagePrefetchPaths}
            >
              <PackageMegaPanel
                basePath={basePath}
                groups={activePackageGroups}
                title={isSpanishXby ? isAidreamcapes ? "Estudios de albumes de ocasion" : "Estudios de paquetes de fotos" : isAidreamcapes ? "Occasion album studios" : "AI photo package studios"}
              />
            </ClickMegaMenu>
            <ClickMegaMenu
              buttonClassName={`rounded-[15px] border transition ${desktopNavClass}`}
              label={isSpanishXby ? "Herramientas" : "Tools"}
              panelClassName="fixed left-1/2 top-[78px] z-[180] max-h-[calc(100dvh-6.5rem)] w-[min(92vw,1120px)] -translate-x-1/2 overflow-y-auto overscroll-contain transition duration-200 ease-out"
              prefetchPaths={toolPrefetchPaths}
            >
              <DreamShootMegaToolsPanel
                ctaHref="/tools"
                ctaLabel={isSpanishXby ? "Ver todas las herramientas" : "View all tools"}
                site={menuSite}
                tools={activeToolBlocks}
                variant="popover"
                variantTone="dark"
              />
            </ClickMegaMenu>
            {!isSpanishXby ? (
              <StorefrontInstantLink className={`rounded-full border transition ${desktopNavClass}`} href={`${basePath}/best-packages`}>
                Best Packages
              </StorefrontInstantLink>
            ) : null}
            <StorefrontInstantLink className={`rounded-full border transition ${desktopNavClass}`} href={workflowHref}>
              {isSpanishXby ? "Como funciona" : "How it works"}
            </StorefrontInstantLink>
            <StorefrontInstantLink className={`rounded-full border transition ${desktopNavClass}`} href={`${basePath}/app/create`} prefetch>
              {isSpanishXby ? "Espacio privado" : "Workspace"}
            </StorefrontInstantLink>
            <StorefrontInstantLink className={`rounded-full border transition ${desktopNavClass}`} href={`${basePath}/pricing`}>
              {isSpanishXby ? "Precios" : "Pricing"}
            </StorefrontInstantLink>
            {isSpanishXby ? (
              <StorefrontInstantLink className={`rounded-full border transition ${desktopNavClass}`} href={`${basePath}/faq`}>
                Preguntas
              </StorefrontInstantLink>
            ) : null}
          </nav>

          <div className="order-3 ml-auto shrink-0 min-[1800px]:ml-0" data-storefront-header-controls="">
            <div className={signedInClassName}>
              <StorefrontInstantLink aria-label={isSpanishXby ? "Abrir espacio privado" : "Open workspace"} className="inline-flex min-w-0 items-center gap-2 rounded-full pr-1 transition hover:opacity-80 min-[1800px]:gap-3" href={`${basePath}/app/create`} prefetch>
                <span className={accountIconClassName}>
                  <Users className="h-4 w-4" strokeWidth={1.8} />
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
