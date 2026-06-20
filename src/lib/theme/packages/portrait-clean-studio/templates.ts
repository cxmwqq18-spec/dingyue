import { dreamshootAiStudioTemplates, dreamshootAiStudioTemplateLabels } from "../dreamshoot-ai-studio/templates";
import { createThemeTemplateVariant } from "../variant";
import type { ThemePackageSiteSettings, ThemePackageTemplateKey } from "../types";
import type { ThemePageJson } from "@/lib/types";

const replacements = [
  { from: "AI couple photo maker that feels real", to: "Polished portrait sessions for modern personal brands" },
  { from: "Turn your selfies into professional couple photos with AI. Choose any setting, outfit, or vibe from home.", to: "Build clean headshots, dating portraits, and founder profile photos with a studio-grade AI workflow." },
  { from: "#1 AI Couple Photo App", to: "Clean Portrait Studio" },
  { from: "New Christmas Photos!", to: "New Portrait Looks" },
  { from: "Wedding", to: "Founder", mode: "exact" },
  { from: "Holiday", to: "Personal brand", mode: "exact" },
  { from: "Couple photos", to: "Executive portraits" },
  { from: "AI couple photo maker", to: "Executive headshot studio" },
  { from: "Romantic, engagement, and anniversary-ready couple image sets.", to: "Clean, confident portraits for LinkedIn, portfolio, and investor-facing profiles." },
  { from: "Wedding Story Album", to: "Executive Portrait Pack" },
  { from: "Romantic AI portraits for invitations, save-the-date pages, and private albums.", to: "High-trust headshots and portrait variations for bios, decks, and team pages." },
  { from: "How to prepare source photos for an AI couple shoot", to: "How to prepare source photos for a clean portrait session" },
  { from: "Romantic portraits for invites, albums, and anniversary pages.", to: "Sharp portraits for profile pages, founder bios, and recruiting funnels." },
  { from: "Create studio-quality couple photos from everyday selfies.", to: "Create sharp studio portraits from everyday selfies." },
  { from: "Themed photo packs from headshots to wedding photos", to: "Themed portrait packs from founder shots to dating profiles" }
] as const;

export const portraitCleanStudioTemplates: Record<ThemePackageTemplateKey, ThemePageJson> = createThemeTemplateVariant(
  dreamshootAiStudioTemplates,
  [...replacements]
);

export const portraitCleanStudioTemplateLabels = { ...dreamshootAiStudioTemplateLabels };

export const portraitCleanStudioSiteSettings: ThemePackageSiteSettings = {
  branding: {
    logoText: "Portrait Clean",
    market: "Personal-brand portraits and profile photo subscriptions",
    description: "Clean AI portrait storefront for founders, dating profiles, creator bios, modern headshots, subscriptions, credits, and private galleries."
  },
  themeSettings: {
    colors: {
      background: "#f8fafc",
      foreground: "#172033",
      accent: "#0f8b8d",
      muted: "#e5edf2"
    },
    typography: {
      display: "Manrope",
      body: "Geist"
    },
    radii: {
      section: 16,
      control: 12
    },
    navigation: {
      headerLinks: [
        { label: "Portrait packs", href: "#packages" },
        { label: "Looks", href: "#samples" },
        { label: "Pricing", href: "/pricing" },
        { label: "Guides", href: "/blog" }
      ],
      footerLinks: [
        { label: "Privacy", href: "/policies/privacy" },
        { label: "Refunds", href: "/policies/refunds" },
        { label: "Content policy", href: "/policies/content" },
        { label: "Help center", href: "/help" },
        { label: "Guides", href: "/blog" }
      ]
    },
    globalSections: {
      header: {
        settings: {
          title: "Portrait Clean",
          sticky: true,
          ctaLabel: "Create portraits",
          ctaHref: "/login",
          style: "light",
          mobileLabel: "Menu"
        },
        blocks: [
          { id: "portrait_header_packs", type: "menu_link", settings: { label: "Portrait packs", href: "#packages" } },
          { id: "portrait_header_looks", type: "menu_link", settings: { label: "Looks", href: "#samples" } },
          { id: "portrait_header_pricing", type: "menu_link", settings: { label: "Pricing", href: "/pricing" } },
          { id: "portrait_header_guides", type: "menu_link", settings: { label: "Guides", href: "/blog" } }
        ]
      },
      footer: {
        settings: {
          title: "Portrait Clean Studio",
          body: "A personal-brand portrait storefront for clean headshots, profile galleries, site-scoped subscriptions, credits, and private delivery.",
          copyright: "Portrait Clean Studio. All rights reserved."
        },
        blocks: [
          { id: "portrait_footer_privacy", type: "menu_link", settings: { label: "Privacy", href: "/policies/privacy" } },
          { id: "portrait_footer_refunds", type: "menu_link", settings: { label: "Refunds", href: "/policies/refunds" } },
          { id: "portrait_footer_content", type: "menu_link", settings: { label: "Content policy", href: "/policies/content" } },
          { id: "portrait_footer_help", type: "menu_link", settings: { label: "Help center", href: "/help" } },
          { id: "portrait_footer_blog", type: "menu_link", settings: { label: "Guides", href: "/blog" } }
        ]
      }
    },
    seo: {
      siteTitle: "Portrait Clean Studio",
      siteDescription: "AI portrait subscription storefront for profile photos, founder headshots, dating portraits, credits, and private galleries.",
      titleTemplate: "%s | Portrait Clean Studio"
    },
    saasSettingsCurrent: {
      skin_bg: "#f8fafc",
      skin_title_color: "#172033",
      skin_text_color: "#536171",
      skin_price_color: "#0f8b8d",
      skin_primary_btn_bg_color: "#172033",
      skin_primary_btn_text_color: "#ffffff",
      skin_secondary_btn_bg_color: "#eaf5f5",
      skin_secondary_btn_text_color: "#172033",
      skin_title_font_family: "Manrope",
      skin_text_font_family: "Geist",
      general_layout_width: 1240,
      general_layout_spacing: 48,
      sections: {
        header_plus: {
          type: "header_plus",
          version: "1",
          card_name: "Portrait header",
          settings: {
            is_announce_show: true,
            announce_title: "Clean portrait sets for profiles, bios, dating apps, and creator pages.",
            announce_color: "#ffffff",
            announce_bg_color: "#172033"
          },
          blocks: []
        },
        footer_plus: {
          type: "footer_plus",
          version: "1",
          card_name: "Portrait footer",
          settings: {
            footer_bg_color: "#172033",
            footer_text_color: "#dbe7ee"
          },
          blocks: []
        }
      }
    }
  }
};
