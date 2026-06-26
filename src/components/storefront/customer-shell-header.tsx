"use client";

import { ArrowRight, BadgeCheck, Camera, ChevronRight, Heart, ImageIcon, PlayCircle, Scissors, Sparkles, UserCircle, Users } from "lucide-react";
import { ClickMegaMenu } from "@/components/storefront/click-mega-menu";
import { StorefrontInstantLink } from "@/components/storefront/storefront-instant-link";
import type { PublicCustomer, Site } from "@/lib/types";

type CustomerShellHeaderSite = Pick<Site, "slug" | "name" | "branding">;

const packageGroups = [
  { label: "Avatar", accent: "#c958f2", icon: ImageIcon, items: [{ label: "Anime Avatar", href: "/collections/anime-avatar" }] },
  { label: "Beauty", accent: "#ff7b2f", icon: Sparkles, items: [{ label: "Hairstyle", href: "/collections/hairstyle" }, { label: "Virtual Try-On", href: "/collections/virtual-try-on" }] },
  { label: "Creative", accent: "#38a8ff", icon: Camera, items: [{ label: "Cyberpunk", href: "/collections/cyberpunk" }, { label: "Gala Photos", href: "/collections/gala-photos" }, { label: "Mafia", href: "/collections/mafia" }, { label: "Nature", href: "/collections/nature" }] },
  { label: "Creator", accent: "#36d399", icon: Users, items: [{ label: "Creator Portraits", href: "/collections/creator-portraits" }, { label: "Fashion Editorial", href: "/collections/fashion-editorial" }, { label: "Product Style", href: "/collections/product-style" }] },
  { label: "Couple", accent: "#ff5f8f", icon: Heart, items: [{ label: "Christmas Couple", href: "/collections/christmas-couple" }, { label: "Engagement", href: "/collections/engagement" }, { label: "Wedding Portraits", href: "/collections/wedding-portraits" }] },
  { label: "Sports", accent: "#f4c542", icon: PlayCircle, items: [{ label: "World Cup Fan Photos", href: "/collections/world-cup-fan-photos" }] }
];

const toolGroups = [
  {
    label: "Portrait makers",
    accent: "#c958f2",
    icon: Camera,
    items: [
      { label: "Professional headshot maker", href: "/tools/headshot" },
      { label: "Anime avatar builder", href: "/tools/anime-avatar" },
      { label: "Wedding Portraits", href: "/tools/wedding-portraits" },
      { label: "Gala photo maker", href: "/tools/gala-photo" },
      { label: "Nature adventure photos", href: "/tools/nature-adventure" }
    ]
  },
  {
    label: "Cleanup tools",
    accent: "#ff7b2f",
    icon: Sparkles,
    items: [
      { label: "Edit by prompt", href: "/tools/edit-by-prompt" },
      { label: "Background Changer", href: "/tools/background-changer" },
      { label: "Image Background Remover", href: "/tools/background-remover" },
      { label: "Magic Eraser", href: "/tools/magic-eraser" },
      { label: "Photo Enhancer", href: "/tools/photo-enhancer" },
      { label: "Unblur Image", href: "/tools/unblur-image" },
      { label: "Color Correction", href: "/tools/color-correction" }
    ]
  },
  {
    label: "Motion builders",
    accent: "#38a8ff",
    icon: PlayCircle,
    items: [
      { label: "Album story video", href: "/tools/album-story-video" },
      { label: "Profile Clip Maker", href: "/tools/profile-clip" },
      { label: "Creator Intro Video", href: "/tools/creator-intro-video" },
      { label: "Fashion reel starter", href: "/tools/fashion-reel" },
      { label: "Product teaser clip", href: "/tools/product-teaser-clip" }
    ]
  }
];

function PackageMegaPanel({ basePath }: { basePath: string }) {
  return (
    <div className="max-h-[min(76vh,760px)] overflow-hidden rounded-[18px] border border-[#263247] bg-[#070708]/[0.99] p-4 text-white shadow-[0_34px_110px_-52px_rgba(0,0,0,0.95)] ring-1 ring-white/[0.04] backdrop-blur-xl">
      <div className="mb-4 text-center">
        <h2 className="text-[1.02rem] font-semibold tracking-tight">Photo package studios</h2>
        <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.16em] text-white/38">{packageGroups.length} categories</p>
      </div>
      <div className="grid max-h-[min(58vh,600px)] gap-3 overflow-y-auto border-t border-[#263247] pt-5 pr-1 lg:grid-cols-3">
        {packageGroups.map((group) => {
          const Icon = group.icon;
          return (
            <details className="group/category rounded-[14px] border border-[#2b374c] bg-[#090a0c] p-3 open:border-white/18 open:bg-white/[0.035]" key={group.label} open>
              <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 text-[0.94rem] font-semibold marker:hidden group-open/category:border-b group-open/category:border-white/10 group-open/category:pb-2" style={{ color: group.accent }}>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.06]">
                  <Icon className="h-4 w-4" strokeWidth={1.9} />
                </span>
                <span className="min-w-0 truncate">{group.label}</span>
                <span className="ml-auto text-[11px] font-medium text-white/36">{group.items.length}</span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 rotate-90 text-white/36 transition group-open/category:-rotate-90" strokeWidth={2} />
              </summary>
              <div className="mt-3 grid gap-2">
                {group.items.map((item) => (
                  <StorefrontInstantLink className="group/package flex min-h-10 items-start gap-2.5 rounded-[10px] px-2 py-2 text-[0.94rem] leading-6 text-white/82 transition hover:bg-white/[0.06] hover:text-white" href={`${basePath}${item.href}`} key={item.href}>
                    <span>{item.label}</span>
                    <ChevronRight className="ml-auto mt-1 h-3.5 w-3.5 shrink-0 text-white/28 transition group-hover/package:translate-x-0.5 group-hover/package:text-white/56" strokeWidth={2} />
                  </StorefrontInstantLink>
                ))}
              </div>
            </details>
          );
        })}
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

function ToolsMegaPanel({ basePath }: { basePath: string }) {
  const icons = [Camera, ImageIcon, Heart, Users, Scissors, BadgeCheck];
  return (
    <div className="overflow-hidden rounded-[18px] border border-[#263247] bg-[#070708]/[0.99] p-4 text-white shadow-[0_34px_110px_-52px_rgba(0,0,0,0.95)] ring-1 ring-white/[0.04] backdrop-blur-xl">
      <div className="mb-4 text-center text-[1.02rem] font-semibold tracking-tight">Studio tools</div>
      <div className="grid gap-3 sm:grid-cols-3">
        {toolGroups.map((group) => {
          const Icon = group.icon;
          return (
            <StorefrontInstantLink className="group flex min-h-[110px] gap-3 rounded-[14px] border border-[#2b374c] bg-[#090a0c] px-4 py-4 text-left transition hover:border-white/28 hover:bg-white/[0.04]" href={`${basePath}${group.items[0]?.href ?? "/tools"}`} key={group.label}>
              <span className="mt-0.5 grid h-12 w-12 shrink-0 place-items-center rounded-full text-white" style={{ background: `linear-gradient(135deg, ${group.accent}, #2f6fed)` }}>
                <Icon className="h-5.5 w-5.5" strokeWidth={2} />
              </span>
              <span className="min-w-0">
                <span className="block text-[1.04rem] font-semibold leading-tight text-white">{group.label}</span>
                <span className="mt-2 block text-[0.92rem] leading-6 text-white/72">Open the right workflow before creating a private album.</span>
              </span>
            </StorefrontInstantLink>
          );
        })}
      </div>
      <div className="mt-5 grid gap-6 border-t border-[#263247] pt-5 lg:grid-cols-3">
        {toolGroups.map((group, groupIndex) => (
          <div key={group.label}>
            <h3 className="mb-3 text-[0.94rem] font-semibold" style={{ color: group.accent }}>{group.label}</h3>
            <div className="grid gap-3">
              {group.items.map((item, index) => {
                const Icon = icons[(groupIndex + index) % icons.length];
                return (
                  <StorefrontInstantLink className="group/tool flex min-h-10 items-start gap-2.5 rounded-[10px] px-2 py-2 text-[0.94rem] leading-6 text-white/82 transition hover:bg-white/[0.06] hover:text-white" href={`${basePath}${item.href}`} key={item.href}>
                    <Icon className="mt-0.5 h-4.5 w-4.5 shrink-0 text-white/72 transition group-hover/tool:text-white" strokeWidth={1.8} />
                    <span>{item.label}</span>
                  </StorefrontInstantLink>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 border-t border-[#263247] pt-3 text-center">
        <StorefrontInstantLink className="inline-flex items-center gap-2 text-sm font-semibold text-[#ff8a2f] transition hover:text-[#ffa45d]" href={`${basePath}/tools`}>
          View all tools
          <ArrowRight className="h-4 w-4" strokeWidth={1.9} />
        </StorefrontInstantLink>
      </div>
    </div>
  );
}

export function CustomerShellHeader({
  site,
  customer,
  tone = "dark"
}: {
  site: CustomerShellHeaderSite;
  customer: PublicCustomer;
  tone?: "light" | "dark";
}) {
  const basePath = `/site/${site.slug}`;
  const logoText = "MydreamShoots";
  const visualLogoText = "ʍʏƉʀɛǟʍֆhoots";
  const dark = tone === "dark";
  const navClass = dark
    ? "inline-flex items-center gap-2 whitespace-nowrap border-white/16 bg-white/[0.035] text-white hover:border-white/28 hover:bg-white/[0.08]"
    : "inline-flex items-center gap-2 whitespace-nowrap border-[#dfd3c4] bg-white text-[#171514] hover:border-[#bcae9b]";

  return (
    <header className={`sticky top-0 z-50 border-b backdrop-blur ${dark ? "border-white/10 bg-[#05070E]/94 text-white" : "border-[#eadfce] bg-[#fffaf3]/96 text-[#171514]"}`}>
      <div className="mx-auto grid max-w-[1680px] gap-2 px-5 py-2">
        <p className={`text-center text-xs font-semibold ${dark ? "text-white/80" : "text-[#171514]/68"}`}>
          Create realistic AI photo packages from everyday uploads.
        </p>
        <div className="flex min-h-[72px] items-center justify-between gap-5">
          <StorefrontInstantLink aria-label={`${logoText} home`} className="flex min-w-0 items-center gap-3" href={basePath} title={`${logoText} home`}>
            <span className={`relative inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[15px] border ${dark ? "border-white/10 bg-[#0b0d16] text-[#ec4bdd] shadow-[0_0_0_1px_rgba(122,76,255,0.55),0_16px_46px_-24px_rgba(236,75,221,0.74),0_0_34px_-14px_rgba(22,220,240,0.75)]" : "border-[#d8cab9] bg-white text-[#7a4dff]"}`}>
              <Heart className="h-5 w-5" strokeWidth={1.9} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[1.52rem] font-semibold leading-none tracking-[-0.03em]" aria-hidden="true">{dark ? visualLogoText : logoText}</span>
              <span className="sr-only">{logoText}</span>
            </span>
          </StorefrontInstantLink>

          <nav className="hidden items-center justify-center gap-3 text-sm font-semibold lg:flex">
            <ClickMegaMenu
              buttonClassName={`rounded-[16px] border px-5 py-3 transition ${navClass}`}
              label="Photo Packages"
              panelClassName="fixed left-1/2 top-[78px] z-[180] max-h-[calc(100dvh-6.5rem)] w-[min(92vw,1120px)] -translate-x-1/2 overflow-y-auto overscroll-contain transition duration-200 ease-out"
              prefetchPaths={packageGroups.flatMap((group) => group.items.map((item) => `${basePath}${item.href}`)).slice(0, 10)}
            >
              <PackageMegaPanel basePath={basePath} />
            </ClickMegaMenu>
            <ClickMegaMenu
              buttonClassName={`rounded-[16px] border px-5 py-3 transition ${navClass}`}
              label="Tools"
              panelClassName="fixed left-1/2 top-[78px] z-[180] max-h-[calc(100dvh-6.5rem)] w-[min(92vw,1120px)] -translate-x-1/2 overflow-y-auto overscroll-contain transition duration-200 ease-out"
              prefetchPaths={toolGroups.flatMap((group) => group.items.map((item) => `${basePath}${item.href}`)).slice(0, 10)}
            >
              <ToolsMegaPanel basePath={basePath} />
            </ClickMegaMenu>
            <StorefrontInstantLink className={`rounded-full border px-5 py-3 transition ${navClass}`} href={`${basePath}/how-it-works`}>
              How it works
            </StorefrontInstantLink>
            <StorefrontInstantLink className={`rounded-full border px-5 py-3 transition ${navClass}`} href={`${basePath}/pricing`}>
              Pricing
            </StorefrontInstantLink>
            <StorefrontInstantLink className={`rounded-full border px-5 py-3 transition ${navClass}`} href={`${basePath}/faq`}>
              FAQ
            </StorefrontInstantLink>
          </nav>

          <div className="flex min-w-0 items-center gap-2">
            <StorefrontInstantLink className={`hidden min-w-0 items-center gap-3 rounded-full border px-4 py-2 text-sm leading-tight md:inline-flex ${dark ? "border-white/55 bg-transparent text-white" : "border-[#dfd3c4] bg-white text-[#171514]"}`} href={`${basePath}/account`}>
              <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${dark ? "bg-white text-[#171514]" : "bg-[#171514] text-white"}`}>
                <UserCircle className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <span className="min-w-0">
                <span className="block max-w-[10rem] truncate font-semibold">{customer.name}</span>
                <span className={`block max-w-[10rem] truncate text-xs ${dark ? "text-white/72" : "text-[#706961]"}`}>{customer.email}</span>
              </span>
            </StorefrontInstantLink>
            <form action={`${basePath}/logout`} method="post">
              <button className={`rounded-full border px-5 py-3 text-sm font-semibold transition ${dark ? "border-white/55 bg-transparent text-white hover:bg-white/8" : "border-[#171514] bg-[#171514] text-white hover:bg-black"}`} type="submit">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </div>
      {dark ? <div className="h-px w-full bg-[linear-gradient(90deg,#ff9f43,#ec4bdd,#2f6fed,#16dcf0)] opacity-70" /> : null}
    </header>
  );
}
