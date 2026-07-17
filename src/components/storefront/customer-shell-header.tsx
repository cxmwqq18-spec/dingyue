"use client";

import { ArrowRight, Camera, ChevronRight, Coffee, Heart, ImageIcon, Map as MapIcon, Mountain, PlayCircle, Scissors, Sparkles, Sun, UserCircle, Users } from "lucide-react";
import { usePathname } from "next/navigation";
import { ClickMegaMenu } from "@/components/storefront/click-mega-menu";
import { CustomerSignOutButton } from "@/components/storefront/customer-sign-out-button";
import { DreamShootMegaToolsPanel, getToolBlocksForMenu } from "@/components/storefront/dreamshoot-tools-mega-menu";
import { StorefrontInstantLink } from "@/components/storefront/storefront-instant-link";
import { hostAwareSitePath, publicSiteUrl } from "@/lib/domain-routing";
import { getPhotoPackageMegaGroups } from "@/lib/photo-package-taxonomy";
import { isSpanishStorefrontSite } from "@/lib/spanish-storefronts";
import type { CreativePack, CreativePackCategory, PublicCustomer, Site, ToolMenuItem } from "@/lib/types";
import type { LucideIcon } from "lucide-react";

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
  const workflowHref = publicSiteUrl(site, "/workflow");
  const logoSrc = (site.branding as { logoImageUrl?: string }).logoImageUrl || (isAidreamcapes ? aidreamcapesLogoSrc : dreamshootLogoSrc);
  const logoAlt = isSpanishXby
    ? isAidreamcapes
      ? `${readableLogoText} logo para retratos de viaje con IA y galerias privadas`
      : `${readableLogoText} logo para paquetes de fotos con IA y galerias privadas`
    : isAidreamcapes
      ? "Aidreamcapes logo for AI travel portraits and private destination galleries"
      : isMyDreamShoots
        ? "MyDreamShoots heart camera logo for AI photo packages and private galleries"
        : `${readableLogoText} logo`;
  const dynamicPackageGroups = dynamicPackageGroupsFromPacks(creativePacks, creativePackCategories);
  const fallbackPackageGroups = isAidreamcapes ? aidreamcapesPackageGroups : packageGroups;
  const activePackageGroups = dynamicPackageGroups.length ? dynamicPackageGroups : fallbackPackageGroups;
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

  return (
    <header className={`sticky top-0 z-50 border-b font-sans backdrop-blur ${dark ? "border-white/10 bg-[#05070E]/[0.94] text-white" : "border-[#eadfce] bg-[#fbf6ee]/[0.96] text-[#171514]"}`}>
      <div className="mx-auto grid max-w-[1680px] gap-2 px-5 py-2">
        <p className={`text-center text-xs font-semibold ${dark ? "text-white/80" : "text-[#171514]/68"}`}>
          {isSpanishXby
            ? isAidreamcapes
              ? "Crea retratos de viaje con IA desde tus fotos cotidianas."
              : "Crea sets privados de fotos con IA desde selfies cotidianos."
            : isAidreamcapes ? "Create AI travel portraits from everyday uploads." : "Create private AI photo sets from everyday selfies."}
        </p>
        <div className="flex min-h-[72px] items-center justify-between gap-5">
          <StorefrontInstantLink aria-label={`${readableLogoText} home`} className="flex min-w-0 items-center gap-3" href={homeHref} title={`${readableLogoText} home`}>
            <span className="relative inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[15px] bg-transparent">
              <img className="h-12 w-12 object-contain" src={logoSrc} alt={logoAlt} width={48} height={48} />
            </span>
            <span className="min-w-0">
              <span aria-label={readableLogoText} className={`block truncate text-[1.52rem] font-semibold leading-none tracking-[-0.03em] [font-family:var(--site-title-font)] ${dark ? "text-white" : "text-[#171514]"}`} title={readableLogoText}>
                <span aria-hidden="true">{logoText}</span>
              </span>
              <span className="sr-only">{readableLogoText}</span>
            </span>
          </StorefrontInstantLink>

          <nav className="hidden items-center justify-center gap-3 text-sm font-semibold lg:flex">
            <ClickMegaMenu
              buttonClassName={`rounded-[16px] border px-5 py-3 transition ${navClass}`}
              label={isSpanishXby ? isAidreamcapes ? "Paquetes de viaje" : "Ver paquetes" : isAidreamcapes ? "Travel Packages" : "Browse packages"}
              panelClassName="fixed left-1/2 top-[78px] z-[180] max-h-[calc(100dvh-6.5rem)] w-[min(92vw,1120px)] -translate-x-1/2 overflow-y-auto overscroll-contain transition duration-200 ease-out"
              prefetchPaths={packagePrefetchPaths}
            >
              <PackageMegaPanel
                basePath={basePath}
                groups={activePackageGroups}
                title={isSpanishXby ? isAidreamcapes ? "Estudios de rutas de viaje" : "Estudios de paquetes de fotos" : isAidreamcapes ? "Travel route studios" : "AI photo package studios"}
              />
            </ClickMegaMenu>
            <ClickMegaMenu
              buttonClassName={`rounded-[16px] border px-5 py-3 transition ${navClass}`}
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
            <StorefrontInstantLink className={`rounded-full border px-5 py-3 transition ${navClass}`} href={workflowHref}>
              {isSpanishXby ? "Como funciona" : "How it works"}
            </StorefrontInstantLink>
            <StorefrontInstantLink className={`rounded-full border px-5 py-3 transition ${navClass}`} href={`${basePath}/app/create`}>
              {isSpanishXby ? "Espacio privado" : "Workspace"}
            </StorefrontInstantLink>
            <StorefrontInstantLink className={`rounded-full border px-5 py-3 transition ${navClass}`} href={`${basePath}/pricing`}>
              {isSpanishXby ? "Precios" : "Pricing"}
            </StorefrontInstantLink>
            <StorefrontInstantLink className={`rounded-full border px-5 py-3 transition ${navClass}`} href={`${basePath}/faq`}>
              {isSpanishXby ? "Preguntas" : "FAQ"}
            </StorefrontInstantLink>
          </nav>

          <div className="flex min-w-0 items-center gap-2">
            <StorefrontInstantLink className={`hidden min-w-0 items-center gap-3 rounded-full border px-4 py-2 text-sm leading-tight md:inline-flex ${dark ? "border-white/55 bg-transparent text-white" : "border-[#dfd3c4] bg-white text-[#171514]"}`} href={`${basePath}/app/create`}>
              <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${dark ? "bg-white text-[#171514]" : "bg-[#171514] text-white"}`}>
                <UserCircle className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <span className="min-w-0">
                <span className="block max-w-[10rem] truncate font-semibold">{customer.name}</span>
                <span className={`block max-w-[10rem] truncate text-xs ${dark ? "text-white/72" : "text-[#706961]"}`}>{customer.email}</span>
              </span>
            </StorefrontInstantLink>
            <CustomerSignOutButton className={`rounded-full border px-5 py-3 text-sm font-semibold transition ${dark ? "border-white/55 bg-transparent text-white hover:bg-white/8" : "border-[#171514] bg-[#171514] text-white hover:bg-black"}`} label={isSpanishXby ? "Cerrar sesion" : "Sign out"} logoutHref={`/api/sites/${site.id}/auth/logout`} pendingLabel={isSpanishXby ? "Cerrando sesion..." : "Signing out..."} redirectHref={`${basePath}/login`} siteId={site.id} />
          </div>
        </div>
      </div>
      {dark ? <div className="h-px w-full bg-[linear-gradient(90deg,#ff9f43,#ec4bdd,#2f6fed,#16dcf0)] opacity-70" /> : null}
    </header>
  );
}
