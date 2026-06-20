import { dreamshootAiStudioTemplates, dreamshootAiStudioTemplateLabels } from "../dreamshoot-ai-studio/templates";
import { createThemeTemplateVariant } from "../variant";
import type { ThemePackageSiteSettings, ThemePackageTemplateKey } from "../types";
import type { ThemePageJson } from "@/lib/types";

const replacements = [
  { from: "AI couple photo maker that feels real", to: "Executive headshots with a boardroom-grade finish" },
  { from: "Turn your selfies into professional couple photos with AI. Choose any setting, outfit, or vibe from home.", to: "Build founder headshots, team portraits, speaker bios, and recruiting visuals through a high-trust guided photo workflow." },
  { from: "#1 AI Couple Photo App", to: "Executive Headshot Pro" },
  { from: "New Christmas Photos!", to: "New boardroom looks" },
  { from: "Upload selfies and create your own AI model - Take AI photos in any pose, place and outfit.", to: "Upload team portraits and source photos - generate polished headshots for leadership, recruiting, and speaker profiles." },
  { from: "Themed photo packs from headshots to wedding photos - Design your unique album.", to: "Headshot packs for founders, teams, recruiters, and conference bios - package outcomes instead of prompts." },
  { from: "Wedding", to: "Founder", mode: "exact" },
  { from: "Headshot", to: "Leadership", mode: "exact" },
  { from: "Editorial", to: "Boardroom", mode: "exact" },
  { from: "Holiday", to: "Recruiting", mode: "exact" },
  { from: "Couple album", to: "Founder set", mode: "exact" },
  { from: "Profile pack", to: "Leadership pack", mode: "exact" },
  { from: "Studio set", to: "Boardroom set", mode: "exact" },
  { from: "Seasonal pack", to: "Team hiring set", mode: "exact" },
  { from: "Professional AI Photo Packages", to: "Headshot packages buyers understand immediately" },
  { from: "Photo packs customers can understand immediately.", to: "Headshot bundles framed around business outcomes, not prompt engineering." },
  { from: "Choose the photo flow before signup.", to: "Choose the headshot workflow before signup." },
  { from: "AI couple photo maker", to: "Executive headshot studio" },
  { from: "Romantic, engagement, and anniversary-ready couple image sets.", to: "Founder, team, and speaker-ready portrait sets." },
  { from: "Short-form photo video packs", to: "Conference and profile launch kits" },
  { from: "Preview outfits and themed looks", to: "Preview wardrobe and industry looks" },
  { from: "Customers know exactly what happens after signup.", to: "Business customers know exactly what happens after signup." },
  { from: "Train model", to: "Prepare the portrait profile" },
  { from: "Choose a pack", to: "Choose a business package" },
  { from: "Deliver album", to: "Deliver the executive gallery" },
  { from: "Open a private AI studio account.", to: "Open a private executive portrait account." },
  { from: "Wedding client", to: "Founder client" },
  { from: "Studio operator", to: "Talent ops lead" },
  { from: "How to prepare source photos for an AI couple shoot", to: "How to prepare source photos for executive headshots" },
  { from: "AI photo guides", to: "Executive portrait guides" },
  { from: "Guides for uploads, package planning, credits, delivery, and privacy.", to: "Guides for leadership photos, team consistency, delivery rules, and private company galleries." }
] as const;

export const executiveHeadshotProTemplates: Record<ThemePackageTemplateKey, ThemePageJson> = createThemeTemplateVariant(
  dreamshootAiStudioTemplates,
  [...replacements]
);

export const executiveHeadshotProTemplateLabels = { ...dreamshootAiStudioTemplateLabels };

export const executiveHeadshotProSiteSettings: ThemePackageSiteSettings = {
  branding: {
    logoText: "Executive Headshot Pro",
    market: "B2B headshot subscriptions and team portrait delivery",
    description: "Business-facing AI headshot storefront for founders, teams, recruiters, conference bios, credits, subscriptions, and private company galleries."
  },
  themeSettings: {
    colors: {
      background: "#eef2f7",
      foreground: "#101827",
      accent: "#1d4ed8",
      muted: "#dce5ef"
    },
    typography: {
      display: "Manrope",
      body: "Geist"
    },
    radii: {
      section: 14,
      control: 10
    },
    navigation: {
      headerLinks: [
        { label: "Solutions", href: "#packages" },
        { label: "Workflow", href: "#workflow" },
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
          title: "Executive Headshot Pro",
          sticky: true,
          ctaLabel: "Start team intake",
          ctaHref: "/login",
          style: "dark_pills",
          mobileLabel: "Menu"
        },
        blocks: [
          { id: "executive_header_solutions", type: "menu_link", settings: { label: "Solutions", href: "#packages" } },
          { id: "executive_header_workflow", type: "menu_link", settings: { label: "Workflow", href: "#workflow" } },
          { id: "executive_header_pricing", type: "menu_link", settings: { label: "Pricing", href: "/pricing" } },
          { id: "executive_header_guides", type: "menu_link", settings: { label: "Guides", href: "/blog" } }
        ]
      },
      footer: {
        settings: {
          title: "Executive Headshot Pro",
          body: "A B2B portrait storefront for founder headshots, team galleries, private company uploads, credit-safe billing, and operator-controlled delivery.",
          copyright: "Executive Headshot Pro. All rights reserved."
        },
        blocks: [
          { id: "executive_footer_privacy", type: "menu_link", settings: { label: "Privacy", href: "/policies/privacy" } },
          { id: "executive_footer_refunds", type: "menu_link", settings: { label: "Refunds", href: "/policies/refunds" } },
          { id: "executive_footer_content", type: "menu_link", settings: { label: "Content policy", href: "/policies/content" } },
          { id: "executive_footer_help", type: "menu_link", settings: { label: "Help center", href: "/help" } },
          { id: "executive_footer_blog", type: "menu_link", settings: { label: "Guides", href: "/blog" } }
        ]
      }
    },
    seo: {
      siteTitle: "Executive Headshot Pro",
      siteDescription: "B2B AI headshot subscription storefront for founders, teams, recruiting visuals, credits, and private company galleries.",
      titleTemplate: "%s | Executive Headshot Pro"
    },
    saasSettingsCurrent: {
      skin_bg: "#eef2f7",
      skin_title_color: "#101827",
      skin_text_color: "#4b5870",
      skin_price_color: "#1d4ed8",
      skin_primary_btn_bg_color: "#101827",
      skin_primary_btn_text_color: "#ffffff",
      skin_secondary_btn_bg_color: "#e0e9f8",
      skin_secondary_btn_text_color: "#101827",
      skin_title_font_family: "Manrope",
      skin_text_font_family: "Geist",
      general_layout_width: 1280,
      general_layout_spacing: 52,
      sections: {
        header_plus: {
          type: "header_plus",
          version: "1",
          card_name: "Executive header",
          settings: {
            is_announce_show: true,
            announce_title: "Team portrait intake, billing, and private galleries stay scoped to this storefront.",
            announce_color: "#dbeafe",
            announce_bg_color: "#101827"
          },
          blocks: []
        },
        footer_plus: {
          type: "footer_plus",
          version: "1",
          card_name: "Executive footer",
          settings: {
            footer_bg_color: "#101827",
            footer_text_color: "#dbeafe"
          },
          blocks: []
        }
      }
    }
  }
};
