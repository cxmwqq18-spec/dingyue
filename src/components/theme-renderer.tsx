import Link from "next/link";
import { AssetsPanel } from "@/components/app/assets-panel";
import { JobCreateForm } from "@/components/app/job-create-form";
import { LoginForm } from "@/components/auth/login-form";
import { hostAwareSitePath } from "@/lib/domain-routing";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Camera,
  Check,
  ChevronRight,
  CloudRain,
  Clock3,
  Download,
  Facebook,
  Globe2,
  Headset,
  Heart,
  ImageIcon,
  Instagram,
  Layers3,
  Mail,
  MapPin,
  Menu,
  PackageOpen,
  Pin,
  PlayCircle,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Tags,
  UploadCloud,
  Users,
  Youtube
} from "lucide-react";
import { getSectionSchema } from "@/lib/section-schema";
import { getSectionEntries } from "@/lib/theme";
import { formatCurrency } from "@/lib/data";
import { fallbackImageForSeed, resolveMediaAssetUrl } from "@/lib/media";
import { themeValueToList, themeValueToString } from "@/lib/theme-values";
import type {
  CreativePack,
  SectionBlockInstance,
  SectionInstance,
  Site,
  ThemePageJson,
  ThemeRuntimeData,
  ThemeSettings,
  ThemeSettingValue
} from "@/lib/types";

type StorefrontRouteMode = "host" | "path";
type RoutedSite = Site & {
  __storefrontBasePath?: string;
};

export function ThemeRenderer({
  site,
  page,
  settings,
  products = [],
  siteAiApps = [],
  creativePacks = [],
  runtime,
  mode = "published",
  pagePath,
  query = {},
  routeMode = "path",
  previewSelection
}: {
  site: Site;
  page: ThemePageJson;
  settings: ThemeSettings;
  products?: ReturnType<typeof import("@/lib/data").getSiteProducts>;
  siteAiApps?: ReturnType<typeof import("@/lib/data").getSiteAiApps>;
  creativePacks?: CreativePack[];
  runtime?: ThemeRuntimeData;
  mode?: "published" | "preview";
  pagePath?: string;
  query?: Record<string, string | string[] | undefined>;
  routeMode?: StorefrontRouteMode;
  previewSelection?: {
    sectionId?: string;
    blockId?: string;
  };
}) {
  const entries = getSectionEntries(page);
  const routedSite: RoutedSite = {
    ...site,
    __storefrontBasePath: routeMode === "host" ? "" : `/site/${site.slug}`
  };
  const normalizedPath = pagePath ?? sitePathFromPage(site, page.pageType);
  const renderContext = {
    pagePath: normalizedPath,
    query,
    pages: site.pages
  };
  return (
    <div className="bg-[var(--site-bg)] text-[var(--site-fg)] [font-family:var(--site-text-font)]">
      <div
        className="xfcart-section"
        data-section-id="header_plus"
        data-section-style=""
        data-section-type="header_plus"
        id="xfcart-section-header_plus"
        {...previewSelectedAttrs(previewSelection, "header_plus")}
      >
        <ThemeGlobalHeader site={routedSite} settings={settings} />
      </div>
      <main data-theme-sections-root="">
        {entries.map(([id, section]) => (
          <ThemeSectionFrame
            creativePacks={creativePacks}
            id={id}
            key={id}
            mode={mode}
            previewSelection={previewSelection}
            products={products}
            renderContext={renderContext}
            runtime={runtime}
            section={section}
            site={routedSite}
            siteAiApps={siteAiApps}
          />
        ))}
      </main>
      <div
        className="xfcart-section"
        data-section-id="footer_plus"
        data-section-style=""
        data-section-type="footer_plus"
        id="xfcart-section-footer_plus"
        {...previewSelectedAttrs(previewSelection, "footer_plus")}
      >
        <ThemeGlobalFooter site={routedSite} settings={settings} />
      </div>
    </div>
  );
}

type ThemeSectionFrameProps = {
  id: string;
  section: SectionInstance;
  site: Site;
  products: ReturnType<typeof import("@/lib/data").getSiteProducts>;
  siteAiApps: ReturnType<typeof import("@/lib/data").getSiteAiApps>;
  creativePacks: CreativePack[];
  runtime?: ThemeRuntimeData;
  mode: "published" | "preview";
  renderContext: RenderContext;
  previewSelection?: {
    sectionId?: string;
    blockId?: string;
  };
};

type RenderContext = {
  pagePath: string;
  query: Record<string, string | string[] | undefined>;
  pages: Site["pages"];
};

type SiteProduct = ReturnType<typeof import("@/lib/data").getSiteProducts>[number];
type SearchResultCard = {
  id: string;
  kind: "product" | "pack" | "tool" | "page";
  title: string;
  description: string;
  imageUrl: string;
  href: string;
  meta: string;
  keywords: string[];
};

type CollectionPageCard = {
  id: string;
  title: string;
  description: string;
  meta: string;
  credits: string;
  imageUrl: string;
  href: string;
};

type DreamShootCatalogCard = {
  id: string;
  title: string;
  description: string;
  category: string;
  meta: string;
  credits: string;
  imageUrl: string;
  href: string;
};

export function ThemeSectionFrame({ id, section, site, products, siteAiApps, creativePacks, runtime, mode, renderContext, previewSelection }: ThemeSectionFrameProps) {
  return (
    <div
      className="xfcart-section"
      data-section-id={id}
      data-section-style=""
      data-section-type={section.type}
      id={`xfcart-section-${id}`}
      {...previewSelectedAttrs(previewSelection, id)}
    >
      <SectionView
        creativePacks={creativePacks}
        id={id}
        mode={mode}
        products={products}
        renderContext={renderContext}
        runtime={runtime}
        section={section}
        site={site}
        siteAiApps={siteAiApps}
      />
    </div>
  );
}

function previewSelectedAttrs(previewSelection: { sectionId?: string; blockId?: string } | undefined, sectionId: string) {
  if (previewSelection?.sectionId !== sectionId) return {};
  return {
    "data-xfcart-selected": "true",
    ...(previewSelection.blockId ? { "data-xfcart-selected-block": previewSelection.blockId } : {})
  };
}

export function ThemeGlobalHeader({ site, settings }: { site: Site; settings: ThemeSettings }) {
  const header = settings.globalSections?.header;
  const saasHeader = saasGlobalSection(settings, "header_plus");
  const title = header ? setting(header, "title", site.branding.logoText) : site.branding.logoText;
  const style = header ? setting(header, "style", "light") : "light";
  const sticky = header ? settingBool(header, "sticky", true) : true;
  const announceEnabled = saasBool(saasHeader?.settings?.is_announce_show, false);
  const announceText = themeValueToString(saasHeader?.settings?.announce_title, "");
  const headerBlocks = header?.blocks?.filter((block) => block.type === "menu_link") ?? [];
  const links = headerBlocks.length
    ? headerBlocks.map((block) => ({ label: blockValue(block, "label"), href: blockValue(block, "href", "#"), block }))
    : settings.navigation.headerLinks.map((link, index) => ({
        ...link,
        block: { id: `header_nav_${index + 1}`, type: "menu_link", settings: { label: link.label, href: link.href } } as SectionBlockInstance
      }));
  const toolMegaBlocks = getDreamshootToolBlocks(header?.blocks);
  const dark = style === "dark_pills";
  const lightCommerce = style === "light_commerce";
  const showDreamShootToolsMega = dark && /dreamshoot/i.test(title) && toolMegaBlocks.length > 0;
  const market = site.branding.market || "AI photo subscriptions, private uploads, and customer galleries";
  const ctaLabel = header ? setting(header, "ctaLabel", "Get Started") : "Get Started";
  const ctaHref = header ? setting(header, "ctaHref", "/login") : "/login";
  const mobileLabel = header ? setting(header, "mobileLabel", "Menu") : "Menu";
  const logoImageUrl = header ? setting(header, "logoImageUrl", "") : "";
  const logoAlt = header ? setting(header, "logoAlt", title) : title;
  const isDreamShoot = /dreamshoot/i.test(title);
  const brandMark = brandInitials(title);
  return (
    <header
      className={
        [
          "storefront-global-header",
          dark
            ? `${sticky ? "sticky top-0" : "relative"} z-30 border-b border-white/10 ${isDreamShoot ? "bg-[#05070E]/94" : "bg-[#0b0b0d]/90"} text-white backdrop-blur-xl`
            : lightCommerce
              ? `${sticky ? "sticky top-0" : "relative"} z-30 border-b border-[#eadfce] bg-[linear-gradient(180deg,rgba(255,252,248,0.98)_0%,rgba(252,246,238,0.94)_100%)] text-[#14161a] backdrop-blur`
              : `${sticky ? "sticky top-0" : "relative"} z-30 border-b border-black/10 bg-[var(--site-bg)] backdrop-blur-md`
        ].join(" ")
      }
    >
      {announceEnabled && announceText ? (
        <div className="px-5 py-2 text-center text-xs font-medium" style={{ background: themeValueToString(saasHeader?.settings?.announce_bg_color, "#111111"), color: themeValueToString(saasHeader?.settings?.announce_color, "#ffffff") }}>
          {announceText}
        </div>
      ) : null}
      <div className={lightCommerce ? "mx-auto grid h-[84px] max-w-[var(--site-content-width)] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 sm:gap-6 sm:px-5" : "mx-auto flex max-w-[var(--site-content-width)] items-center justify-between px-5 py-4"}>
        <Link
          href={hrefFor(site, "/")}
          className={
            dark
              ? isDreamShoot
                ? "inline-flex items-center gap-3 rounded-[18px] px-0 py-0 text-white"
                : "inline-flex items-center gap-3 rounded-[16px] border border-white/10 bg-white px-3 py-2 text-zinc-950 shadow-[0_22px_60px_-38px_rgba(0,0,0,0.75)]"
              : lightCommerce
                ? "inline-flex min-w-0 items-center gap-3 text-[#14161a]"
                : "font-mono text-sm uppercase tracking-[0.22em]"
          }
        >
          {dark || lightCommerce ? (
            <>
              {logoImageUrl ? (
                <span
                  className={
                    isDreamShoot && dark
                      ? "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-[15px] border border-white/10 bg-[#0b0d16] shadow-[0_0_0_1px_rgba(122,76,255,0.55),0_16px_46px_-24px_rgba(236,75,221,0.74),0_0_34px_-14px_rgba(22,220,240,0.75)] before:absolute before:inset-[-1px] before:-z-10 before:rounded-[16px] before:bg-[linear-gradient(135deg,#7A4CFF_0%,#EC4BDD_48%,#16DCF0_100%)]"
                      : lightCommerce
                        ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_16px_34px_-24px_rgba(184,138,89,0.85)] sm:h-14 sm:w-14"
                        : "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white"
                  }
                >
                  <img
                    className={
                      isDreamShoot && dark
                        ? "h-8 w-8 object-contain"
                        : lightCommerce
                          ? "h-full w-full rounded-full object-cover"
                          : "h-full w-full rounded-full object-cover"
                    }
                    src={mediaAssetUrl(site, logoImageUrl)}
                    alt={logoAlt}
                  />
                </span>
              ) : (
                <span className={lightCommerce ? "flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#171514] text-[10px] font-semibold tracking-[0.16em] text-white" : "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-[10px] font-semibold tracking-[0.16em] text-white"}>
                  {brandMark}
                </span>
              )}
              <span className="min-w-0">
                <span className={lightCommerce ? "block max-w-[9rem] truncate text-[1.72rem] font-semibold leading-none text-zinc-950 [font-family:var(--site-title-font)] sm:max-w-[12rem] sm:text-[2.15rem]" : isDreamShoot && dark ? "block text-[1.52rem] font-semibold leading-none tracking-[-0.035em] text-white sm:text-[1.66rem]" : "block text-lg font-semibold tracking-tight text-zinc-950"}>{title}</span>
                {lightCommerce ? <span className="sr-only">{market}</span> : null}
              </span>
            </>
          ) : title}
        </Link>
        <nav className={dark ? "hidden items-center justify-center gap-4 lg:flex" : lightCommerce ? "hidden min-w-0 items-center justify-center gap-6 xl:flex xl:gap-8" : "hidden items-center gap-6 text-sm text-[var(--site-body)] md:flex"}>
          {links.map((link, index) => {
            const navClass = dark
              ? isDreamShoot
                ? `inline-flex items-center gap-2 rounded-[16px] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.08] ${index === 0 ? "border border-transparent bg-[#0b0d16] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1),0_0_0_1px_rgba(122,76,255,0.55),0_0_24px_-12px_rgba(22,220,240,0.8)]" : "border border-white/16 bg-white/[0.035]"}`
                : "inline-flex items-center gap-2 rounded-[14px] border border-white/30 px-4 py-2 text-sm font-medium text-white transition hover:border-white/50 hover:bg-white/[0.08]"
              : lightCommerce
                ? "inline-flex min-h-10 items-center gap-2 text-[0.98rem] font-medium text-[#171514] transition hover:text-[#b07b47]"
                : "transition hover:text-[var(--site-fg)]";
            const isToolsLink = showDreamShootToolsMega && /tools/i.test(link.label);
            const linkNode = (
              <Link
                className={navClass}
                href={hrefFor(site, link.href)}
                {...xfcartBlockAttrs(link.block, index, "header_nav")}
              >
                {link.label}
                {isToolsLink ? <ChevronRight className="h-3.5 w-3.5 rotate-90 text-white/72" strokeWidth={2} /> : null}
              </Link>
            );
            if (!isToolsLink) {
              return <span key={`${link.label}_${link.href}`}>{linkNode}</span>;
            }
            return (
              <div className="group relative" key={`${link.label}_${link.href}`}>
                {linkNode}
                <div className={`pointer-events-none fixed left-1/2 z-50 w-[min(92vw,1180px)] -translate-x-1/2 translate-y-2 opacity-0 transition duration-200 ease-out group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 ${announceEnabled && announceText ? "top-[126px]" : "top-[78px]"}`}>
                  <DreamShootMegaToolsPanel
                    ctaHref="/tools"
                    ctaLabel="Explore all tools"
                    site={site}
                    tools={toolMegaBlocks}
                    variant="popover"
                  />
                </div>
              </div>
            );
          })}
        </nav>
        <div className="flex items-center justify-end gap-3">
          <Link
            className={
              dark
                ? isDreamShoot
                  ? "hidden rounded-[18px] border border-white/14 bg-white/[0.045] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_18px_48px_-34px_rgba(236,75,221,0.72)] transition hover:-translate-y-0.5 hover:border-white/24 hover:bg-white/[0.08] active:scale-[0.98] lg:inline-flex"
                  : "hidden rounded-[14px] border border-white/30 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 active:scale-[0.98] lg:inline-flex"
                : lightCommerce
                  ? "hidden rounded-[10px] bg-[#171514] px-6 py-3 text-[0.98rem] font-semibold text-white transition hover:-translate-y-0.5 active:scale-[0.98] lg:inline-flex"
                  : "rounded-full px-4 py-2 text-sm font-medium transition active:scale-[0.98]"
            }
            href={hrefFor(site, ctaHref)}
            style={isDreamShoot && dark ? { background: dreamshootBrandGradient } : dark || lightCommerce ? undefined : { background: "var(--site-primary-button)", color: "var(--site-primary-button-text)" }}
          >
            {ctaLabel}
          </Link>
          {dark || lightCommerce ? (
            <details className="group relative z-[70] lg:hidden" data-storefront-mobile-menu>
              <summary
                className={
                  dark
                    ? "relative z-[90] flex list-none items-center gap-2 rounded-[14px] border border-white/20 bg-white/[0.08] px-4 py-3 text-sm font-medium text-white shadow-[0_16px_44px_-34px_rgba(0,0,0,0.55)] backdrop-blur"
                    : "relative z-[90] flex list-none items-center gap-2 rounded-[14px] border border-[#ddd0c2] bg-white px-4 py-3 text-sm font-medium text-[#171514] shadow-[0_16px_44px_-34px_rgba(20,22,26,0.28)]"
                }
              >
                {mobileLabel}
                <Menu className="h-4 w-4" strokeWidth={1.8} />
              </summary>
              <div
                aria-hidden="true"
                className={
                  isDreamShoot && dark
                    ? "fixed inset-0 z-[72] bg-[#02030A]/82 backdrop-blur-[3px] lg:hidden"
                    : "fixed inset-0 z-[72] bg-black/58 backdrop-blur-[2px] lg:hidden"
                }
              />
              <div
                className={
                  dark
                    ? isDreamShoot
                      ? "absolute right-0 top-[calc(100%+12px)] z-[86] w-[min(22rem,calc(100vw-2rem))] rounded-[24px] border border-white/18 bg-[#070911]/[0.99] p-3 shadow-[0_38px_110px_-54px_rgba(0,0,0,0.96)] ring-1 ring-[#16DCF0]/20 backdrop-blur-xl"
                      : "absolute right-0 top-[calc(100%+12px)] z-[86] w-[min(18rem,calc(100vw-2rem))] rounded-[24px] border border-white/14 bg-[#101114]/[0.99] p-3 shadow-[0_34px_88px_-52px_rgba(0,0,0,0.85)] backdrop-blur"
                    : "absolute right-0 top-[calc(100%+12px)] z-[86] w-[min(18rem,calc(100vw-2rem))] rounded-[24px] border border-[#e2d7ca] bg-[#fffaf3] p-3 shadow-[0_34px_88px_-52px_rgba(20,22,26,0.32)] backdrop-blur"
                }
              >
                <div className="grid gap-1">
                  {links.map((link, index) => (
                    <Link
                      className={
                        dark
                          ? "rounded-[16px] px-4 py-3 text-sm font-medium text-white/76 transition hover:bg-white/[0.08] hover:text-white"
                          : "rounded-[16px] px-4 py-3 text-sm font-medium text-[#4f4944] transition hover:bg-white hover:text-[#171514]"
                      }
                      href={hrefFor(site, link.href)}
                      key={`mobile_${link.label}_${link.href}`}
                      {...xfcartBlockAttrs(link.block, index, "header_nav_mobile")}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
                <Link
                  className={
                    dark
                      ? "mt-3 inline-flex w-full items-center justify-center gap-2 rounded-[16px] bg-white px-4 py-3 text-sm font-semibold text-[#101114]"
                      : "mt-3 inline-flex w-full items-center justify-center gap-2 rounded-[16px] bg-[#171514] px-4 py-3 text-sm font-semibold text-white"
                  }
                  href={hrefFor(site, ctaHref)}
                >
                  {ctaLabel}
                  <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                </Link>
              </div>
            </details>
          ) : null}
        </div>
      </div>
      {isDreamShoot && dark ? <div className="h-px w-full" style={{ background: dreamshootBrandGradient, opacity: 0.72 }} /> : null}
    </header>
  );
}

export function ThemeGlobalFooter({ site, settings }: { site: Site; settings: ThemeSettings }) {
  const footer = settings.globalSections?.footer;
  const saasFooter = saasGlobalSection(settings, "footer_plus");
  const title = footer ? setting(footer, "title", site.branding.logoText) : site.branding.logoText;
  const tagline = footer ? setting(footer, "tagline", site.branding.market) : site.branding.market;
  const body = footer ? setting(footer, "body", site.branding.description) : site.branding.description;
  const logoImageUrl = footer ? setting(footer, "logoImageUrl", "") : "";
  const logoAlt = footer ? setting(footer, "logoAlt", title) : title;
  const footerBg = footer
    ? setting(footer, "backgroundColor", themeValueToString(saasFooter?.settings?.footer_bg_color, "var(--site-bg)"))
    : themeValueToString(saasFooter?.settings?.footer_bg_color, "var(--site-bg)");
  const footerTextColor = footer
    ? setting(footer, "textColor", themeValueToString(saasFooter?.settings?.footer_text_color, "var(--site-body)"))
    : themeValueToString(saasFooter?.settings?.footer_text_color, "var(--site-body)");
  const dark = isDarkColor(footerBg) || isDarkColor(themeValueToString(settings.saasSettingsCurrent?.skin_bg, settings.colors.background));
  const blocks = footer?.blocks?.filter((block) => block.type === "menu_link") ?? [];
  const links = blocks.length
    ? blocks.map((block) => ({ label: blockValue(block, "label"), href: blockValue(block, "href", "#"), block }))
    : settings.navigation.footerLinks.map((link, index) => ({
        ...link,
        block: { id: `footer_nav_${index + 1}`, type: "menu_link", settings: { label: link.label, href: link.href } } as SectionBlockInstance
      }));
  const headerLinksAsFooter = settings.navigation.headerLinks.map((link, index) => ({
    ...link,
    block: { id: `footer_header_nav_${index + 1}`, type: "menu_link", settings: { label: link.label, href: link.href, group: "product" } } as SectionBlockInstance
  }));
  const linkCategory = (item: { label: string; href: string }) => {
    const value = `${item.label} ${item.href}`.toLowerCase();
    if (/(privacy|refund|content|policy|help|support|faq)/.test(value)) return "support";
    if (/(journal|blog|about|company|story)/.test(value)) return "company";
    if (/(pricing|package|collection|style|example|work|tool|album)/.test(value)) return "product";
    return "";
  };
  const hasGroupedFooterLinks = links.some((item) => blockValue(item.block, "group", "").trim());
  const groupedLinks = {
    product: links.filter((item) => blockValue(item.block, "group", "").toLowerCase().includes("product")),
    company: links.filter((item) => blockValue(item.block, "group", "").toLowerCase().includes("company")),
    support: links.filter((item) => {
      const group = blockValue(item.block, "group", "").toLowerCase();
      return group.includes("support") || (hasGroupedFooterLinks && !group);
    })
  };
  const semanticProductLinks = links.filter((item) => linkCategory(item) === "product");
  const semanticCompanyLinks = links.filter((item) => linkCategory(item) === "company");
  const semanticSupportLinks = links.filter((item) => linkCategory(item) === "support");
  const productLinks = hasGroupedFooterLinks && groupedLinks.product.length
    ? groupedLinks.product
    : semanticProductLinks.length
      ? semanticProductLinks
      : headerLinksAsFooter.filter((item) => linkCategory(item) === "product").slice(0, 4);
  const companyLinks = hasGroupedFooterLinks && groupedLinks.company.length
    ? groupedLinks.company
    : semanticCompanyLinks.length
      ? semanticCompanyLinks
      : links.filter((item) => !semanticSupportLinks.includes(item) && !semanticProductLinks.includes(item)).slice(0, 2);
  const supportLinks = hasGroupedFooterLinks && groupedLinks.support.length
    ? groupedLinks.support
    : semanticSupportLinks.length
      ? semanticSupportLinks
      : links.slice(Math.min(4, links.length));
  const socialLinks = [
    { label: "Instagram", href: footer ? setting(footer, "instagramUrl", "") : "", icon: Instagram },
    { label: "Facebook", href: footer ? setting(footer, "facebookUrl", "") : "", icon: Facebook },
    { label: "Pinterest", href: footer ? setting(footer, "pinterestUrl", "") : "", icon: Pin },
    { label: "YouTube", href: footer ? setting(footer, "youtubeUrl", "") : "", icon: Youtube }
  ].filter((item) => item.href);
  const footerColumns = [
    { heading: footer ? setting(footer, "productHeading", "Product") : "Product", items: productLinks },
    { heading: footer ? setting(footer, "companyHeading", "Company") : "Company", items: companyLinks },
    { heading: footer ? setting(footer, "supportHeading", "Support") : "Support", items: supportLinks }
  ].filter((column) => column.items.length);
  const brandMark =
    title
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.slice(0, 1))
      .join("")
      .toUpperCase() || title.slice(0, 2).toUpperCase();
  return (
    <footer className={dark ? "border-t border-white/8 px-5 pb-6 pt-10" : "border-t border-[#e7dccf] px-5 pb-6 pt-10"} style={{ background: footerBg, color: footerTextColor }}>
      <div className="mx-auto max-w-[var(--site-content-width)]">
        <div className={dark ? "grid gap-8 border-b border-white/8 pb-8 lg:grid-cols-[0.3fr_0.7fr]" : "grid gap-8 border-b border-[#e8ddd0] pb-8 lg:grid-cols-[0.3fr_0.7fr]"}>
          <div className="max-w-[24rem]">
            <div className="flex items-center gap-3.5">
              {logoImageUrl ? (
                <img className="h-12 w-12 shrink-0 rounded-full object-cover" src={mediaAssetUrl(site, logoImageUrl)} alt={logoAlt} />
              ) : (
                <span className={dark ? "inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white text-[10px] font-semibold tracking-[0.18em] text-[#14161a]" : "inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#171514] text-[10px] font-semibold tracking-[0.18em] text-white"}>
                  {brandMark}
                </span>
              )}
              <div>
                <h2 className="text-[1.85rem] font-semibold leading-none tracking-tight [font-family:var(--site-title-font)]">{title}</h2>
                <p className={dark ? "mt-1.5 text-[10px] uppercase tracking-[0.18em] text-white/44" : "mt-1.5 text-[10px] uppercase tracking-[0.18em] text-[#8f7d6d]"}>
                  {tagline}
                </p>
              </div>
            </div>
            <p className={dark ? "mt-4 max-w-md text-[0.9rem] leading-6 text-white/64" : "mt-4 max-w-md text-[0.9rem] leading-6 text-[#625d56]"}>
              {body}
            </p>
            {socialLinks.length ? (
              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                {socialLinks.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      className={dark ? "inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/74 transition hover:border-white/22 hover:bg-white/[0.08]" : "inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#ddd2c5] bg-white/80 text-[#171514] transition hover:bg-white"}
                      href={item.href}
                      key={item.label}
                    >
                      <Icon className="h-4 w-4" strokeWidth={1.8} />
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
          <div className="grid gap-7 sm:grid-cols-2 xl:grid-cols-4">
            {footerColumns.map((column) => (
              <div key={column.heading}>
                <h3 className={dark ? "text-[0.9rem] font-semibold tracking-wide text-white" : "text-[0.9rem] font-semibold tracking-wide text-[#171514]"}>{column.heading}</h3>
                <div className="mt-3.5 grid gap-2">
                  {column.items.map((link, index) => (
                    <Link
                      className={dark ? "flex min-h-10 items-center text-[0.9rem] text-white/62 transition hover:text-white" : "flex min-h-10 items-center text-[0.9rem] text-[#625d56] transition hover:text-[#171514]"}
                      href={hrefFor(site, link.href)}
                      key={`${link.label}_${link.href}_${column.heading}`}
                      {...xfcartBlockAttrs(link.block, index, `footer_nav_${slugify(column.heading)}`)}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
            <div>
              <h3 className={dark ? "text-[0.9rem] font-semibold tracking-wide text-white" : "text-[0.9rem] font-semibold tracking-wide text-[#171514]"}>
                {footer ? setting(footer, "socialHeading", "Follow Us") : "Follow Us"}
              </h3>
              <p className={dark ? "mt-3.5 text-[0.9rem] leading-6 text-white/62" : "mt-3.5 text-[0.9rem] leading-6 text-[#625d56]"}>
                {footer ? setting(footer, "socialBody", "Private uploads, live pricing, predictable credits, and finished delivery inside one customer account.") : "Private uploads, live pricing, predictable credits, and finished delivery inside one customer account."}
              </p>
            </div>
          </div>
        </div>
        <div className={dark ? "mt-5 flex flex-col gap-2 text-[11px] text-white/42 sm:flex-row sm:items-center sm:justify-between" : "mt-5 flex flex-col gap-2 text-[11px] text-[#8c7f72] sm:flex-row sm:items-center sm:justify-between"}>
          <p>{footer ? setting(footer, "copyright", "All rights reserved.") : "All rights reserved."}</p>
          <p>{footer ? setting(footer, "bottomLine", "Monthly credits, one-time top-ups, and site-scoped galleries in one storefront.") : "Monthly credits, one-time top-ups, and site-scoped galleries in one storefront."}</p>
        </div>
      </div>
    </footer>
  );
}

function setting(section: SectionInstance, key: string, fallback = ""): string {
  const value = themeValueToString(section.settings[key], "");
  return value.trim() ? value : fallback;
}

function selectorIdSetting(section: SectionInstance, key: string, fallback = ""): string {
  const value = section.settings[key];
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const id = value.id;
    if (typeof id === "string" && id.trim()) return id.trim();
    if (typeof id === "number") return String(id);
  }
  return setting(section, key, fallback);
}

function listSetting(section: SectionInstance, key: string, fallback: string[] = []): string[] {
  return themeValueToList(section.settings[key], fallback);
}

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

function sectionBlocks(section: SectionInstance, type?: string): SectionBlockInstance[] {
  const blocks = section.blocks ?? [];
  return type ? blocks.filter((block) => block.type === type) : blocks;
}

function saasGlobalSection(settings: ThemeSettings, key: "header_plus" | "footer_plus"): SectionInstance | undefined {
  const sections = settings.saasSettingsCurrent?.sections;
  if (!sections || typeof sections !== "object" || Array.isArray(sections)) return undefined;
  const section = sections[key];
  if (!section || typeof section !== "object" || Array.isArray(section)) return undefined;
  return section as unknown as SectionInstance;
}

function saasBool(value: ThemeSettingValue | undefined, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true";
  return fallback;
}

function settingBool(section: SectionInstance, key: string, fallback: boolean): boolean {
  const value = section.settings[key];
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true";
  return fallback;
}

function sectionSurface(section: SectionInstance, fallback: string): string {
  return setting(section, "surface", fallback);
}

function customerStatusLabel(status: ThemeRuntimeData["jobs"][number]["status"]): string {
  if (status === "queued") return "Waiting";
  if (status === "running") return "Creating";
  if (status === "succeeded") return "Delivered";
  if (status === "failed") return "Needs review";
  return "Credits returned";
}

function customerStatusNarrative(status: ThemeRuntimeData["jobs"][number]["status"]): string {
  if (status === "queued") return "The request is in the private queue and ready to start.";
  if (status === "running") return "The scene pack is actively rendering and credits remain held.";
  if (status === "succeeded") return "The request is complete and the delivered images are now in the gallery.";
  if (status === "failed") return "The request needs review before the next delivery attempt.";
  return "Held credits were returned to the customer balance.";
}

function customerRequestTitle(job: ThemeRuntimeData["jobs"][number], index = 0): string {
  const suffix = job.id.split("_").filter(Boolean).at(-1);
  return `Album request ${suffix ? suffix.toUpperCase() : String(index + 1).padStart(2, "0")}`;
}

function customerLedgerLabel(type: string): string {
  if (type === "grant") return "Credits added";
  if (type === "reserve") return "Credits held";
  if (type === "consume") return "Credits used";
  if (type === "release") return "Credits returned";
  return "Balance adjusted";
}

function customerAlbumStatusLabel(status: ThemeRuntimeData["albums"][number]["status"]): string {
  if (status === "ready") return "Ready";
  if (status === "processing") return "Preparing";
  return "Archived";
}

function customerAssetReviewLabel(status: ThemeRuntimeData["assets"][number]["reviewStatus"]): string {
  if (status === "approved") return "Ready";
  if (status === "pending") return "Reviewing";
  return "Needs review";
}

function storefrontSectionLabel(type: string): string {
  const labels: Record<string, string> = {
    collection_list_plus: "Collections",
    products_plus: "Offers",
    feature_columns: "Highlights",
    image_text: "Story",
    two_images: "Gallery",
    three_images: "Gallery",
    four_images: "Gallery",
    logo_bar: "Trusted by",
    reviews: "Reviews",
    slogan: "Studio note",
    newsletter: "Updates"
  };
  return labels[type] ?? type.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function mediaAssetUrl(site: Site, value: string): string {
  return resolveMediaAssetUrl(site, value);
}

function runtimeCollectionImage(
  site: Site,
  section: SectionInstance,
  explicit: string | undefined,
  fallbackSeed: string
): string {
  const candidate = explicit || setting(section, "imageUrl", "");
  return candidate ? mediaAssetUrl(site, candidate) : fallbackImageForSeed(fallbackSeed);
}

function assetPreviewUrl(site: Site, assetIdOrKey: string | undefined, runtime?: ThemeRuntimeData): string {
  const lookup = assetIdOrKey?.trim();
  if (!lookup) return "";
  const runtimeAsset = runtime?.assets.find((asset) => asset.id === lookup || asset.previewUrl === lookup);
  if (runtimeAsset) {
    return runtimeAsset.previewUrl;
  }
  return mediaAssetUrl(site, lookup);
}

function albumPreviewUrl(site: Site, album: ThemeRuntimeData["albums"][number], runtime?: ThemeRuntimeData): string {
  const byCover = assetPreviewUrl(site, album.coverAssetId, runtime);
  if (byCover) return byCover;

  if (album.sourceJobId) {
    const jobOutput = runtime?.assets.find((asset) => asset.role === "output" && asset.jobId === album.sourceJobId);
    if (jobOutput) return assetPreviewUrl(site, jobOutput.id, runtime);
  }

  const creativePackMatch = runtime?.assets.find((asset) => asset.role === "output");
  if (creativePackMatch) return assetPreviewUrl(site, creativePackMatch.id, runtime);

  return fallbackImageForSeed(`${site.slug}-${album.id}-album`);
}

function priceMetaNumber(price: SiteProduct["prices"][number] | undefined, key: string, fallback: number): number {
  const raw = price?.metadata?.[key];
  if (typeof raw === "number") return raw;
  if (typeof raw === "string" && raw.trim()) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function priceMetaString(price: SiteProduct["prices"][number] | undefined, key: string, fallback: string): string {
  const raw = price?.metadata?.[key];
  if (typeof raw === "string" && raw.trim()) return raw;
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
  return fallback;
}

function priceMetaBool(price: SiteProduct["prices"][number] | undefined, key: string, fallback: boolean): boolean {
  const raw = price?.metadata?.[key];
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "string") return raw === "true";
  return fallback;
}

function importedThemeBadge(schema: ReturnType<typeof getSectionSchema>) {
  if (schema.source === "saas-theme1" || schema.source === "saas-theme") {
    return "Theme section";
  }
  return schema.label;
}

function firstImage(section: SectionInstance): string {
  const settingImage = ["imageUrl", "mediaAssetId", "src", "image", "mobile_src", "bg_image"].map((key) => setting(section, key)).find(Boolean);
  if (settingImage) return settingImage;
  for (const block of sectionBlocks(section)) {
    const image = ["imageUrl", "mediaAssetId", "src", "image", "mobile_src", "bg_image"].map((key) => blockValue(block, key)).find(Boolean);
    if (image) return image;
  }
  return "";
}

function settingListBlocks(
  section: SectionInstance,
  key: string,
  fallback: string[],
  mapper: (item: string, index: number) => SectionBlockInstance
): SectionBlockInstance[] {
  const blocks = sectionBlocks(section);
  if (blocks.length) return blocks;
  return listSetting(section, key, fallback).map(mapper);
}

function routedSitePath(site: Site, path = "/"): string {
  const normalizedPath = !path || path === "/" ? "/" : path.startsWith("/") ? path : `/${path}`;
  const basePath = (site as RoutedSite).__storefrontBasePath;
  if (typeof basePath === "string") {
    if (!basePath) return normalizedPath;
    return normalizedPath === "/" ? basePath : `${basePath}${normalizedPath}`;
  }
  return hostAwareSitePath(site, normalizedPath);
}

function hrefFor(site: Site, href: string): string {
  if (!href) return routedSitePath(site);
  if (href === "javascript:void(0);") return "#";
  if (href.startsWith("#") || href.startsWith("http")) return href;
  const legacyPrefix = `/site/${site.slug}`;
  if (href === legacyPrefix) return routedSitePath(site, "/");
  if (href.startsWith(`${legacyPrefix}/`)) return routedSitePath(site, href.slice(legacyPrefix.length));
  return routedSitePath(site, href);
}

function sitePathFromPage(site: Site, pageType: string): string {
  const page = site.pages.find((item) => item.pageType === pageType) ?? site.pages.find((item) => item.slug === "/");
  return page?.slug ?? "/";
}

function queryValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function queryInt(value: string | string[] | undefined, fallback: number): number {
  const parsed = Number.parseInt(queryValue(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function pageQueryHref(
  site: Site,
  pagePath: string,
  query: Record<string, string | string[] | undefined>,
  updates: Record<string, string | number | undefined>,
  hash?: string
): string {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined) return;
    const values = Array.isArray(value) ? value : [value];
    values.forEach((item) => {
      if (item) params.append(key, item);
    });
  });
  Object.entries(updates).forEach(([key, value]) => {
    params.delete(key);
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const search = params.toString();
  return `${hrefFor(site, pagePath || "/")}${search ? `?${search}` : ""}${hash ? `#${hash}` : ""}`;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function pageHeroImage(site: Site, page: Site["pages"][number], fallback: string): string {
  const image =
    Object.values(page.publishedJson.sections)
      .flatMap((section) => [setting(section, "imageUrl"), setting(section, "mediaAssetId"), setting(section, "src"), firstImage(section)])
      .find(Boolean) || fallback;
  return mediaAssetUrl(site, image);
}

function siteSearchCards(
  site: Site,
  products: SiteProduct[],
  siteAiApps: ReturnType<typeof import("@/lib/data").getSiteAiApps>,
  creativePacks: CreativePack[],
  pages: Site["pages"]
): SearchResultCard[] {
  const productCards = activeProducts(products).map((product, index) => {
    const price = productPrice(product);
    return {
      id: product.id,
      kind: "product" as const,
      title: product.name,
      description:
        product.type === "subscription"
          ? "Recurring credits, private albums, and customer access."
          : "One-time credits for more generation volume.",
      imageUrl: productImage(site, product, index),
      href: productHref(site, product),
      meta: price ? `${formatCurrency(price.amountCents, price.currency)} / ${price.creditsGranted} credits` : product.type,
      keywords: [product.name, product.type, price?.label ?? "", "pricing", "credits"]
    };
  });

  const packCardsList = creativePacks
    .filter((pack) => pack.status === "active")
    .map((pack) => ({
      id: pack.id,
      kind: "pack" as const,
      title: pack.name,
      description: pack.description || pack.headline,
      imageUrl: packImage(site, pack),
      href: `/tools/${pack.aiAppSlug}`,
      meta: `${pack.outputCount} images / ${pack.creditCost} credits`,
      keywords: [pack.name, pack.category, pack.headline, pack.description, pack.aiAppSlug]
    }));

  const toolCards = siteAiApps
    .filter((item) => item.enabled)
    .map((item, index) => ({
      id: item.id,
      kind: "tool" as const,
      title: item.aiApp.name,
      description: item.aiApp.description,
      imageUrl: fallbackImageForSeed(`${site.slug}-${item.aiApp.slug}-${index}`),
      href: `/tools/${item.aiApp.slug}`,
      meta: `${item.creditCost} credits / private album request`,
      keywords: [item.aiApp.name, item.aiApp.slug, item.aiApp.description, item.routeKey, item.aiApp.appType]
    }));

  const contentPages = pages
    .filter((page) => ["/help", "/blog", "/pricing", "/collections", "/search"].includes(page.slug) || page.slug.startsWith("/policies/"))
    .map((page, index) => ({
      id: page.id,
      kind: "page" as const,
      title: page.title,
      description:
        Object.values(page.publishedJson.sections)
          .map((section) => setting(section, "subtitle") || setting(section, "body") || setting(section, "text"))
          .find(Boolean) || `${page.title} page`,
      imageUrl: pageHeroImage(site, page, fallbackImageForSeed(`${site.slug}-${slugify(page.slug)}-${index}`)),
      href: page.slug,
      meta: page.pageType,
      keywords: [page.title, page.slug, page.pageType]
    }));

  return [...productCards, ...packCardsList, ...toolCards, ...contentPages];
}

function searchCardsForQuery(cards: SearchResultCard[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return cards;
  return cards.filter((card) =>
    [card.title, card.description, card.meta, ...card.keywords]
      .join(" ")
      .toLowerCase()
      .includes(normalized)
  );
}

function selectedCartProduct(products: SiteProduct[], query: Record<string, string | string[] | undefined>) {
  const active = activeProducts(products);
  const selectedProductId = queryValue(query.product);
  const selectedPriceId = queryValue(query.price);
  const product =
    active.find((item) => item.id === selectedProductId || item.prices.some((price) => price.id === selectedPriceId)) ??
    active[0];
  const price =
    product?.prices.find((item) => item.id === selectedPriceId) ??
    (product ? productPrice(product) : undefined);
  return { product, price };
}

function collectionPageCards(
  site: Site,
  creativePacks: CreativePack[],
  query: Record<string, string | string[] | undefined>
): CollectionPageCard[] {
  const selectedCategory = queryValue(query.category).toLowerCase();
  const selectedAiApp = queryValue(query.app).toLowerCase();
  const activePacks = creativePacks.filter((pack) => pack.status === "active");
  const filteredPacks = activePacks.filter((pack) => {
    if (selectedCategory && pack.category.toLowerCase() !== selectedCategory) return false;
    if (selectedAiApp && pack.aiAppSlug.toLowerCase() !== selectedAiApp) return false;
    return true;
  });
  return (filteredPacks.length ? filteredPacks : activePacks).map((pack) => ({
    id: pack.id,
    title: pack.name,
    description: pack.description || pack.headline,
    meta: `${pack.outputCount} images`,
    credits: `${pack.creditCost} credits`,
    imageUrl: packImage(site, pack),
    href: `/tools/${pack.aiAppSlug}`
  }));
}

const fallbackHeroImages = [
  "/assets/dreamshoot/generated/20260618/headshot-lifestyle-v1.png",
  "/assets/dreamshoot/generated/20260619/cyberpunk-solo-city-v1.png",
  "/assets/dreamshoot/beauty-portrait-gpt2.png"
];

const accentBlue = "#2f6fed";
const accentBlueSoft = "#dbe7ff";
const accentBlueDeep = "#173a8a";
const accentCopper = "#b9773f";
const accentForest = "#3f6b50";
const dreamshootPurple = "#7A4CFF";
const dreamshootMagenta = "#EC4BDD";
const dreamshootCyan = "#16DCF0";
const dreamshootOrange = "#FFA644";
const dreamshootBg = "#05070E";
const dreamshootSurface = "#10111A";
const dreamshootGlass = "rgba(18, 18, 28, 0.86)";
const dreamshootBrandGradient = `linear-gradient(90deg, ${dreamshootOrange} 0%, ${dreamshootMagenta} 38%, ${dreamshootPurple} 68%, ${dreamshootCyan} 100%)`;
const googleIconPath = "/assets/brand/google-g.svg";
const paperWarm = "#f4f1eb";
const panelWarm = "#fbfaf7";
const borderWarm = "#d8d2c7";
const inkBase = "#14161a";
const inkMuted = "#6f716f";

function brandInitials(title: string): string {
  if (/dreamshoot/i.test(title)) return "DS";
  const words = title
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "DS";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words
    .slice(0, 2)
    .map((part) => part.slice(0, 1))
    .join("")
    .toUpperCase();
}

const packImages: Record<string, string> = {
  headshots: "/assets/dreamshoot/generated/20260618/headshot-lifestyle-v1.png",
  fashion: "/assets/dreamshoot/editorial-headshot-gpt2.png",
  creative: "/assets/dreamshoot/generated/20260619/cyberpunk-solo-city-v1.png",
  creator: "/assets/dreamshoot/generated/20260618/headshot-lifestyle-v1.png",
  gala: "/assets/dreamshoot/generated/20260619/mafia-noir-single-v1.png",
  sports: "/assets/dreamshoot/generated/20260621-worldcup-pack/stadium-portrait.png",
  seasonal: "/assets/dreamshoot/generated/20260621-worldcup-pack/friend-fan-photos.png",
  beauty: "/assets/dreamshoot/beauty-portrait-gpt2.png",
  travel: "/assets/dreamshoot/generated/20260619/nature-adventure-solo-v1.png",
  avatar: "/assets/dreamshoot/generated/20260619/cyberpunk-solo-city-v1.png",
  copy: "/assets/dreamshoot/editorial-headshot-gpt2.png"
};

const dreamshootToolSceneDefaults = {
  banner: "/assets/dreamshoot/generated/20260619/mafia-noir-single-v1.png",
  entry: "/assets/dreamshoot/generated/20260619/cyberpunk-solo-city-v1.png",
  upload: "/assets/dreamshoot/frames/faq-intro-portrait.png",
  form: "/assets/dreamshoot/generated/20260618/hairstyle-preview-v1.png",
  progress: "/assets/dreamshoot/generated/20260618/headshot-lifestyle-v1.png",
  album: "/assets/dreamshoot/generated/20260619/mafia-noir-single-v1.png"
} as const;

function dreamshootToolBlock(
  id: string,
  title: string,
  description: string,
  category: string,
  imageUrl: string,
  href = "/tools/image-studio",
  badge = "Free"
): SectionBlockInstance {
  return {
    id,
    type: "tool_card",
    settings: {
      title,
      description,
      category,
      badge,
      imageUrl,
      href
    }
  };
}

function dreamshootDefaultMegaToolBlocks(): SectionBlockInstance[] {
  return [
    dreamshootToolBlock("mega_tool_headshot", "Professional headshot maker", "Create clean profile portraits for resumes, teams, and founder pages.", "Photo AI", packImages.headshots, "/tools/image-studio", "Profile"),
    dreamshootToolBlock("mega_tool_creator", "Creator portrait studio", "Generate creator-ready profile photos, channel visuals, and campaign portraits.", "Photo AI", packImages.creator, "/tools/image-studio", "Creator"),
    dreamshootToolBlock("mega_tool_worldcup", "World Cup fan photos", "Build stadium scenes, fan posters, and match-day profile images.", "Photo AI", packImages.sports, "/tools/image-studio", "Sports"),
    dreamshootToolBlock("mega_tool_cyberpunk", "Cyberpunk portrait maker", "Turn source selfies into neon city portraits and dramatic future looks.", "Photo AI", packImages.creative, "/tools/image-studio", "Scene"),
    dreamshootToolBlock("mega_tool_gala", "Gala photo maker", "Create formal night-out portraits with polished editorial lighting.", "Photo AI", packImages.gala, "/tools/image-studio", "Style"),
    dreamshootToolBlock("mega_tool_noir", "Noir character portraits", "Generate cinematic mafia, detective, and vintage city character looks.", "Photo AI", packImages.gala, "/tools/image-studio", "Noir"),
    dreamshootToolBlock("mega_tool_anime", "Anime avatar builder", "Create stylized profile avatars and character-inspired social images.", "Photo AI", packImages.avatar, "/tools/image-studio", "Avatar"),
    dreamshootToolBlock("mega_tool_nature", "Nature adventure photos", "Place the customer in scenic outdoor, hiking, and travel-inspired scenes.", "Photo AI", packImages.sports, "/tools/image-studio", "Outdoor"),
    dreamshootToolBlock("mega_tool_fashion", "Fashion editorial set", "Create magazine-style outfit stories and polished personal-brand images.", "Photo AI", packImages.fashion, "/tools/image-studio", "Editorial"),
    dreamshootToolBlock("mega_tool_product", "Product lifestyle photos", "Preview creator product shots, social commerce visuals, and campaign scenes.", "Photo AI", packImages.copy, "/tools/image-studio", "Commerce"),
    dreamshootToolBlock("mega_edit_background", "Background changer", "Replace a plain selfie background before ordering a full photo package.", "AI Photo Edit", dreamshootToolSceneDefaults.entry),
    dreamshootToolBlock("mega_edit_remove_bg", "Background remover", "Cut out product or portrait backgrounds for cleaner source images.", "AI Photo Edit", dreamshootToolSceneDefaults.upload),
    dreamshootToolBlock("mega_edit_magic_eraser", "Magic eraser", "Remove small distractions from portraits, cards, and generated scenes.", "AI Photo Edit", dreamshootToolSceneDefaults.form),
    dreamshootToolBlock("mega_edit_enhancer", "Photo enhancer", "Improve low-light uploads before using them for private model training.", "AI Photo Edit", packImages.headshots),
    dreamshootToolBlock("mega_edit_retouch", "Portrait retouch", "Clean skin, flyaways, and lighting without changing the customer's identity.", "AI Photo Edit", packImages.beauty),
    dreamshootToolBlock("mega_edit_unblur", "Unblur image", "Rescue soft phone shots before they enter a paid generation workflow.", "AI Photo Edit", dreamshootToolSceneDefaults.progress),
    dreamshootToolBlock("mega_edit_color", "Color correction", "Balance tones for profile photos, posters, and package previews.", "AI Photo Edit", packImages.fashion),
    dreamshootToolBlock("mega_edit_restore", "Old photo restoration", "Repair faded family photos and prepare them for private album delivery.", "AI Photo Edit", packImages.copy),
    dreamshootToolBlock("mega_edit_prompt", "Edit by prompt", "Describe a focused edit and preview it before spending package credits.", "AI Photo Edit", dreamshootToolSceneDefaults.entry),
    dreamshootToolBlock("mega_edit_upscale", "Magic upscaler", "Preview higher-resolution delivery for finished photos and profile images.", "AI Photo Edit", packImages.copy),
    dreamshootToolBlock("mega_video_image", "Image to video concept", "Turn a finished photo package image into a short motion concept.", "Video AI", dreamshootToolSceneDefaults.progress, "/tools/image-studio", "Preview"),
    dreamshootToolBlock("mega_video_profile", "Profile clip maker", "Create social profile motion from headshots or creator portraits.", "Video AI", packImages.headshots, "/tools/image-studio", "Social"),
    dreamshootToolBlock("mega_video_fan", "Fan poster motion", "Animate World Cup fan posters and match-day profile scenes.", "Video AI", packImages.sports, "/tools/image-studio", "Sports"),
    dreamshootToolBlock("mega_video_intro", "Creator intro video", "Turn creator portraits into short intro clips for profiles and reels.", "Video AI", packImages.creator, "/tools/image-studio", "Creator"),
    dreamshootToolBlock("mega_video_product", "Product teaser clip", "Create simple motion ideas for product-style package outputs.", "Video AI", packImages.copy, "/tools/image-studio", "Commerce"),
    dreamshootToolBlock("mega_video_avatar", "Animated avatar preview", "Preview avatar-style motion concepts for profile campaigns.", "Video AI", packImages.avatar, "/tools/image-studio", "Avatar"),
    dreamshootToolBlock("mega_video_fashion", "Fashion reel starter", "Create short reel concepts from editorial and try-on package outputs.", "Video AI", packImages.fashion, "/tools/image-studio", "Style"),
    dreamshootToolBlock("mega_video_album", "Album story video", "Turn favorite generated images into a compact customer album story.", "Video AI", dreamshootToolSceneDefaults.album, "/tools/image-studio", "Album")
  ];
}

function getDreamshootToolBlocks(blocks: SectionBlockInstance[] | undefined): SectionBlockInstance[] {
  const configured = (blocks ?? []).filter((block) => block.type === "tool_card");
  return configured.length ? configured : dreamshootDefaultMegaToolBlocks();
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
  return [Camera, ImageIcon, Heart, Globe2, Users, PackageOpen][index % 6];
}

function DreamShootMegaToolsPanel({
  site,
  tools,
  ctaLabel,
  ctaHref,
  variant = "section"
}: {
  site: Site;
  tools: SectionBlockInstance[];
  ctaLabel: string;
  ctaHref: string;
  variant?: "section" | "popover";
}) {
  const categories = Array.from(new Set(tools.map((tool) => blockValue(tool, "category", "Photo AI"))));
  const orderedCategories = ["Photo AI", "AI Photo Edit", "Video AI"].filter((category) => categories.includes(category));
  const extraCategories = categories.filter((category) => !orderedCategories.includes(category));
  const displayCategories = [...orderedCategories, ...extraCategories].slice(0, 3);
  const groupedCategories = displayCategories.map((category) => ({
    category,
    items: tools.filter((tool) => blockValue(tool, "category", "Photo AI") === category),
    meta: dreamshootMegaCategoryMeta(category)
  }));
  return (
    <div
      className={
        variant === "popover"
          ? "overflow-hidden rounded-[18px] border border-[#263247] bg-[#070708]/[0.99] p-4 text-white shadow-[0_34px_110px_-52px_rgba(0,0,0,0.95)] ring-1 ring-white/[0.04] backdrop-blur-xl"
          : "overflow-hidden rounded-[20px] border border-[#263247] bg-[#070708] p-4 text-white shadow-[0_34px_110px_-62px_rgba(0,0,0,0.88)] ring-1 ring-white/[0.04]"
      }
    >
      <div className="mb-4 text-center text-[0.98rem] font-semibold tracking-tight text-white sm:text-[1.02rem]">
        Studio tools
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {groupedCategories.map((group) => {
          const Icon = group.meta.icon;
          return (
            <Link
              className="group flex min-h-[110px] gap-3 rounded-[14px] border border-[#2b374c] bg-[#090a0c] px-4 py-4 text-left transition hover:border-white/28 hover:bg-white/[0.04]"
              href={hrefFor(site, `/tools#${slugify(group.category)}`)}
              key={`mega_card_${group.category}`}
            >
              <span
                className="mt-0.5 grid h-12 w-12 shrink-0 place-items-center rounded-full text-white shadow-[0_18px_46px_-28px_rgba(0,0,0,0.9)]"
                style={{ background: `linear-gradient(135deg, ${group.meta.accent}, #2f6fed)` }}
              >
                <Icon className="h-5.5 w-5.5" strokeWidth={2} />
              </span>
              <span className="min-w-0">
                <span className="block text-[1.04rem] font-semibold leading-tight text-white">{group.meta.title}</span>
                <span className="mt-2 block text-[0.92rem] leading-6 text-white/72">{group.meta.description}</span>
              </span>
            </Link>
          );
        })}
      </div>
      <div className="mt-5 grid gap-6 border-t border-[#263247] pt-5 lg:grid-cols-[1.22fr_1fr_1fr]">
        {groupedCategories.map((group, categoryIndex) => {
          return (
            <div key={`mega_group_${group.category}`} id={slugify(group.category)}>
              <h3 className="mb-3 text-[0.94rem] font-semibold" style={{ color: group.meta.accent }}>
                {group.meta.panelTitle}
              </h3>
              <div className={categoryIndex === 0 ? "grid gap-x-5 gap-y-3 sm:grid-cols-2 lg:gap-y-3" : "grid gap-3"}>
                {group.items.map((tool, index) => {
                  const Icon = dreamshootToolIcon(index, group.category);
                  return (
                    <Link
                      className="group/tool flex min-h-8 items-start gap-2.5 text-[0.94rem] leading-6 text-white/82 transition hover:text-white"
                      href={hrefFor(site, blockValue(tool, "href", "/tools/image-studio"))}
                      key={instanceKey(tool, index, "dreamshoot_mega_tool")}
                      {...xfcartBlockAttrs(tool, index, "dreamshoot_mega_tool")}
                    >
                      <Icon className="mt-0.5 h-4.5 w-4.5 shrink-0 text-white/72 transition group-hover/tool:text-white" strokeWidth={1.8} />
                      <span>{blockValue(tool, "title", "AI photo tool")}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-5 border-t border-[#263247] pt-3 text-center">
        <Link className="inline-flex items-center gap-2 text-sm font-semibold text-[#ff8a2f] transition hover:text-[#ffa45d]" href={hrefFor(site, ctaHref)}>
          {ctaLabel}
          <ArrowRight className="h-4 w-4" strokeWidth={1.9} />
        </Link>
      </div>
    </div>
  );
}

function parseTriplet(item: string): [string, string, string] {
  const [title = item, text = "", meta = ""] = item.split("|");
  return [title, text, meta];
}

function parseFaq(item: string): [string, string] {
  const [question = item, answer = ""] = item.split("|");
  return [question, answer];
}

function listLines(value: string): string[] {
  return value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function sectionAnchor(section: SectionInstance, fallback: string): string {
  return setting(section, "anchor", String(fallback)).replace(/^#/, "").replace(/[^a-zA-Z0-9_-]/g, "-");
}

function numberSetting(section: SectionInstance, key: string, fallback: number): number {
  const value = Number(themeValueToString(section.settings[key], ""));
  return Number.isFinite(value) ? value : fallback;
}

function blockNumber(block: SectionBlockInstance, key: string, fallback: number): number {
  const value = Number(themeValueToString(block.settings[key], ""));
  return Number.isFinite(value) ? value : fallback;
}

function imageHeightClass(value: string): string {
  if (value === "small") return "min-h-[360px]";
  if (value === "large") return "min-h-[660px]";
  if (value === "origin") return "min-h-[420px]";
  return "min-h-[520px]";
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function richTextHtml(section: SectionInstance, key: string, fallback: string): { __html: string } {
  const html = setting(section, key, fallback);
  return { __html: html };
}

function productPrice(product: SiteProduct): SiteProduct["prices"][number] | undefined {
  return product.prices.find((price) => price.interval === "month") ?? product.prices[0];
}

function productImage(site: Site, product: SiteProduct, index: number): string {
  const seed = `${site.slug}-${product.id}-${index}`;
  if (product.type === "subscription") return fallbackImageForSeed(`${seed}-studio`);
  return fallbackImageForSeed(`${seed}-credits`);
}

function packImage(site: Site, pack: CreativePack): string {
  if (pack.imageUrl) return mediaAssetUrl(site, pack.imageUrl);
  return packImages[pack.category] ?? packImages.fashion;
}

function productHref(site: Site, product: SiteProduct): string {
  return product.type === "subscription" ? hrefFor(site, "/pricing") : hrefFor(site, "/login");
}

function activeProducts(products: SiteProduct[]): SiteProduct[] {
  const active = products.filter((product) => product.status === "active");
  return active.length ? active : products;
}

function selectedProduct(section: SectionInstance, products: SiteProduct[]): SiteProduct | undefined {
  const productId = selectorId(section.settings.product);
  return activeProducts(products).find((product) => product.id === productId) ?? activeProducts(products)[0];
}

function selectedPackCards(site: Site, section: SectionInstance, creativePacks: CreativePack[], maxCount = 6) {
  const collectionId = selectorId(section.settings.collection);
  const selected = creativePacks.find((pack) => pack.id === collectionId);
  if (selected) {
    return [{
      id: selected.id,
      title: selected.name,
      description: selected.description || selected.headline,
      imageUrl: packImage(site, selected),
      href: `/tools/${selected.aiAppSlug}`,
      meta: `${selected.outputCount} images`,
      price: `${selected.creditCost} credits`
    }];
  }
  return packCards(site, creativePacks, maxCount);
}

function selectorId(value: ThemeSettingValue | undefined): string {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const id = value.id;
    if (typeof id === "string" || typeof id === "number") return String(id);
  }
  return themeValueToString(value, "");
}

function packCards(site: Site, creativePacks: CreativePack[], maxCount = 6) {
  const active = creativePacks.filter((pack) => pack.status === "active");
  return (active.length ? active : creativePacks).slice(0, maxCount).map((pack) => ({
    id: pack.id,
    title: pack.name,
    description: pack.description || pack.headline,
    imageUrl: packImage(site, pack),
    href: `/tools/${pack.aiAppSlug}`,
    meta: `${pack.outputCount} images`,
    price: `${pack.creditCost} credits`
  }));
}

function dreamshootCatalogCardFromPack(site: Site, pack: CreativePack): DreamShootCatalogCard {
  return {
    id: pack.id,
    title: pack.name,
    description: pack.description || pack.headline,
    category: pack.category,
    meta: `${pack.outputCount} photos`,
    credits: `${pack.creditCost} credits`,
    imageUrl: packImage(site, pack),
    href: `/tools/${pack.aiAppSlug}`
  };
}

function dreamshootCatalogCardFromBlock(site: Site, block: SectionBlockInstance): DreamShootCatalogCard {
  return {
    id: block.id,
    title: blockValue(block, "title", "Photo package"),
    description: blockValue(block, "description", "A private AI photo package with album-ready outputs."),
    category: blockValue(block, "category", "Package"),
    meta: blockValue(block, "meta", "20 photos"),
    credits: blockValue(block, "credits", "20 credits"),
    imageUrl: mediaAssetUrl(site, blockValue(block, "imageUrl", packImages.creator)),
    href: blockValue(block, "href", "/tools/image-studio")
  };
}

function dreamshootFeaturedCatalogScore(card: DreamShootCatalogCard): number {
  const title = card.title.toLowerCase();
  const category = card.category.toLowerCase();
  if (title.includes("world cup")) return 0;
  if (title.includes("headshot")) return 1;
  if (title.includes("hairstyle")) return 2;
  if (title.includes("cyberpunk")) return 3;
  if (title.includes("gala")) return 4;
  if (title.includes("mafia")) return 5;
  if (title.includes("nature")) return 6;
  if (category.includes("creator") || title.includes("creator")) return 7;
  if (category.includes("wedding") || category.includes("couple") || category.includes("boudoir") || category.includes("cultural")) return 20;
  return 10;
}

function dreamshootCategorySlug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "all";
}

function dreamshootCategoryLabel(value: string): string {
  const normalized = value.toLowerCase().replace(/[_-]+/g, " ");
  if (normalized === "headshots") return "Headshots";
  if (normalized === "sports") return "Sports";
  if (normalized === "creator") return "Creator";
  if (normalized === "creative") return "Creative";
  if (normalized === "beauty") return "Beauty";
  if (normalized === "avatar") return "Avatar";
  if (normalized === "seasonal") return "Seasonal";
  if (normalized === "couple") return "Couple";
  if (normalized === "wedding") return "Wedding";
  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function youtubeEmbedUrl(url: string): string {
  if (!url) return "";
  const match = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{6,})/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : url;
}

function normalizeHexColor(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith("#")) return "";
  const hex = trimmed.slice(1);
  if (hex.length === 3) return `#${hex.split("").map((part) => `${part}${part}`).join("")}`;
  if (hex.length === 6) return `#${hex}`;
  return "";
}

function isDarkColor(value: string): boolean {
  const normalized = normalizeHexColor(value);
  if (!normalized) return false;
  const r = Number.parseInt(normalized.slice(1, 3), 16);
  const g = Number.parseInt(normalized.slice(3, 5), 16);
  const b = Number.parseInt(normalized.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.52;
}

function legacyImageItems(site: Site, section: SectionInstance, count: number): Array<{ imageUrl: string; href: string; title: string }> {
  return Array.from({ length: count }, (_, index) => {
    const n = index + 1;
    const image =
      setting(section, `image_url_${n}`) ||
      setting(section, `image_src_${n}`) ||
      setting(section, `imageUrl_${n}`) ||
      fallbackImageForSeed(`${site.slug}-${section.type}-${n}`);
    const href = setting(section, `link_to_url_${n}`, setting(section, `url_${n}`, "#"));
    return {
      imageUrl: mediaAssetUrl(site, image),
      href,
      title: `${setting(section, "title", section.type)} ${n}`
    };
  });
}

function renderLegacySaasSection({
  id,
  section,
  site,
  products,
  creativePacks,
  mode,
  renderContext,
  siteAiApps
}: {
  id: string;
  section: SectionInstance;
  site: Site;
  products: ReturnType<typeof import("@/lib/data").getSiteProducts>;
  creativePacks: CreativePack[];
  mode: "published" | "preview";
  renderContext: RenderContext;
  siteAiApps: ReturnType<typeof import("@/lib/data").getSiteAiApps>;
}) {
  const type = String(section.type);

  if (type === "slide" || type === "slide_plus" || type === "slide_banner") {
    const slides = sectionBlocks(section).length
      ? sectionBlocks(section)
      : [
          {
            id: `${id}_fallback_slide`,
            type: "banner",
            settings: {
              title: setting(section, "title", "Hero Banner"),
              sub_title: setting(section, "sub_title", site.branding.description),
              src: firstImage(section) || fallbackHeroImages[0],
              button_label: setting(section, "button_label", "Shop now"),
              slide_cta: setting(section, "slide_cta", "Shop now"),
              url: setting(section, "url", "/login")
            }
          }
        ];
    const activeSlide = slides[0];
    const image = mediaAssetUrl(site, blockValue(activeSlide, "src", blockValue(activeSlide, "image", fallbackHeroImages[0])));
    const title = blockValue(activeSlide, "title", "Hero Banner");
    const subtitle = blockValue(activeSlide, "sub_title", site.branding.description);
    const cta = blockValue(activeSlide, "button_label", blockValue(activeSlide, "slide_cta", "Shop now"));
    const href = blockValue(activeSlide, "url", "/login");
    const opacity = Math.max(0, Math.min(90, blockNumber(activeSlide, "opacity", numberSetting(section, "opacity", 35))));
    return (
      <section className={`relative overflow-hidden bg-zinc-950 px-5 text-white ${imageHeightClass(setting(section, "img_height", "large"))}`} data-saas-section-renderer={type} id={sectionAnchor(section, id)}>
        <img className="absolute inset-0 h-full w-full object-cover" src={image} alt={title} />
        <div className="absolute inset-0" style={{ backgroundColor: blockValue(activeSlide, "image_overlay_color", "#151515"), opacity: opacity / 100 }} />
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/82 via-zinc-950/22 to-transparent" />
        <div className="relative mx-auto flex min-h-[inherit] max-w-[var(--site-content-width)] items-center">
          <div className="max-w-2xl py-20">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-white/58">{storefrontSectionLabel(type)}</p>
            <h1 className="mt-5 text-4xl font-semibold leading-none tracking-tight md:text-6xl" style={{ color: blockValue(activeSlide, "text_color", themeValueToString(section.settings.slide_text_color, "#ffffff")) }}>
              {title}
            </h1>
            {subtitle ? <p className="mt-5 max-w-xl text-base leading-8 text-white/72">{subtitle}</p> : null}
            {cta ? (
              <Link className="mt-8 inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium" href={hrefFor(site, href)} style={{ background: blockValue(activeSlide, "button_bg_color", themeValueToString(section.settings.slide_button_background_color, "#ffffff")), color: blockValue(activeSlide, "button_text_color", themeValueToString(section.settings.slide_button_label_color, "#111111")) }}>
                {cta}
                <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
              </Link>
            ) : null}
          </div>
        </div>
        {slides.length > 1 ? (
          <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-2">
            {slides.slice(0, 8).map((slide, index) => (
              <span className={`h-1.5 rounded-full ${index === 0 ? "w-8 bg-white" : "w-2 bg-white/45"}`} key={instanceKey(slide, index, "slide_dot")} />
            ))}
          </div>
        ) : null}
      </section>
    );
  }

  if (type === "reveal_slide") {
    const slides = sectionBlocks(section).length
      ? sectionBlocks(section)
      : [
          {
            id: `${id}_fallback_reveal`,
            type: "banner",
            settings: {
              title: "Reveal the next scene",
              brief: site.branding.description,
              desc: "Reveal a photo pack, scene direction, or collection offer with a strong visual moment.",
              btn_text: "Start creating",
              url: "/login",
              src: fallbackHeroImages[1]
            }
          }
        ];
    const lead = slides[0];
    const image = mediaAssetUrl(site, blockValue(lead, "src", fallbackHeroImages[1]));
    return (
      <section className="overflow-hidden bg-[#11140f] px-5 py-16 text-white" data-saas-section-renderer={type} id={sectionAnchor(section, id)}>
        <div className="mx-auto grid max-w-[var(--site-content-width)] gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-white/55">Photo pack reveal</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight md:text-6xl">{blockValue(lead, "title", "Reveal the next scene")}</h2>
            <p className="mt-5 max-w-xl text-base leading-8 text-white/68">{blockValue(lead, "desc", blockValue(lead, "brief", site.branding.description))}</p>
            <Link className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-zinc-950" href={hrefFor(site, blockValue(lead, "url", "/login"))}>
              {blockValue(lead, "btn_text", "Start creating")}
              <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-[0.68fr_1fr]">
            {slides.slice(0, 3).map((slide, index) => (
              <div className={`overflow-hidden rounded-[1.25rem] border border-white/10 bg-white/10 ${index === 0 ? "sm:row-span-2" : ""}`} key={instanceKey(slide, index, "reveal_slide")} {...xfcartBlockAttrs(slide, index, "reveal_slide")}>
                <img className="h-full min-h-[220px] w-full object-cover opacity-90" src={mediaAssetUrl(site, blockValue(slide, "src", image))} alt={blockValue(slide, "title", `Reveal slide ${index + 1}`)} />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (type === "products" || type === "products_plus") {
    const maxCount = Number(setting(section, "max_count", "")) || numberSetting(section, "grid", 4) * numberSetting(section, "line_number", 1);
    const title = setting(section, "title", setting(section, "name", "Featured collection"));
    const productItems = activeProducts(products).slice(0, maxCount || 4);
    const cards = productItems.length
      ? productItems.map((product, index) => {
          const price = productPrice(product);
          return {
            id: product.id,
            title: product.name,
            description: product.type === "subscription" ? "Monthly AI studio subscription with recurring credits." : "One-time credits for extra AI photo generations.",
            imageUrl: productImage(site, product, index),
            href: productHref(site, product),
            meta: price ? `${price.creditsGranted} credits` : product.type,
            price: price ? formatCurrency(price.amountCents, price.currency) : ""
          };
        })
      : packCards(site, creativePacks, maxCount || 4);
    return (
      <section className="px-5 py-16" data-saas-section-renderer={type} id={sectionAnchor(section, id)}>
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--site-accent)]">Featured offers</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">{title}</h2>
            </div>
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">{mode === "preview" ? "Preview catalog" : "Available now"}</span>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((card, index) => (
              <Link className="group overflow-hidden rounded-[1.2rem] border border-black/10 bg-white transition hover:-translate-y-1" href={hrefFor(site, card.href)} key={card.id}>
                <div className="aspect-[4/5] overflow-hidden bg-zinc-200">
                  <img className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" src={card.imageUrl} alt={card.title} />
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">{card.meta}</span>
                    <span className="font-mono text-xs text-zinc-500">{card.price}</span>
                  </div>
                  <h3 className="mt-4 font-semibold">{card.title}</h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-600">{card.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (type === "product_detail") {
    const product = selectedProduct(section, products);
    const price = product ? productPrice(product) : undefined;
    const relatedTitle = setting(section, "relative_title", "You May Also Like");
    return (
      <section className="px-5 py-14" data-saas-section-renderer={type} id={sectionAnchor(section, id)}>
        <div className="mx-auto grid max-w-[var(--site-content-width)] gap-9 lg:grid-cols-[1fr_0.82fr] lg:items-start">
          <div className="grid gap-4 sm:grid-cols-[0.34fr_1fr]">
            <div className="hidden gap-3 sm:grid">
              {[0, 1, 2].map((index) => (
                <div className="aspect-square overflow-hidden rounded-[1rem] border border-black/10 bg-zinc-100" key={index}>
                  <img className="h-full w-full object-cover" src={product ? productImage(site, product, index) : fallbackImageForSeed(`${site.slug}-product-${index}`)} alt={product?.name ?? "Product image"} />
                </div>
              ))}
            </div>
            <div className="aspect-[4/5] overflow-hidden rounded-[1.5rem] border border-black/10 bg-zinc-200 shadow-diffusion">
              <img className="h-full w-full object-cover" src={product ? productImage(site, product, 4) : fallbackHeroImages[0]} alt={product?.name ?? "Product detail"} />
            </div>
          </div>
          <div className="rounded-[1.45rem] border border-black/10 bg-white p-6 shadow-[0_24px_80px_-62px_rgba(24,24,27,0.45)]">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--site-accent)]">Photo offer</p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">{product?.name ?? "AI photo subscription"}</h1>
            <p className="mt-4 text-sm leading-7 text-zinc-600">
              {product?.type === "credit_pack" ? "One-time credit pack for generation capacity." : "Subscription product bound to Stripe and recurring credits."}
            </p>
            <div className="mt-6 flex items-end justify-between gap-4 border-t border-black/10 pt-5">
              <div>
                <p className="font-mono text-3xl">{price ? formatCurrency(price.amountCents, price.currency) : "Price available soon"}</p>
                <p className="mt-1 text-xs text-zinc-500">{price ? `${price.creditsGranted} credits / ${price.interval === "month" ? "month" : "one time"}` : "No active price"}</p>
              </div>
              <span className="rounded-full bg-moss/10 px-3 py-1.5 text-xs font-medium text-moss">{setting(section, "is_stock_show", "true") === "false" ? "stock hidden" : "available"}</span>
            </div>
            <Link className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--site-primary-button)] px-5 py-3 text-sm font-medium text-[var(--site-primary-button-text)]" href={hrefFor(site, "/login")}>
              {setting(section, "add_cart_status", "true") === "false" ? "View plan" : "Subscribe or add credits"}
              <ShoppingCart className="h-4 w-4" strokeWidth={1.8} />
            </Link>
            <div className="mt-6 rounded-[1rem] bg-zinc-50 p-4">
              <p className="font-medium">{relatedTitle}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {packCards(site, creativePacks, 2).map((pack) => (
                  <Link className="rounded-xl border border-black/10 bg-white p-3 text-sm" href={hrefFor(site, pack.href)} key={pack.id}>
                    <span className="block font-medium">{pack.title}</span>
                    <span className="mt-1 block font-mono text-[11px] text-zinc-500">{pack.price}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (type === "collection_detail" || type === "collection_list" || type === "collection_list_plus" || type === "collection_slider" || type === "vertical_showcase_slider") {
    const title = setting(section, "name", setting(section, "title", type === "collection_detail" ? "Collection" : "Collection list"));
    const filters = sectionBlocks(section).filter((block) => block.type.includes("filter"));
    const cards = selectedPackCards(site, section, creativePacks, Number(setting(section, "limit", "8")) || 8);
    if (type === "vertical_showcase_slider") {
      return (
        <section className="px-5 py-16" data-saas-section-renderer={type} id={sectionAnchor(section, id)}>
          <div className="mx-auto grid max-w-[var(--site-content-width)] gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
            <div className="lg:sticky lg:top-28">
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--site-accent)]">Photo collections</p>
              <h2 className="mt-4 text-4xl font-semibold tracking-tight md:text-6xl">{title}</h2>
              <p className="mt-5 text-sm leading-7 text-zinc-600">A vertical product and collection showcase bound to this site's active creative packs.</p>
              <Link className="mt-7 inline-flex rounded-full bg-zinc-950 px-5 py-3 text-sm font-medium text-white" href={hrefFor(site, "/pricing")}>
                {setting(section, "button_label", "View all")}
              </Link>
            </div>
            <div className="grid gap-4">
              {cards.slice(0, Number(setting(section, "max_count", "4")) || 4).map((card, index) => (
                <Link className="group grid gap-4 overflow-hidden rounded-[1.2rem] border border-black/10 bg-white p-3 transition hover:-translate-y-1 md:grid-cols-[220px_1fr] md:items-center" href={hrefFor(site, card.href)} key={`${card.id}_${index}`}>
                  <img className="aspect-[4/3] w-full rounded-[0.9rem] object-cover" src={card.imageUrl} alt={card.title} />
                  <span className="p-2">
                    <span className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-400">{card.meta}</span>
                    <span className="mt-2 block text-xl font-semibold">{card.title}</span>
                    <span className="mt-2 line-clamp-2 block text-sm leading-6 text-zinc-600">{card.description}</span>
                    <span className="mt-4 block font-mono text-sm text-zinc-500">{card.price}</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      );
    }
    return (
      <section className="px-5 py-14" data-saas-section-renderer={type} id={sectionAnchor(section, id)}>
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
            <aside className="rounded-[1.25rem] border border-black/10 bg-white p-5">
              <div className="flex items-center gap-2">
                <Tags className="h-4 w-4 text-[var(--site-accent)]" strokeWidth={1.8} />
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Collection filters</p>
              </div>
              <div className="mt-5 grid gap-4">
                {(filters.length ? filters : [
                  { id: "default_filter_1", type: "tag_filter", settings: { title: "Style", tags: "creator,editorial,headshot" } },
                  { id: "default_filter_2", type: "price_filter", settings: { title: "Credits", tags: "0,20,40" } }
                ]).map((filter, index) => (
                  <div key={instanceKey(filter, index, "collection_filter")} {...xfcartBlockAttrs(filter, index, "collection_filter")}>
                    <p className="text-sm font-semibold">{blockValue(filter, "title", filter.type)}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {blockValue(filter, "tags", "all").split(",").filter(Boolean).map((tag) => (
                        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600" key={tag}>{tag.trim()}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </aside>
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--site-accent)]">{storefrontSectionLabel(type)}</p>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">{title}</h1>
              <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {cards.map((card) => (
                  <Link className="group overflow-hidden rounded-[1.2rem] border border-black/10 bg-white transition hover:-translate-y-1" href={hrefFor(site, card.href)} key={card.id}>
                    <div className="aspect-[4/5] overflow-hidden bg-zinc-200">
                      <img className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" src={card.imageUrl} alt={card.title} />
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold">{card.title}</h3>
                      <p className="mt-1 text-xs leading-5 text-zinc-500">{card.meta} / {card.price}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (type === "search") {
    const searchTerm = queryValue(renderContext.query.q);
    const cards = searchCardsForQuery(
      siteSearchCards(site, products, siteAiApps, creativePacks, renderContext.pages),
      searchTerm
    );
    return (
      <section className="px-5 py-14" data-saas-section-renderer={type} id={sectionAnchor(section, id)}>
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <div className="rounded-[1.4rem] border border-black/10 bg-white p-5">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--site-accent)]">Storefront search</p>
            <div className="mt-4 flex items-center gap-3 rounded-full border border-black/10 bg-zinc-50 px-4 py-3">
              <Search className="h-5 w-5 text-zinc-400" strokeWidth={1.8} />
              <span className="text-sm text-zinc-500">
                {searchTerm ? `Results for "${searchTerm}"` : "Search plans, packs, tools, and photo guides"}
              </span>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span className="rounded-full border border-black/10 bg-white px-3 py-1.5">{cards.length} results</span>
            <span className="rounded-full border border-black/10 bg-white px-3 py-1.5">private storefront</span>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.slice(0, 12).map((card) => (
              <Link className="rounded-[1.1rem] border border-black/10 bg-white p-4 transition hover:-translate-y-1" href={hrefFor(site, card.href)} key={card.id}>
                <img className="aspect-[4/3] w-full rounded-[0.8rem] object-cover" src={card.imageUrl} alt={card.title} />
                <h3 className="mt-4 font-semibold">{card.title}</h3>
                <p className="mt-1 text-xs text-zinc-500">{card.description}</p>
                <p className="mt-3 font-mono text-[11px] text-zinc-400">{card.meta}</p>
              </Link>
            ))}
          </div>
          {!cards.length ? (
            <div className="mt-8 rounded-[1.2rem] border border-dashed border-black/10 bg-white px-5 py-10 text-center text-sm text-zinc-500">
              No results in this site. Try plan, credits, photo packs, headshots, help, or blog.
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  if (type === "cart") {
    const active = activeProducts(products);
    const selectedProductId = queryValue(renderContext.query.product);
    const selectedPriceId = queryValue(renderContext.query.price);
    const hasExplicitSelection = Boolean(selectedProductId || selectedPriceId);
    const { product: selectedProduct, price: selectedPrice } = selectedCartProduct(products, renderContext.query);
    const productsForCart = hasExplicitSelection && selectedProduct ? [selectedProduct] : active.slice(0, 2);
    const estimatedCredits = productsForCart.reduce((sum, product) => {
      const linePrice = product.id === selectedProduct?.id ? selectedPrice : productPrice(product);
      return sum + (linePrice?.creditsGranted ?? 0);
    }, 0);
    const estimatedAmount = productsForCart.reduce((sum, product) => {
      const linePrice = product.id === selectedProduct?.id ? selectedPrice : productPrice(product);
      return sum + (linePrice?.amountCents ?? 0);
    }, 0);
    const currency = selectedPrice?.currency ?? productsForCart[0]?.prices[0]?.currency ?? site.currency;
    return (
      <section className="px-5 py-14" data-saas-section-renderer={type} id={sectionAnchor(section, id)}>
        <div className="mx-auto grid max-w-[var(--site-content-width)] gap-8 lg:grid-cols-[1fr_360px]">
          <div className="rounded-[1.4rem] border border-black/10 bg-white shadow-[0_24px_70px_-58px_rgba(24,24,27,0.22)]">
            <div className="border-b border-black/10 p-5">
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--site-accent)]">Checkout summary</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">{productsForCart.length ? "Your selected plan" : "Choose a plan first"}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Review your selected collection, credit grant, and checkout amount before the private album workflow begins.
              </p>
            </div>
            <div className="divide-y divide-black/10">
              {productsForCart.map((product, index) => {
                const price = product.id === selectedProduct?.id ? selectedPrice ?? productPrice(product) : productPrice(product);
                return (
                  <div className="grid gap-4 p-5 sm:grid-cols-[96px_1fr_auto] sm:items-center" key={product.id}>
                    <img className="aspect-square rounded-[0.9rem] object-cover" src={productImage(site, product, index)} alt={product.name} />
                    <div>
                      <p className="font-semibold">{product.name}</p>
                      <p className="mt-1 text-sm text-zinc-500">{price?.creditsGranted ?? 0} credits</p>
                      {product.id === selectedProduct?.id && hasExplicitSelection ? <p className="mt-1 text-xs font-mono text-[var(--site-accent)]">Selected from pricing/search</p> : null}
                    </div>
                    <p className="font-mono">{price ? formatCurrency(price.amountCents, price.currency) : ""}</p>
                  </div>
                );
              })}
              {!productsForCart.length ? (
                <div className="p-8 text-sm text-zinc-500">Open pricing to select a subscription or credit pack.</div>
              ) : null}
            </div>
          </div>
          <aside className="h-fit rounded-[1.4rem] border border-black/10 bg-zinc-950 p-6 text-white shadow-[0_24px_70px_-58px_rgba(24,24,27,0.34)]">
            <ShoppingCart className="h-6 w-6 text-white/70" strokeWidth={1.8} />
            <h3 className="mt-5 text-2xl font-semibold">Checkout summary</h3>
            <p className="mt-2 text-sm leading-6 text-stone-300">
              Credits are added after payment confirmation, so the account balance stays accurate.
            </p>
            <div className="mt-6 rounded-[1rem] border border-white/10 bg-white/[0.05] p-4">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-white/64">Items</span>
                <span>{productsForCart.length}</span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                <span className="text-white/64">Credits</span>
                <span>{estimatedCredits}</span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                <span className="text-white/64">Amount</span>
                <span>{estimatedAmount ? formatCurrency(estimatedAmount, currency) : "--"}</span>
              </div>
            </div>
            <Link className="mt-6 inline-flex w-full justify-center rounded-full bg-white px-4 py-3 text-sm font-medium text-zinc-950" href={hrefFor(site, "/pricing")}>
              Back to pricing
            </Link>
          </aside>
        </div>
      </section>
    );
  }

  if (type === "not_found") {
    const primaryCta = setting(section, "primaryCta", setting(section, "button_label", "Return home"));
    const primaryHref = setting(section, "primaryHref", setting(section, "button_link", "/"));
    const secondaryCta = setting(section, "secondaryCta", "");
    const secondaryHref = setting(section, "secondaryHref", "/collections");
    return (
      <section className="px-5 py-20" data-saas-section-renderer={type} id={sectionAnchor(section, id)}>
        <div className="mx-auto grid max-w-[var(--site-content-width)] gap-8 rounded-[1.6rem] border border-black/10 bg-white p-8 shadow-diffusion md:grid-cols-[0.6fr_1fr] md:items-center">
          <div className="grid h-28 w-28 place-items-center rounded-full bg-clay/10 text-clay">
            <AlertTriangle className="h-10 w-10" strokeWidth={1.8} />
          </div>
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--site-accent)]">{setting(section, "eyebrow", "404")}</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-6xl">{setting(section, "title", "Page not found")}</h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-600">{setting(section, "subtitle", setting(section, "body", "We could not find this photo studio page."))}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link className="inline-flex items-center gap-2 rounded-full bg-zinc-950 px-5 py-3 text-sm font-medium text-white" href={hrefFor(site, primaryHref)}>
                {primaryCta}
                <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
              </Link>
              {secondaryCta ? (
                <Link className="inline-flex items-center gap-2 rounded-full border border-black/10 px-5 py-3 text-sm font-medium text-zinc-700" href={hrefFor(site, secondaryHref)}>
                  {secondaryCta}
                  <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (type === "page_detail" || type === "blog") {
    return (
      <section className="px-5 py-16" data-saas-section-renderer={type} id={sectionAnchor(section, id)}>
        <article className="mx-auto max-w-4xl rounded-[1.4rem] border border-black/10 bg-white p-7 shadow-[0_24px_80px_-62px_rgba(24,24,27,0.42)]">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--site-accent)]">{type === "blog" ? "Photo guide" : "Photo page"}</p>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-6xl">{setting(section, "title", type === "blog" ? "Journal article" : "Page detail")}</h1>
          <div className="mt-6 text-base leading-8 text-zinc-600" dangerouslySetInnerHTML={richTextHtml(section, "text", setting(section, "body", "Photo planning, album delivery, and account guidance appear here."))} />
        </article>
      </section>
    );
  }

  if (type === "overlay_image") {
    const image = mediaAssetUrl(site, setting(section, "image_src", fallbackHeroImages[0]));
    const opacity = Math.max(0, Math.min(100, numberSetting(section, "opacity", 25)));
    const title = setting(section, "title", site.branding.logoText);
    const text = stripHtml(setting(section, "text", site.branding.description));
    const button = setting(section, "button_label");
    const content = (
      <div className="relative flex min-h-[520px] items-center justify-center px-5 py-16 text-center text-white">
        <img className="absolute inset-0 h-full w-full object-cover" src={image} alt={title} />
        <div className="absolute inset-0" style={{ backgroundColor: setting(section, "overlay_bg_color", "rgba(0,0,0,1)"), opacity: opacity / 100 }} />
        <div className="relative mx-auto max-w-3xl" style={{ color: setting(section, "text_color", "#ffffff") }}>
          <p className="font-mono text-xs uppercase tracking-[0.22em] opacity-70">Photo story</p>
          {title ? <h2 className="mt-4 text-4xl font-semibold tracking-tight md:text-6xl">{title}</h2> : null}
          {text ? <p className="mt-5 text-base leading-8 opacity-80">{text}</p> : null}
          {button ? (
            <span className="mt-7 inline-flex rounded-full px-5 py-3 text-sm font-medium" style={{ background: setting(section, "button_bg_color", "#ffffff"), color: setting(section, "button_text_color", "#111111") }}>
              {button}
            </span>
          ) : null}
        </div>
      </div>
    );
    const href = setting(section, "link_to_url", setting(section, "button_link", ""));
    return (
      <section data-saas-section-renderer={type} id={sectionAnchor(section, id)}>
        {href ? <Link href={hrefFor(site, href)}>{content}</Link> : content}
      </section>
    );
  }

  if (type === "image_text") {
    const image = mediaAssetUrl(site, setting(section, "image", fallbackHeroImages[1]));
    const layout = setting(section, "layout", "left");
    const text = stripHtml(setting(section, "desc", setting(section, "text", site.branding.description)));
    const imageNode = (
      <div className="aspect-[4/3] overflow-hidden rounded-[1.45rem] border border-black/10 bg-zinc-200 shadow-diffusion">
        <img className="h-full w-full object-cover" src={image} alt={setting(section, "title", "Image with text")} />
      </div>
    );
    const copyNode = (
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--site-accent)]">Photo story</p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">{setting(section, "title", "Heading")}</h2>
        <p className="mt-5 max-w-xl text-sm leading-7 text-zinc-600">{text}</p>
        {setting(section, "button_label") ? (
          <Link className="mt-7 inline-flex items-center gap-2 rounded-full bg-zinc-950 px-5 py-3 text-sm font-medium text-white" href={hrefFor(site, setting(section, "button_link", setting(section, "link_to_url", "/login")))}>
            {setting(section, "button_label")}
            <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
          </Link>
        ) : null}
      </div>
    );
    return (
      <section className="px-5 py-16" data-saas-section-renderer={type} id={sectionAnchor(section, id)}>
        <div className="mx-auto grid max-w-[var(--site-content-width)] gap-8 md:grid-cols-2 md:items-center">
          {layout === "right" ? copyNode : imageNode}
          {layout === "right" ? imageNode : copyNode}
        </div>
      </section>
    );
  }

  if (type === "two_images" || type === "three_images" || type === "four_images") {
    const count = type === "two_images" ? 2 : type === "three_images" ? 3 : 4;
    const items = legacyImageItems(site, section, count);
    return (
      <section className="px-5 py-14" data-saas-section-renderer={type} id={sectionAnchor(section, id)}>
        <div className="mx-auto max-w-[var(--site-content-width)]">
          {setting(section, "title") ? <h2 className="mb-7 text-3xl font-semibold tracking-tight">{setting(section, "title")}</h2> : null}
          <div className={`grid gap-4 ${count === 2 ? "md:grid-cols-2" : count === 3 ? "md:grid-cols-3" : "md:grid-cols-4"}`}>
            {items.map((item, index) => (
              <Link className="group aspect-[4/5] overflow-hidden rounded-[1.2rem] border border-black/10 bg-zinc-200" href={hrefFor(site, item.href)} key={`${item.title}_${index}`}>
                <img className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" src={item.imageUrl} alt={item.title} />
              </Link>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (type === "feature_columns" || type === "reviews" || type === "slogan") {
    const title = setting(section, "title", type === "reviews" ? "Reviews" : "");
    const blocks = sectionBlocks(section);
    return (
      <section className="px-5 py-16" data-saas-section-renderer={type} id={sectionAnchor(section, id)}>
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--site-accent)]">{storefrontSectionLabel(type)}</p>
          {title ? <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight md:text-5xl">{title}</h2> : null}
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {(blocks.length ? blocks : [{ id: "fallback", type: "text_block", settings: { title: "Story block", text: "Add guidance, proof, or collection details for the photo pack experience.", image: "" } }]).map((block, index) => {
              const image = mediaAssetUrl(site, blockValue(block, "image", blockValue(block, "src", fallbackImageForSeed(`${site.slug}-${type}-${index}`))));
              return (
                <article className="overflow-hidden rounded-[1.25rem] border border-black/10 bg-white" key={instanceKey(block, index, "feature_column")} {...xfcartBlockAttrs(block, index, "feature_column")}>
                  {saasBool(block.settings.enable_image, true) ? (
                    <div className="aspect-[16/11] bg-zinc-200">
                      <img className="h-full w-full object-cover" src={image} alt={blockValue(block, "title", block.type)} />
                    </div>
                  ) : null}
                  <div className="p-5">
                    <h3 className="text-lg font-semibold">{blockValue(block, "title", blockValue(block, "name", block.type))}</h3>
                    <p className="mt-2 text-sm leading-6 text-zinc-600">{stripHtml(blockValue(block, "text", blockValue(block, "content", "Add guidance, proof, or collection details for the photo pack experience.")))}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  if (type === "logo_bar") {
    const blocks = sectionBlocks(section);
    return (
      <section className="border-y border-black/10 bg-white px-5 py-12" data-saas-section-renderer={type} id={sectionAnchor(section, id)}>
        <div className="mx-auto max-w-[var(--site-content-width)]">
          {setting(section, "title") ? <h2 className="text-center text-2xl font-semibold">{setting(section, "title")}</h2> : null}
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
            {(blocks.length ? blocks : Array.from({ length: 6 }, (_, index) => ({ id: `logo_${index}`, type: "logo_image", settings: { image: "", link: "" } }))).map((block, index) => (
              <Link className="grid h-24 place-items-center rounded-[1rem] border border-black/10 bg-zinc-50 p-4 text-center font-mono text-xs uppercase tracking-[0.18em] text-zinc-500" href={hrefFor(site, blockValue(block, "link", "#"))} key={instanceKey(block, index, "logo")} {...xfcartBlockAttrs(block, index, "logo")}>
                {blockValue(block, "image") ? <img className="max-h-12 max-w-full object-contain" src={mediaAssetUrl(site, blockValue(block, "image"))} alt={`Logo ${index + 1}`} /> : `Brand ${index + 1}`}
              </Link>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (type === "newsletter") {
    return (
      <section className="px-5 py-16" data-saas-section-renderer={type} id={sectionAnchor(section, id)}>
        <div className="mx-auto grid max-w-[var(--site-content-width)] gap-8 rounded-[1.6rem] border border-black/10 bg-white p-8 shadow-diffusion md:grid-cols-[0.75fr_1fr] md:items-center">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--site-accent)]">Studio updates</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">{setting(section, "title", "Join our list")}</h2>
            <p className="mt-4 text-sm leading-7 text-zinc-600">{setting(section, "sub_title", "Subscribe for updates.")}</p>
          </div>
          <div className="flex items-center gap-3 rounded-full border border-black/10 bg-zinc-50 p-2">
            <Mail className="ml-3 h-5 w-5 text-zinc-400" strokeWidth={1.8} />
            <input className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="you@example.com" readOnly />
            <button className="rounded-full bg-zinc-950 px-5 py-3 text-sm font-medium text-white">{setting(section, "btn_title", "Subscribe")}</button>
          </div>
        </div>
      </section>
    );
  }

  if (type === "gallery" || type === "instagram_plus") {
    const blocks = sectionBlocks(section);
    return (
      <section className="px-5 py-16" data-saas-section-renderer={type} id={sectionAnchor(section, id)} style={{ background: type === "instagram_plus" ? setting(section, "ins_bg", "var(--site-muted)") : undefined }}>
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--site-accent)]">{storefrontSectionLabel(type)}</p>
          <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight md:text-5xl">{setting(section, "title", type === "instagram_plus" ? "Find us on Instagram" : "Gallery")}</h2>
          <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            {(blocks.length ? blocks : Array.from({ length: 4 }, (_, index) => ({ id: `gallery_${index}`, type: "banner", settings: { src: "", title: "" } }))).slice(0, 8).map((block, index) => {
              const image = mediaAssetUrl(site, blockValue(block, "src", fallbackImageForSeed(`${site.slug}-${type}-${index}`)));
              return (
                <Link className="group relative aspect-square overflow-hidden rounded-[1rem] border border-black/10 bg-zinc-200" href={hrefFor(site, blockValue(block, "link", "#"))} key={instanceKey(block, index, "gallery")} {...xfcartBlockAttrs(block, index, "gallery")}>
                  <img className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" src={image} alt={blockValue(block, "title", blockValue(block, "account_id", "Gallery image"))} />
                  {blockValue(block, "account_id") ? <span className="absolute bottom-3 left-3 rounded-full bg-white/82 px-3 py-1 text-xs font-medium backdrop-blur">@{blockValue(block, "account_id")}</span> : null}
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  if (type === "video" || type === "video_text") {
    const embedUrl = youtubeEmbedUrl(setting(section, "video", ""));
    return (
      <section className="px-5 py-16" data-saas-section-renderer={type} id={sectionAnchor(section, id)}>
        <div className="mx-auto grid max-w-[var(--site-content-width)] gap-8 md:grid-cols-[0.72fr_1fr] md:items-center">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--site-accent)]">Studio video</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">{setting(section, "video_title", setting(section, "title", "Video"))}</h2>
          </div>
          <div className="aspect-video overflow-hidden rounded-[1.4rem] border border-black/10 bg-zinc-950 shadow-diffusion">
            {embedUrl ? <iframe className="h-full w-full" src={embedUrl} title={setting(section, "video_title", "Video")} /> : (
              <div className="grid h-full place-items-center text-white">
                <PlayCircle className="h-12 w-12 text-white/70" strokeWidth={1.8} />
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  if (type === "html") {
    return (
      <section className="px-5 py-10" data-saas-section-renderer={type} id={sectionAnchor(section, id)}>
        <div className="mx-auto max-w-[var(--site-content-width)] overflow-hidden rounded-[1.1rem] border border-black/10 bg-white" dangerouslySetInnerHTML={richTextHtml(section, "html", "<div style='padding:48px;text-align:center'>HTML section</div>")} />
      </section>
    );
  }

  if (type === "feature_product" || type === "photo_collection") {
    const product = selectedProduct(section, products);
    return (
      <section className="px-5 py-16" data-saas-section-renderer={type} id={sectionAnchor(section, id)}>
        <div className="mx-auto grid max-w-[var(--site-content-width)] gap-8 rounded-[1.5rem] border border-black/10 bg-white p-6 shadow-diffusion md:grid-cols-[0.8fr_1fr] md:items-center">
          <img className="aspect-[4/3] w-full rounded-[1.15rem] object-cover" src={product ? productImage(site, product, 8) : fallbackHeroImages[0]} alt={product?.name ?? type} />
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--site-accent)]">{storefrontSectionLabel(type)}</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">{setting(section, "title", product?.name ?? "Featured product")}</h2>
            <p className="mt-5 text-sm leading-7 text-zinc-600">{setting(section, "desc", "Featured product content is bound to the current site data.")}</p>
            <Link className="mt-7 inline-flex items-center gap-2 rounded-full bg-zinc-950 px-5 py-3 text-sm font-medium text-white" href={product ? productHref(site, product) : hrefFor(site, "/pricing")}>
              Open item
              <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (type === "header_plus") {
    const blocks = sectionBlocks(section);
    const promoBlocks = blocks.filter((block) => block.type === "ads");
    return (
      <section className="border-b border-black/10 bg-white px-5 py-5" data-saas-section-renderer={type} id={sectionAnchor(section, id)}>
        <div className="mx-auto grid max-w-[var(--site-content-width)] gap-5">
          {saasBool(section.settings.is_announce_show, false) ? (
            <div className="rounded-full px-4 py-2 text-center text-xs font-medium" style={{ background: setting(section, "announce_bg_color", "#111111"), color: setting(section, "announce_color", "#ffffff") }}>
              {setting(section, "announce_title", "Announcement bar")}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link className="font-mono text-sm uppercase tracking-[0.22em]" href={hrefFor(site, "/")}>
              {setting(section, "shop_logo", site.branding.logoText)}
            </Link>
            <nav className="hidden items-center gap-5 text-sm text-zinc-600 md:flex">
              {["Home|/", "Pricing|/pricing", "Studio|/app"].map((item) => {
                const [label, href] = item.split("|");
                return <Link className="hover:text-zinc-950" href={hrefFor(site, href)} key={item}>{label}</Link>;
              })}
            </nav>
            <Menu className="h-5 w-5 text-zinc-500" strokeWidth={1.8} />
          </div>
          {promoBlocks.length ? (
            <div className="grid gap-3 md:grid-cols-3">
              {promoBlocks.slice(0, 3).map((block, index) => (
                <Link className="group overflow-hidden rounded-[1rem] border border-black/10 bg-zinc-50" href={hrefFor(site, blockValue(block, `link${index + 1}`, "/pricing"))} key={instanceKey(block, index, "header_ads")} {...xfcartBlockAttrs(block, index, "header_ads")}>
                  <img className="aspect-[16/9] w-full object-cover transition duration-500 group-hover:scale-[1.03]" src={mediaAssetUrl(site, blockValue(block, `image${index + 1}`, fallbackImageForSeed(`${site.slug}-header-${index}`)))} alt={blockValue(block, `title${index + 1}`, `Promotion ${index + 1}`)} />
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  if (type === "footer_plus") {
    const menuBlocks = sectionBlocks(section, "menu");
    const infoBlocks = sectionBlocks(section, "info");
    const newsletterBlocks = sectionBlocks(section, "newsletter");
    return (
      <section className="border-t border-black/10 px-5 py-12" data-saas-section-renderer={type} id={sectionAnchor(section, id)} style={{ background: setting(section, "footer_bg_color", "var(--site-bg)") }}>
        <div className="mx-auto grid max-w-[var(--site-content-width)] gap-8 md:grid-cols-[1fr_0.75fr_0.75fr]">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--site-accent)]">Studio footer</p>
            <h2 className="mt-4 text-2xl font-semibold">{site.branding.logoText}</h2>
            <div className="mt-4 text-sm leading-7 text-zinc-600" dangerouslySetInnerHTML={{ __html: blockValue(infoBlocks[0] ?? { id: "info", type: "info", settings: {} }, "richtext", site.branding.description) }} />
            <p className="mt-5 font-mono text-xs text-zinc-500">{setting(section, "copyright", "All rights reserved.")}</p>
          </div>
          <div>
            <h3 className="font-semibold">{blockValue(menuBlocks[0] ?? { id: "menu", type: "menu", settings: {} }, "title", "Menu")}</h3>
            <div className="mt-4 grid gap-2 text-sm text-zinc-600">
              {["Pricing|/pricing", "Studio|/app", "Help|/policies/content"].map((item) => {
                const [label, href] = item.split("|");
                return <Link className="hover:text-zinc-950" href={hrefFor(site, href)} key={item}>{label}</Link>;
              })}
            </div>
          </div>
          <div>
            <h3 className="font-semibold">{blockValue(newsletterBlocks[0] ?? { id: "newsletter", type: "newsletter", settings: {} }, "title", setting(section, "special_title", "Newsletter"))}</h3>
            <p className="mt-3 text-sm leading-6 text-zinc-600">{blockValue(newsletterBlocks[0] ?? { id: "newsletter", type: "newsletter", settings: {} }, "describe", setting(section, "special_desc", "Get new AI photoshoot drops and product updates."))}</p>
            <div className="mt-4 flex overflow-hidden rounded-full border border-black/10 bg-white">
              <input className="min-w-0 flex-1 px-4 py-3 text-sm outline-none" placeholder="Email address" />
              <button className="bg-zinc-950 px-4 text-sm font-medium text-white">Join</button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return null;
}

function SectionView({
  id,
  section,
  site,
  products,
  siteAiApps,
  creativePacks,
  runtime,
  mode,
  renderContext
}: {
  id: string;
  section: SectionInstance;
  site: Site;
  products: ReturnType<typeof import("@/lib/data").getSiteProducts>;
  siteAiApps: ReturnType<typeof import("@/lib/data").getSiteAiApps>;
  creativePacks: CreativePack[];
  runtime?: ThemeRuntimeData;
  mode: "published" | "preview";
  renderContext: RenderContext;
}) {
  const legacySaasSection = renderLegacySaasSection({ id, section, site, products, creativePacks, mode, renderContext, siteAiApps });
  if (legacySaasSection) return legacySaasSection;

  if (section.type === "hero") {
    const images = [
      setting(section, "imageUrl", fallbackHeroImages[0]),
      setting(section, "secondaryImageUrl", fallbackHeroImages[1]),
      setting(section, "tertiaryImageUrl", fallbackHeroImages[2])
    ].filter(Boolean).map((image) => mediaAssetUrl(site, image));
    const legacyImages = listSetting(section, "heroImages", fallbackHeroImages);
    const displayImages = images.length ? images : legacyImages;
    const ctas = sectionBlocks(section, "cta");
    const stats = sectionBlocks(section, "stat");
    const legacyStats = listSetting(section, "stats", ["20-40|photos per themed album", "Private|customer albums", "Secure|trusted checkout"]);
    if (setting(section, "layout", "editorial") === "studio_commerce") {
      const bullets = listLines(
        setting(
          section,
          "bulletList",
          "Private source-photo intake with clear upload rules|Photo packs tied to real credits and subscriptions|Before and after proof blocks customers understand instantly|Published storefront pages stay separate from design drafts"
        )
      )
        .map((item) => item.split("|")[0]?.split("-")[0]?.trim() || item.trim())
        .filter(Boolean);
      const heroStats = stats.length
        ? stats
        : legacyStats.map((item, index) => {
            const [value = item, label = ""] = item.split("|");
            return { id: `legacy_stat_${index}`, type: "stat", settings: { value, label } } as SectionBlockInstance;
          });
      const primaryImage = displayImages[0] ?? fallbackHeroImages[0];
      const heroVisual = setting(section, "heroVisualOverride", primaryImage);
      const primaryVisual = mediaAssetUrl(site, heroVisual);
      const avatarPool = [
        primaryVisual,
        displayImages[1] ?? primaryVisual,
        displayImages[2] ?? primaryVisual,
        displayImages[1] ?? primaryVisual,
        primaryVisual
      ];
      const primaryCta = ctas[0];
      const secondaryCta = ctas[1];
      return (
        <section className="relative isolate overflow-hidden border-b border-[#eee3d7] bg-[radial-gradient(circle_at_0%_20%,rgba(230,223,214,0.58),transparent_24%),linear-gradient(180deg,#fffdfa_0%,#faf5ee_100%)] text-[#111318]">
          <div className="absolute inset-0 -z-10 hidden bg-[linear-gradient(90deg,#fffdfa_0%,#fffaf4_42%,rgba(255,250,244,0)_62%)] lg:block" />
          <div className="absolute inset-y-0 right-0 -z-20 hidden w-[58%] lg:block">
            <img className="h-full w-full object-cover object-[58%_center]" src={primaryVisual} alt={setting(section, "imageBadge", "AI photo pack preview")} />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,#fffdfa_0%,rgba(255,250,244,0.86)_17%,rgba(255,250,244,0.32)_38%,rgba(255,250,244,0.04)_62%)]" />
            <div className="absolute inset-y-0 left-0 w-[18%] bg-gradient-to-r from-[#fffdfa] to-transparent" />
          </div>
          <div className="mx-auto grid max-w-[var(--site-content-width)] gap-0 px-5 pt-10 lg:min-h-[640px] lg:grid-cols-[0.52fr_0.48fr] lg:items-center lg:pt-0">
            <div className="relative z-10 max-w-[640px] pb-10 pt-2 lg:pb-12 lg:pt-0">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#ddd0c0] bg-white/86 px-5 py-2.5 text-[0.88rem] font-medium text-[#5f5952] shadow-[0_18px_44px_-40px_rgba(20,22,26,0.18)]">
                {setting(section, "eyebrow", "AI-generated photo studio")}
              </div>
              <h1
                className="mt-6 max-w-[15.4ch] text-[clamp(3.15rem,5.35vw,5.7rem)] font-semibold leading-[0.95] tracking-[-0.055em] text-[#171514] text-balance [font-family:var(--site-title-font)]"
                data-headline-text={setting(section, "headline")}
              >
                {setting(section, "headline", "AI photos that look like a real shoot")}
              </h1>
              <p className="mt-5 max-w-[32rem] text-[1.03rem] leading-[1.86] text-[#665f58]">
                {setting(section, "subheadline", "Turn everyday uploads into polished creator, portrait, travel, seasonal, and editorial photo packs.")}
              </p>
              <div className="mt-7 grid max-w-[35rem] gap-x-6 gap-y-3 sm:grid-cols-2">
                {bullets.slice(0, 4).map((item) => (
                  <div className="flex items-center gap-3 text-[0.96rem] text-[#514b45]" key={item}>
                    <span className="grid h-6.5 w-6.5 shrink-0 place-items-center rounded-full border border-[#d9c7b2] bg-white text-[#b47c42] shadow-[0_12px_28px_-24px_rgba(20,22,26,0.18)]">
                      <Check className="h-4 w-4" strokeWidth={2} />
                    </span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              {primaryCta || secondaryCta ? (
                <div className="mt-9 flex flex-wrap gap-4">
                  {primaryCta ? (
                    <Link className="inline-flex min-h-[56px] items-center justify-center rounded-[12px] bg-[#171514] px-8 text-[0.98rem] font-semibold text-white transition hover:-translate-y-0.5 active:scale-[0.98]" href={hrefFor(site, blockValue(primaryCta, "href", "/login"))} {...xfcartBlockAttrs(primaryCta, 0, "hero_cta")}>
                      {blockValue(primaryCta, "label", "See Examples")}
                    </Link>
                  ) : null}
                  {secondaryCta ? (
                    <Link className="inline-flex min-h-[56px] items-center justify-center rounded-[12px] border border-[#d8cec2] bg-white/88 px-8 text-[0.98rem] font-medium text-[#171514] transition hover:-translate-y-0.5 hover:bg-white active:scale-[0.98]" href={hrefFor(site, blockValue(secondaryCta, "href", "#workflow"))} {...xfcartBlockAttrs(secondaryCta, 1, "hero_cta")}>
                      {blockValue(secondaryCta, "label", "How It Works")}
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="relative z-10 min-h-[540px] overflow-hidden rounded-t-[24px] bg-[#efe6d9] lg:min-h-[640px] lg:rounded-none lg:bg-transparent">
              <img className="absolute inset-0 h-full w-full object-cover object-[58%_center] lg:hidden" src={primaryVisual} alt={setting(section, "imageBadge", "AI photo pack preview")} />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(250,245,237,0.04)_0%,rgba(20,18,15,0.06)_58%,rgba(20,18,15,0.12)_100%)] lg:hidden" />
              <div className="absolute bottom-7 right-4 w-[min(295px,calc(100%-2rem))] rounded-[24px] border border-[#ddd3c7] bg-white/92 p-5 text-[#171514] shadow-[0_32px_82px_-56px_rgba(20,22,26,0.26)] backdrop-blur sm:right-7 lg:bottom-[9.5rem] lg:right-0 xl:right-2">
                <div className="flex items-center gap-1 text-[#d39a4a]">
                  {Array.from({ length: 5 }).map((_, starIndex) => (
                    <span key={starIndex}>★</span>
                  ))}
                  <span className="ml-2 text-[0.98rem] font-medium text-[#4d4842]">{setting(section, "socialProofLabel", "4.9/5 from private photo customers").split(" from")[0]}</span>
                </div>
                <p className="mt-3 text-[1.08rem] leading-7 text-[#4f4a44]">
                  {setting(section, "socialProofLabel", "4.9/5 from private photo customers").includes("from")
                    ? setting(section, "socialProofLabel", "4.9/5 from private photo customers").replace(/^.*?from\s*/i, "From ")
                    : setting(section, "socialProofLabel", "Private photo customers")}
                </p>
                <div className="mt-4 flex -space-x-2.5">
                  {heroStats.slice(0, 5).map((item, index) => (
                    <div className="h-10 w-10 overflow-hidden rounded-full border-2 border-white bg-[#f2e8da]" key={instanceKey(item, index, "hero_avatar")}>
                      <img className="h-full w-full object-cover" src={avatarPool[index % avatarPool.length]} alt={blockValue(item, "label", `Customer ${index + 1}`)} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-[120px] bg-gradient-to-t from-[#f9f4ec] via-[#f9f4ec]/30 to-transparent lg:hidden" />
            </div>
          </div>
        </section>
      );
    }
    if (setting(section, "layout", "editorial") === "immersive_dark") {
      const bullets = listLines(setting(section, "bulletList", "Upload selfies and create your private AI model|Themed packs for headshots, travel, beauty, and style looks|AI video and virtual try-on add-ons|Private credits, albums, and downloads"))
        .map((item) => item.split("|")[0]?.split("-")[0]?.trim() || item.trim())
        .filter(Boolean);
      const primaryCta = ctas[0];
      const secondaryCta = ctas[1];
      const heroStats = stats.length
        ? stats
        : legacyStats.map((item, index) => {
            const [value = item, label = ""] = item.split("|");
            return { id: `legacy_stat_${index}`, type: "stat", settings: { value, label } } as SectionBlockInstance;
          });
      const proofBullets = bullets.slice(0, 4);
      const primaryImage = displayImages[0] ?? fallbackHeroImages[0];
      const gridImages = listSetting(section, "heroGridImages", [
        primaryImage,
        displayImages[1] ?? fallbackHeroImages[1],
        displayImages[2] ?? fallbackHeroImages[2],
        "/assets/dreamshoot/generated/20260619/mafia-noir-single-v1.png",
        "/assets/dreamshoot/frames/sample-professional-headshot.png",
        "/assets/dreamshoot/generated/20260619/cyberpunk-solo-city-v1.png",
        "/assets/dreamshoot/generated/20260621-worldcup-pack/stadium-portrait.png",
        "/assets/dreamshoot/generated/20260618/hairstyle-preview-v1.png"
      ])
        .filter(Boolean)
        .slice(0, 10)
        .map((image) => mediaAssetUrl(site, image));
      const imageBadge = setting(section, "imageBadge", blockValue(heroStats[0], "value", "40") ? `${blockValue(heroStats[0], "value", "40")} photo album` : "40 photo album");
      const imageCaption = setting(section, "imageCaption", "Private AI photo packs, ready for download.");
      return (
        <section className="dreamshoot-hero-motion relative isolate overflow-hidden border-b border-white/10 bg-[#05070E] px-5 text-white">
          <div className="absolute inset-0 -z-10">
            <div className="dreamshoot-hero-grid grid h-full min-h-[640px] grid-cols-3 gap-3 opacity-55 blur-[0.25px] sm:min-h-[740px] sm:grid-cols-4 sm:gap-4 lg:grid-cols-6">
              {Array.from({ length: Math.max(8, gridImages.length) }).map((_, index) => (
                <div
                  className={`dreamshoot-hero-tile overflow-hidden rounded-[18px] bg-zinc-900 shadow-[0_28px_70px_-52px_rgba(0,0,0,0.95)] sm:rounded-[22px] ${index % 5 === 0 ? "translate-y-7 sm:translate-y-9" : ""} ${index % 4 === 0 ? "sm:scale-[1.04] lg:scale-[1.08]" : ""}`}
                  key={`dreamshoot_hero_grid_${index}`}
                  style={{ animationDelay: `${-(index % 7) * 2.15}s` }}
                >
                  <img
                    className="dreamshoot-hero-image h-full min-h-[170px] w-full object-cover sm:min-h-[210px]"
                    src={gridImages[index % gridImages.length] ?? primaryImage}
                    alt=""
                    style={{ animationDelay: `${-(index % 5) * 3.4}s` }}
                  />
                </div>
              ))}
            </div>
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,7,14,0.99)_0%,rgba(5,7,14,0.92)_37%,rgba(5,7,14,0.62)_65%,rgba(5,7,14,0.86)_100%)]" />
            <div className="dreamshoot-hero-aurora absolute inset-0 bg-[radial-gradient(circle_at_19%_28%,rgba(122,76,255,0.34),transparent_30%),radial-gradient(circle_at_34%_58%,rgba(236,75,221,0.20),transparent_24%),radial-gradient(circle_at_76%_37%,rgba(22,220,240,0.18),transparent_27%),radial-gradient(circle_at_64%_11%,rgba(255,166,68,0.13),transparent_22%)]" />
            <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#05070E] to-transparent" />
          </div>
          <div className="pointer-events-none absolute inset-0 -z-10 opacity-65">
            {Array.from({ length: 16 }).map((_, index) => (
              <span
                className="dreamshoot-hero-particle absolute h-1.5 w-1.5 rounded-full shadow-[0_0_18px_rgba(255,255,255,0.55)]"
                key={`dreamshoot_particle_${index}`}
                style={{
                  background: [dreamshootCyan, dreamshootMagenta, dreamshootOrange, "#ffffff"][index % 4],
                  left: `${(index * 37) % 100}%`,
                  top: `${12 + ((index * 19) % 76)}%`,
                  animationDelay: `${-(index % 8) * 1.6}s`,
                  animationDuration: `${13 + (index % 5) * 2.5}s`
                }}
              />
            ))}
          </div>
          <div className="mx-auto grid min-h-[640px] max-w-[var(--site-content-width)] gap-7 py-10 sm:min-h-[710px] md:py-12 lg:grid-cols-[0.62fr_0.38fr] lg:items-center lg:py-14">
            <div className="relative z-10 flex max-w-[760px] flex-col justify-center">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/14 bg-white/[0.08] px-3.5 py-2 text-[12px] font-medium text-white/88 shadow-[0_18px_48px_-34px_rgba(22,220,240,0.6)] backdrop-blur">
                <span className="h-2 w-2 rounded-full shadow-[0_0_16px_rgba(22,220,240,0.9)]" style={{ background: dreamshootBrandGradient }} />
                {setting(section, "heroBadge", "Private AI portrait studio")}
              </div>
              <h1
                className="mt-6 max-w-[780px] text-[clamp(2.55rem,6vw,5.95rem)] font-semibold leading-[0.94] tracking-tight text-balance text-white [font-family:var(--site-title-font)] sm:leading-[0.92]"
                data-headline-text={setting(section, "headline")}
              >
                {(() => {
                  const headline = setting(section, "headline");
                  const highlight = setting(section, "highlightWord");
                  const parts = highlight ? headline.split(highlight) : [headline];
                  if (!highlight || parts.length < 2) return headline;
                  return (
                    <>
                      {parts[0]}
                      <span className="text-white">{highlight}</span>
                      {parts.slice(1).join(highlight)}
                    </>
                  );
                })()}
              </h1>
              <div className="mt-8 flex items-center gap-3">
                <span className="h-1.5 w-[min(260px,42vw)] rounded-full" style={{ background: dreamshootBrandGradient }} />
                <span className="h-4 w-4 rounded-full shadow-[0_0_24px_rgba(22,220,240,0.78)]" style={{ background: dreamshootCyan }} />
              </div>
              <p className="mt-7 max-w-[620px] text-[1.04rem] leading-7 text-white/82 md:text-lg md:leading-8">{setting(section, "subheadline")}</p>
              {primaryCta || secondaryCta ? (
                <div className="mt-7 flex flex-wrap gap-3">
                  {primaryCta ? (
                    <Link className="inline-flex items-center gap-2 rounded-[16px] px-5 py-3 text-sm font-semibold text-white shadow-[0_22px_54px_-32px_rgba(236,75,221,0.82)] transition hover:-translate-y-0.5 active:scale-[0.98]" href={hrefFor(site, blockValue(primaryCta, "href", "/login"))} style={{ background: dreamshootBrandGradient }}>
                      {blockValue(primaryCta, "label", "Start")}
                      <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                    </Link>
                  ) : null}
                  {secondaryCta ? (
                    <Link className="inline-flex items-center gap-2 rounded-[16px] border border-white/16 bg-black/20 px-5 py-3 text-sm font-medium text-white shadow-[inset_0_0_0_1px_rgba(22,220,240,0.25)] backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/[0.08] active:scale-[0.98]" href={hrefFor(site, blockValue(secondaryCta, "href", "/pricing"))}>
                      {blockValue(secondaryCta, "label", "Pricing")}
                      <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
                    </Link>
                  ) : null}
                </div>
              ) : null}
              <div className="mt-7 grid max-w-[650px] gap-x-5 gap-y-3 sm:mt-8 sm:grid-cols-2">
                {proofBullets.map((item) => (
                  <div className="inline-flex items-start gap-2 text-sm leading-6 text-white/80" key={item}>
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-white/18 bg-white/[0.05] shadow-[0_0_18px_-8px_rgba(22,220,240,0.9)]">
                      <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.8} style={{ color: dreamshootCyan }} />
                    </span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative z-10 hidden items-center justify-end md:flex">
              <div className="relative w-full max-w-[440px] rounded-[30px] p-[1px] shadow-[0_36px_100px_-48px_rgba(0,0,0,0.98),0_0_70px_-44px_rgba(22,220,240,0.92)]" style={{ background: dreamshootBrandGradient }}>
                <div className="rounded-[29px] p-4 text-white backdrop-blur-xl sm:p-7" style={{ background: dreamshootGlass }}>
                <div
                  className="inline-flex rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white shadow-[0_20px_45px_-28px_rgba(236,75,221,0.75)] sm:px-4 sm:py-2 sm:text-[12px]"
                  style={{ background: dreamshootBrandGradient }}
                >
                  {setting(section, "authRibbon", "New seasonal packs live")}
                </div>
                <div className="mt-4 rounded-[18px] border border-white/12 bg-white/[0.07] p-3 shadow-[inset_0_0_0_1px_rgba(122,76,255,0.14)] sm:mt-6 sm:p-4">
                  <p className="text-xs font-semibold text-white sm:text-sm">{imageBadge}</p>
                  <p className="mt-1.5 text-lg font-semibold leading-tight sm:mt-2 sm:text-2xl">{imageCaption}</p>
                </div>
                <div className="mt-4 grid gap-2.5 sm:mt-5 sm:gap-3">
                  <Link className="inline-flex min-h-[46px] items-center justify-center gap-3 rounded-[14px] border border-white/70 bg-white px-5 text-sm font-semibold text-[#090b13] shadow-[inset_0_0_0_1px_rgba(236,75,221,0.14),0_16px_42px_-34px_rgba(22,220,240,0.7)] transition hover:-translate-y-0.5 active:scale-[0.98] sm:min-h-[52px] sm:text-[1rem]" href={hrefFor(site, setting(section, "authPrimaryHref", "/login"))}>
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white shadow-[0_8px_22px_-14px_rgba(9,11,19,0.45)] ring-1 ring-black/[0.06]">
                      <img className="h-5 w-5" src={googleIconPath} alt="" aria-hidden="true" />
                    </span>
                    <span>{setting(section, "authPrimaryLabel", "Continue with Google")}</span>
                  </Link>
                  <div className="hidden grid-cols-[1fr_auto_1fr] items-center gap-3 text-xs text-white/54 sm:grid">
                    <span className="h-px bg-white/24" />
                    or
                    <span className="h-px bg-white/24" />
                  </div>
                  <div className="hidden gap-2 sm:grid">
                    <div className="rounded-[13px] border border-white/16 bg-white px-4 py-3 text-sm text-zinc-500 shadow-[inset_0_-1px_0_rgba(22,220,240,0.35)]">{setting(section, "authEmailPlaceholder", "Enter your email")}</div>
                    <Link className="inline-flex min-h-[48px] items-center justify-center rounded-[13px] px-5 text-sm font-semibold text-white shadow-[0_18px_48px_-32px_rgba(22,220,240,0.78)] transition hover:-translate-y-0.5 active:scale-[0.98]" href={hrefFor(site, setting(section, "authEmailHref", "/login"))} style={{ background: "linear-gradient(100deg, rgba(236,75,221,0.22), rgba(122,76,255,0.72), rgba(22,220,240,0.58))" }}>
                      {setting(section, "authButtonLabel", "Get Started with Email")}
                    </Link>
                  </div>
                </div>
                <div className="mt-4 rounded-[16px] border border-white/12 bg-white/[0.055] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:mt-5 sm:rounded-[18px] sm:px-4 sm:py-3">
                  <p className="text-xs font-semibold text-white sm:text-sm">{setting(section, "socialProofLabel", "4.9/5 from photo-package subscribers")}</p>
                  <p className="mt-1 hidden text-xs leading-5 text-white/58 sm:block">Credits, photo packages, private albums, and checkout stay tied to this storefront.</p>
                </div>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 mx-auto grid max-w-[var(--site-content-width)] grid-cols-3 gap-3 border-t border-white/14 py-5 text-white sm:gap-4">
            {heroStats.map((item, index) => (
              <div className="min-w-0" key={instanceKey(item, index, "hero_stat")} {...xfcartBlockAttrs(item, index, "hero_stat")}>
                <div className="text-[1.05rem] font-semibold tracking-tight text-white sm:font-mono sm:text-[1.15rem]">{blockValue(item, "value")}</div>
                <div className="mt-1 text-[11px] leading-4 text-white/58 sm:text-[12px] sm:leading-5">{blockValue(item, "label")}</div>
              </div>
            ))}
          </div>
          <div className="relative z-10 mx-auto max-w-[var(--site-content-width)] pb-7 md:hidden">
            <Link className="flex items-center justify-between rounded-[18px] border border-white/14 px-4 py-3 text-sm font-semibold text-white shadow-[0_22px_62px_-48px_rgba(0,0,0,0.9)] backdrop-blur" href={hrefFor(site, setting(section, "authPrimaryHref", "/login"))} style={{ background: "linear-gradient(100deg, rgba(236,75,221,0.22), rgba(122,76,255,0.46), rgba(22,220,240,0.3))" }}>
              <span>{setting(section, "imageBadge", "15+ package categories")}: {setting(section, "authPrimaryLabel", "Continue with Google")}</span>
              <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
            </Link>
          </div>
        </section>
      );
    }
    return (
      <section className="relative overflow-hidden border-b border-black/10 bg-[var(--site-bg)] px-5 py-12 md:py-16">
        <div className="absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(255,255,255,0))]" />
        <div className="mx-auto grid max-w-[var(--site-content-width)] gap-10 lg:grid-cols-[0.94fr_1.06fr] lg:items-center">
          <div className="relative z-10">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--site-accent)]">{setting(section, "eyebrow")}</p>
            <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-none tracking-tight text-balance [font-family:var(--site-title-font)] md:text-6xl">
              {setting(section, "headline")}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--site-body)]">{setting(section, "subheadline")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              {(ctas.length ? ctas : [
                { id: "primary", type: "cta", settings: { label: setting(section, "primaryCta", "Start"), href: "/login", style: "primary" } },
                { id: "secondary", type: "cta", settings: { label: setting(section, "secondaryCta", "Pricing"), href: "#packages", style: "secondary" } }
              ]).map((cta, index) => (
                <Link
                  className={
                    blockValue(cta, "style", index === 0 ? "primary" : "secondary") === "primary"
                      ? "inline-flex items-center gap-2 rounded-full bg-[var(--site-primary-button)] px-5 py-3 text-sm font-medium text-[var(--site-primary-button-text)] transition hover:-translate-y-0.5 active:scale-[0.98]"
                      : "inline-flex items-center gap-2 rounded-full border border-black/15 bg-[var(--site-secondary-button)] px-5 py-3 text-sm font-medium text-[var(--site-secondary-button-text)] transition hover:-translate-y-0.5 active:scale-[0.98]"
                  }
                  href={hrefFor(site, blockValue(cta, "href", index === 0 ? "/login" : "#packages"))}
                  key={instanceKey(cta, index, "hero_cta")} {...xfcartBlockAttrs(cta, index, "hero_cta")}
                >
                  {blockValue(cta, "label", index === 0 ? "Start" : "Pricing")}
                  {index === 0 ? <ArrowRight className="h-4 w-4" strokeWidth={1.8} /> : <ChevronRight className="h-4 w-4" strokeWidth={1.8} />}
                </Link>
              ))}
            </div>
            <div className="mt-10 grid max-w-2xl gap-3 sm:grid-cols-3">
              {(stats.length ? stats : legacyStats.map((item, index) => {
                const [value = item, label = ""] = item.split("|");
                return { id: `legacy_stat_${index}`, type: "stat", settings: { value, label } };
              })).map((item, index) => {
                const value = blockValue(item, "value");
                const label = blockValue(item, "label");
                return (
                  <div className="border-t border-black/10 pt-4" key={instanceKey(item, index, "hero_stat")} {...xfcartBlockAttrs(item, index, "hero_stat")}>
                    <div className="font-mono text-2xl tracking-tight">{value}</div>
                    <div className="mt-1 text-xs leading-5 text-zinc-600">{label}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="relative min-h-[560px]">
            <div className="absolute left-4 top-8 z-10 rounded-2xl border border-white/70 bg-white/75 px-4 py-3 shadow-diffusion backdrop-blur-md">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span className="h-2.5 w-2.5 rounded-full bg-moss" />
                Private model training
              </div>
              <p className="mt-1 font-mono text-xs text-zinc-500">{mode === "preview" ? "Preview" : "Live storefront"}</p>
            </div>
            <div className="grid h-full grid-cols-[0.9fr_1.1fr] gap-4">
              <div className="flex flex-col justify-end gap-4 pt-20">
                <div className="relative aspect-[4/5] overflow-hidden rounded-[1.7rem] border border-white/60 bg-zinc-200 shadow-diffusion">
                  <img className="h-full w-full object-cover" src={displayImages[1] ?? fallbackHeroImages[1]} alt="AI photo intake sample" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 text-white">
                    <p className="font-mono text-xs uppercase tracking-[0.18em]">upload</p>
                    <p className="mt-1 text-sm">Clear selfies become a private model.</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Credits held</span>
                    <span className="font-mono">16</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100">
                    <div className="h-full w-[64%] rounded-full bg-[var(--site-accent)]" />
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-4">
                <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] border border-white/70 bg-zinc-200 shadow-diffusion">
                  <img className="h-full w-full object-cover" src={displayImages[0] ?? fallbackHeroImages[0]} alt="Generated AI portrait album" />
                  <div className="absolute left-4 top-4 rounded-full bg-white/82 px-3 py-1.5 text-xs font-medium backdrop-blur">40 photo album</div>
                </div>
                <div className="grid grid-cols-[1fr_0.82fr] gap-4">
                  <div className="rounded-2xl bg-zinc-950 p-4 text-stone-50">
                    <Sparkles className="h-5 w-5 text-[var(--site-accent)]" strokeWidth={1.8} />
                    <p className="mt-4 text-xl font-semibold leading-tight">Editorial scene pack</p>
                    <p className="mt-2 text-xs leading-5 text-stone-300">Built for private photo delivery.</p>
                  </div>
                  <div className="relative overflow-hidden rounded-2xl border border-white/70 bg-zinc-200">
                    <img className="h-full min-h-40 w-full object-cover" src={displayImages[2] ?? fallbackHeroImages[2]} alt="AI headshot sample" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (section.type === "brand_logo_strip") {
    const items = sectionBlocks(section, "logo");
    const dark = setting(section, "style", "dark") === "dark";
    return (
      <section className={dark ? "border-y border-white/10 bg-[#0a0a0b] px-5 py-8 text-white" : "border-y border-black/10 bg-white px-5 py-8"} id={sectionAnchor(section, "trusted")}>
        <div className="mx-auto flex max-w-[var(--site-content-width)] flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <p className={dark ? "text-sm font-semibold text-white/72" : "text-sm font-semibold text-zinc-600"}>{setting(section, "title", "Trusted by reviews websites")}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {items.map((item, index) => {
              const name = blockValue(item, "name", "Brand");
              const image = mediaAssetUrl(site, blockValue(item, "imageUrl", ""));
              return (
                <div className={dark ? "flex min-h-[68px] items-center justify-center gap-3 rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-3 text-white/90" : "flex min-h-[68px] items-center justify-center gap-3 rounded-[18px] border border-black/10 bg-zinc-50 px-4 py-3 text-zinc-700"} key={instanceKey(item, index, "logo")} {...xfcartBlockAttrs(item, index, "logo")}>
                  {image ? <img className="h-7 max-w-[110px] object-contain" src={image} alt={name} /> : <span className="font-semibold tracking-tight">{name}</span>}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  if (section.type === "metric_strip") {
    const stats = sectionBlocks(section, "stat");
    const metrics = stats.length
      ? stats
      : ([
          { id: "metric_destinations", type: "stat", settings: { value: "100+", label: "Dream Destinations" } },
          { id: "metric_customers", type: "stat", settings: { value: "10,000+", label: "Happy Customers" } },
          { id: "metric_satisfaction", type: "stat", settings: { value: "99%", label: "Satisfaction Rate" } },
          { id: "metric_support", type: "stat", settings: { value: "24/7", label: "AI Support" } }
        ] as SectionBlockInstance[]);
    const tone = setting(section, "tone", "light");
    const dark = tone === "dark";
    const warm = tone === "warm";
    const topBorder = settingBool(section, "showTopBorder", true);
    const bottomBorder = settingBool(section, "showBottomBorder", true);
    const sectionClass = dark
      ? "bg-[#111114] text-white"
      : warm
      ? "bg-[#fbf7f1] text-[#171514]"
      : "bg-white text-[#171514]";
    const borderClass = dark ? "border-white/10" : warm ? "border-[#e2d8cd]" : "border-[#ece1d3]";
    return (
      <section className={`${sectionClass} px-5 py-0 ${topBorder ? `border-t ${borderClass}` : ""} ${bottomBorder ? `border-b ${borderClass}` : ""}`} id={sectionAnchor(section, "metrics")}>
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <div className={`grid gap-0 sm:grid-cols-2 lg:grid-cols-4 ${dark ? "rounded-none border-x border-white/10 bg-white/[0.03]" : "rounded-none border-x border-[#efe4d8] bg-white/32"}`}>
            {metrics.slice(0, 4).map((metric, index) => (
              <div
                className={
                  dark
                    ? `px-8 py-7 ${index > 0 ? "lg:border-l lg:border-white/10" : ""} ${index > 1 ? "sm:border-t sm:border-white/10 lg:border-t-0" : ""}`
                    : `px-8 py-7 ${index > 0 ? "lg:border-l lg:border-[#efe4d8]" : ""} ${index > 1 ? "sm:border-t sm:border-[#efe4d8] lg:border-t-0" : ""}`
                }
                key={instanceKey(metric, index, "metric_strip")}
                {...xfcartBlockAttrs(metric, index, "metric_strip")}
              >
                <div className="flex items-center gap-4">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#eadfce] bg-[#fffaf3] text-[#9a744b]">
                    {index === 0 ? <Sparkles className="h-4.5 w-4.5" strokeWidth={1.8} /> : index === 1 ? <Users className="h-4.5 w-4.5" strokeWidth={1.8} /> : index === 2 ? <Heart className="h-4.5 w-4.5" strokeWidth={1.8} /> : <Headset className="h-4.5 w-4.5" strokeWidth={1.8} />}
                  </span>
                  <div>
                    <p className="text-[2.2rem] font-semibold leading-none tracking-[-0.03em] text-[#171514] [font-family:var(--site-title-font)]">
                      {blockValue(metric, "value", "100+")}
                    </p>
                    <p className="mt-2 text-[0.95rem] leading-6 text-[#6f675f]">{blockValue(metric, "label", "Dream Destinations")}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (section.type === "story_mosaic") {
    const cards = sectionBlocks(section, "story_card");
    const dark = setting(section, "tone", "dark") === "dark";
    const lead = cards[0];
    const sideCards = cards.slice(1, 6);
    return (
      <section className={dark ? "bg-[#0a0a0b] px-5 py-16 text-white" : "bg-white px-5 py-16 text-zinc-950"} id={sectionAnchor(section, "story")}>
        <div className="mx-auto grid max-w-[var(--site-content-width)] items-start gap-8 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:gap-10">
          <div>
            <p className={dark ? "font-mono text-xs uppercase tracking-[0.22em]" : "font-mono text-xs uppercase tracking-[0.22em] text-[var(--site-accent)]"} style={dark ? { color: accentBlue } : undefined}>{setting(section, "eyebrow", "Featured story")}</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">{setting(section, "title")}</h2>
            <p className={dark ? "mt-5 max-w-xl text-sm leading-7 text-white/72" : "mt-5 max-w-xl text-sm leading-7 text-zinc-600"}>{setting(section, "subtitle")}</p>
            {lead ? (
              <div className="mt-8 overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] shadow-[0_28px_90px_-56px_rgba(0,0,0,0.8)]">
                <img className="aspect-[5/6] w-full object-cover lg:aspect-[4/4.6]" src={mediaAssetUrl(site, blockValue(lead, "imageUrl", fallbackHeroImages[0]))} alt={blockValue(lead, "label", "Featured")} />
              </div>
            ) : null}
            <Link className="mt-8 inline-flex items-center gap-2 rounded-[16px] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5" style={{ background: `linear-gradient(90deg, ${accentCopper}, ${accentBlue})` }} href={hrefFor(site, setting(section, "ctaHref", "/login"))}>
              {setting(section, "ctaLabel", "Create my AI photos")}
              <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
            </Link>
          </div>
          <div className="grid auto-rows-max content-start gap-4 grid-cols-2 xl:grid-cols-2">
            {sideCards.map((card, index) => (
              <article
                className={
                  dark
                    ? "self-start overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.04]"
                    : "self-start overflow-hidden rounded-[20px] border border-black/10 bg-zinc-50"
                }
                key={instanceKey(card, index, "story_card")}
                {...xfcartBlockAttrs(card, index, "story_card")}
              >
                <img
                  className="aspect-[4/5] w-full object-cover"
                  src={mediaAssetUrl(site, blockValue(card, "imageUrl", fallbackHeroImages[(index + 1) % fallbackHeroImages.length]))}
                  alt={blockValue(card, "label", "Story image")}
                />
                <div className="p-4">
                  <p className="font-medium">{blockValue(card, "label", "Story image")}</p>
                  <p className={dark ? "mt-1 text-xs text-white/55" : "mt-1 text-xs text-zinc-500"}>{blockValue(card, "meta", "Featured")}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (section.type === "destination_showcase") {
    const tabs = listLines(setting(section, "tabs", "All|Europe|Asia|Beach|Desert|City"));
    const defaultTab = setting(section, "defaultTab", "All").toLowerCase();
    const selectedTag = queryValue(renderContext.query.style || renderContext.query.category).toLowerCase() || defaultTab;
    const items = sectionBlocks(section, "destination");
    const cards = (items.length ? items : [
      { id: "destination_santorini", type: "destination", settings: { title: "Santorini", description: "Whitewashed cliffs, resort light, and polished travel portraits.", tag: "Europe", tags: "Europe|Beach", location: "Santorini, Greece", imageUrl: packImages.travel, href: "/collections" } },
      { id: "destination_bali", type: "destination", settings: { title: "Bali", description: "Lush tropical scene packs and quiet coastal light.", tag: "Beach", tags: "Asia|Beach", location: "Bali, Indonesia", imageUrl: packImages.travel, href: "/collections" } },
      { id: "destination_marrakech", type: "destination", settings: { title: "Marrakech", description: "Archways, sandstone tones, and cinematic shadows.", tag: "Desert", tags: "Africa|Desert|City", location: "Marrakech, Morocco", imageUrl: fallbackHeroImages[1], href: "/collections" } },
      { id: "destination_paris", type: "destination", settings: { title: "Paris", description: "Balcony light, tailored styling, and editorial dusk.", tag: "City", tags: "Europe|City", location: "Paris, France", imageUrl: fallbackHeroImages[0], href: "/collections" } }
    ]) as SectionBlockInstance[];
    const visibleCards = cards.filter((item) => {
      const tags = listLines(blockValue(item, "tags", blockValue(item, "tag", "All"))).map((tag) => tag.toLowerCase());
      return selectedTag === "all" || !selectedTag ? true : tags.includes(selectedTag);
    });
    const displayCards = (visibleCards.length ? visibleCards : cards).slice(0, 5);
    return (
      <section className="overflow-hidden bg-[#fffaf3] px-5 py-14 text-[#171514]" id={sectionAnchor(section, "styles")}>
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#9d8c7d]">{setting(section, "eyebrow", "Popular destinations")}</p>
            <h2 className="mt-4 text-4xl font-semibold leading-[1.02] tracking-tight text-balance [font-family:var(--site-title-font)] md:text-6xl">
              {setting(section, "title", "Popular destinations")}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#6d665f]">{setting(section, "subtitle")}</p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
              {tabs.map((tab) => {
                const lower = tab.toLowerCase();
                const active = lower === selectedTag || (!selectedTag && lower === defaultTab);
                const rootHref = hrefFor(site, "/");
                const href = lower === "all" ? `${rootHref}#${sectionAnchor(section, "styles")}` : `${rootHref}?style=${encodeURIComponent(tab)}#${sectionAnchor(section, "styles")}`;
                return (
                  <Link
                    className={active ? "rounded-full border border-[#e7d9c6] bg-[#f2e7d8] px-4 py-2 text-xs font-semibold text-[#171514]" : "rounded-full border border-[#eadfce] bg-white px-4 py-2 text-xs font-medium text-[#7d7064] transition hover:border-[#d8c8b6] hover:text-[#171514]"}
                    href={href}
                    key={tab}
                  >
                    {tab}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="relative mt-8">
            <div className="pointer-events-none absolute inset-y-1/2 left-0 hidden -translate-x-1/2 lg:flex">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#eadfce] bg-white text-[#171514] shadow-[0_20px_52px_-38px_rgba(20,22,26,0.24)]">
                <ArrowRight className="h-4 w-4 rotate-180" strokeWidth={1.8} />
              </div>
            </div>
            <div className="pointer-events-none absolute inset-y-1/2 right-0 hidden translate-x-1/2 lg:flex">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#eadfce] bg-white text-[#171514] shadow-[0_20px_52px_-38px_rgba(20,22,26,0.24)]">
                <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
              </div>
            </div>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-5">
              {displayCards.map((item, index) => (
                <Link
                  className="group overflow-hidden rounded-[18px] border border-[#e4d9cc] bg-white shadow-[0_24px_70px_-58px_rgba(20,22,26,0.18)] transition hover:-translate-y-1"
                  href={hrefFor(site, blockValue(item, "href", "/collections"))}
                  key={instanceKey(item, index, "destination")}
                  {...xfcartBlockAttrs(item, index, "destination")}
                >
                  <div className="relative aspect-[1.36/1] overflow-hidden bg-[#efe6d9]">
                    <img className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" src={mediaAssetUrl(site, blockValue(item, "imageUrl", fallbackHeroImages[index % fallbackHeroImages.length]))} alt={blockValue(item, "title", "Destination")} />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(13,12,14,0.04)_0%,rgba(13,12,14,0.16)_42%,rgba(13,12,14,0.72)_100%)]" />
                    <div className="absolute left-4 top-4 rounded-full border border-white/36 bg-white/14 px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-white backdrop-blur">
                      {blockValue(item, "tag", "Destination")}
                    </div>
                    <div className="absolute inset-x-4 bottom-4 text-white">
                      <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-white/72">
                        <MapPin className="h-3.5 w-3.5" strokeWidth={1.8} />
                        {blockValue(item, "location", "Destination")}
                      </p>
                      <h3 className="mt-2 text-[1.55rem] font-semibold leading-none tracking-tight [font-family:var(--site-title-font)]">{blockValue(item, "title", "Destination")}</h3>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (section.type === "example_gallery") {
    const items = sectionBlocks(section, "example");
    const cards = (items.length ? items : [
      { id: "example_santorini", type: "example", settings: { title: "Coastal Romance", description: "White and blue dreams in Santorini.", location: "Santorini, Greece", imageUrl: fallbackHeroImages[0], href: "/collections" } },
      { id: "example_marrakech", type: "example", settings: { title: "Exotic Elegance", description: "Rich textures and timeless Moorish architecture.", location: "Marrakech, Morocco", imageUrl: fallbackHeroImages[1], href: "/collections" } },
      { id: "example_bali", type: "example", settings: { title: "Tropical Paradise", description: "Lush jungles, serene beaches, pure bliss.", location: "Bali, Indonesia", imageUrl: packImages.travel, href: "/collections" } }
    ]) as SectionBlockInstance[];
    const anchor = sectionAnchor(section, "examples");
    const activeIndex = Math.min(Math.max(queryInt(renderContext.query.examplePage, 1) - 1, 0), Math.max(cards.length - 1, 0));
    const visibleCards = cards.length > 1 ? [...cards.slice(activeIndex), ...cards.slice(0, activeIndex)].slice(0, Math.min(5, cards.length)) : cards;
    const previousIndex = cards.length ? (activeIndex - 1 + cards.length) % cards.length : 0;
    const nextIndex = cards.length ? (activeIndex + 1) % cards.length : 0;
    const exampleHref = (index: number) => pageQueryHref(site, renderContext.pagePath, renderContext.query, { examplePage: index + 1 }, anchor);
    return (
      <section className="overflow-hidden bg-[#fffaf3] px-5 py-16 text-[#171514]" id={anchor}>
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#9d8c7d]">{setting(section, "eyebrow", "Inspiring examples")}</p>
            <h2 className="mt-4 text-4xl font-semibold leading-[1.02] tracking-tight text-balance [font-family:var(--site-title-font)] md:text-6xl">
              {setting(section, "title", "Inspiring examples")}
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-[#6d665f]">{setting(section, "subtitle")}</p>
          </div>
          <div className="relative mt-10">
            {cards.length > 1 ? (
              <Link className="absolute inset-y-[34%] left-0 z-10 hidden -translate-x-1/2 lg:flex" href={exampleHref(previousIndex)} aria-label="Show previous photo example">
                <span className="flex h-11 w-11 items-center justify-center rounded-full border border-[#eadfce] bg-white text-[#171514] shadow-[0_20px_52px_-38px_rgba(20,22,26,0.24)] transition hover:-translate-x-0.5 hover:border-[#c39a6a] active:scale-[0.97]">
                  <ArrowRight className="h-4 w-4 rotate-180" strokeWidth={1.8} />
                </span>
              </Link>
            ) : null}
            {cards.length > 1 ? (
              <Link className="absolute inset-y-[34%] right-0 z-10 hidden translate-x-1/2 lg:flex" href={exampleHref(nextIndex)} aria-label="Show next photo example">
                <span className="flex h-11 w-11 items-center justify-center rounded-full border border-[#eadfce] bg-white text-[#171514] shadow-[0_20px_52px_-38px_rgba(20,22,26,0.24)] transition hover:translate-x-0.5 hover:border-[#c39a6a] active:scale-[0.97]">
                  <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                </span>
              </Link>
            ) : null}
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-5">
              {visibleCards.map((item, index) => (
                <Link
                  className="group overflow-hidden rounded-[18px] border border-[#e4d9cc] bg-white shadow-[0_24px_60px_-50px_rgba(20,22,26,0.16)] transition hover:-translate-y-1"
                  href={hrefFor(site, blockValue(item, "href", "/collections"))}
                  key={instanceKey(item, index, "example")}
                  {...xfcartBlockAttrs(item, index, "example")}
                >
                  <div className="relative aspect-[4/5] overflow-hidden bg-[#efe6d9]">
                    <img className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" src={mediaAssetUrl(site, blockValue(item, "imageUrl", fallbackHeroImages[index % fallbackHeroImages.length]))} alt={blockValue(item, "title", "Example")} />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(13,12,14,0.04)_0%,rgba(13,12,14,0.16)_42%,rgba(13,12,14,0.72)_100%)]" />
                    <div className="absolute inset-x-4 bottom-4 inline-flex items-center gap-2 rounded-full border border-white/36 bg-black/24 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur">
                      <MapPin className="h-3.5 w-3.5" strokeWidth={1.8} />
                      {blockValue(item, "location", "Destination")}
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="text-[1.4rem] font-semibold leading-tight tracking-tight [font-family:var(--site-title-font)]">{blockValue(item, "title", "Example")}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#6d665f]">{blockValue(item, "description")}</p>
                  </div>
                </Link>
              ))}
            </div>
            {cards.length > 1 ? (
              <div className="mt-6 flex items-center justify-center gap-2">
                {cards.map((item, index) => (
                  <Link
                    aria-label={`Show ${blockValue(item, "title", "photo example")}`}
                    className="group inline-flex h-10 w-10 items-center justify-center rounded-full transition hover:scale-105"
                    href={exampleHref(index)}
                    key={item.id}
                  >
                    <span className={`h-2.5 w-2.5 rounded-full transition ${index === activeIndex ? "bg-[#b88a59]" : "bg-[#e0d3c5] group-hover:bg-[#caa174]"}`} />
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  if (section.type === "video_feature") {
    const image = mediaAssetUrl(site, setting(section, "imageUrl", fallbackHeroImages[0]));
    return (
      <section className="bg-[#0a0a0b] px-5 py-16 text-white" id={sectionAnchor(section, "how-it-works")}>
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-mono text-xs uppercase tracking-[0.22em]" style={{ color: accentBlue }}>{setting(section, "eyebrow", "Tutorial")}</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">{setting(section, "title")}</h2>
            <p className="mt-4 text-sm leading-7 text-white/72">{setting(section, "subtitle")}</p>
          </div>
          <div className="mt-8 overflow-hidden rounded-[26px] p-[3px] shadow-[0_28px_90px_-52px_rgba(47,111,237,0.24)]" style={{ borderColor: "rgba(47,111,237,0.3)", background: `linear-gradient(180deg, ${accentBlueSoft}, ${accentBlue})` }}>
            <div className="relative overflow-hidden rounded-[24px] bg-[#121216]">
              <img className="aspect-[16/9] w-full object-cover opacity-80" src={image} alt={setting(section, "title", "Video feature")} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
              <div className="absolute left-4 top-4 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white" style={{ background: accentForest }}>
                {setting(section, "videoBadge", "HAPPY NEW YEAR")}
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/90 text-zinc-950 shadow-[0_18px_60px_-28px_rgba(255,255,255,0.8)]">
                  <PlayCircle className="h-10 w-10" strokeWidth={1.8} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (section.type === "luxury_highlight") {
    const blocks = sectionBlocks(section);
    const featureCards = blocks.filter((item) => item.type === "card");
    const exampleCards = blocks.filter((item) => item.type === "example");
    const leadImage = mediaAssetUrl(site, setting(section, "leadImageUrl", firstImage(section) || fallbackHeroImages[0]));
    const leadKicker = setting(section, "leadKicker", "from one upload");
    const leadTitle = setting(section, "leadTitle", "Turn everyday uploads into a complete AI photo story.");
    const leadSideBody = setting(section, "leadSideBody", "Choose a package, track the album, and receive finished images in a secure customer gallery.");
    const featureItems = (featureCards.length
      ? featureCards
      : [
          { id: "luxury_1", type: "card", settings: { title: "Any destination, any style", text: "From Paris to Bali, Sahara to Santorini.", meta: "01" } },
          { id: "luxury_2", type: "card", settings: { title: "Photorealistic AI scenes", text: "Looks realistic, cinematic, and editorial-ready.", meta: "02" } },
          { id: "luxury_3", type: "card", settings: { title: "Save time and production cost", text: "No travel, no production spend, just beautiful delivery.", meta: "03" } },
          { id: "luxury_4", type: "card", settings: { title: "Your story, your way", text: "Custom poses, styling, scene mood, and destination worlds.", meta: "04" } }
        ]) as SectionBlockInstance[];
    const sceneItems = (exampleCards.length
      ? exampleCards
      : [
          { id: "luxury_example_1", type: "example", settings: { title: "Paris", description: "City editorial story", location: "Paris", imageUrl: fallbackHeroImages[0], href: "/collections" } },
          { id: "luxury_example_2", type: "example", settings: { title: "Marrakech", description: "Desert editorial", location: "Marrakech", imageUrl: fallbackHeroImages[1], href: "/collections" } },
          { id: "luxury_example_3", type: "example", settings: { title: "Bali", description: "Tropical travel look", location: "Bali", imageUrl: fallbackHeroImages[2], href: "/collections" } }
        ]) as SectionBlockInstance[];
    const galleryCards = sceneItems.slice(0, 4);
    const featureIcons = [Globe2, Sparkles, Clock3, Camera];
    return (
      <section className="relative isolate overflow-hidden bg-[#0b0a0b] px-5 py-20 text-white" id={sectionAnchor(section, "possibilities")}>
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_18%,rgba(214,167,107,0.16),transparent_34%),linear-gradient(180deg,rgba(10,10,11,0.98)_0%,rgba(13,12,14,1)_100%)]" />
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <div className="grid gap-10 lg:grid-cols-[0.46fr_0.54fr] lg:items-center">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/56">{setting(section, "eyebrow", "AI makes it possible")}</p>
              <h2 className="mt-4 text-4xl font-semibold leading-[0.98] tracking-tight text-balance [font-family:var(--site-title-font)] md:text-6xl">
                {setting(section, "title", "AI Makes It Possible.")}
              </h2>
              <p className="mt-5 max-w-md text-sm leading-7 text-white/66">{setting(section, "subtitle")}</p>
              <div className="mt-8 grid gap-4">
                {featureItems.slice(0, 4).map((item, index) => {
                  const Icon = featureIcons[index] || Sparkles;
                  return (
                    <div className="grid grid-cols-[auto_1fr] gap-4" key={instanceKey(item, index, "luxury_card")} {...xfcartBlockAttrs(item, index, "luxury_card")}>
                      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/14 bg-white/[0.04] text-[#d7aa76]">
                        <Icon className="h-5 w-5" strokeWidth={1.8} />
                      </div>
                      <div>
                        <h3 className="text-[1.05rem] font-semibold leading-tight text-white">{blockValue(item, "title", "Highlight")}</h3>
                        <p className="mt-2 text-sm leading-6 text-white/60">{blockValue(item, "text", blockValue(item, "description"))}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="relative min-w-0">
              <div className="pointer-events-none absolute inset-y-1/2 left-0 hidden -translate-x-1/2 lg:flex">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-white/[0.08] text-white shadow-[0_20px_52px_-38px_rgba(0,0,0,0.5)]">
                  <ArrowRight className="h-4 w-4 rotate-180" strokeWidth={1.8} />
                </div>
              </div>
              <div className="pointer-events-none absolute inset-y-1/2 right-0 hidden translate-x-1/2 lg:flex">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-white/[0.08] text-white shadow-[0_20px_52px_-38px_rgba(0,0,0,0.5)]">
                  <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                </div>
              </div>
              <div className="-mx-5 flex snap-x gap-4 overflow-x-auto px-5 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:-mx-2 lg:px-2">
                {galleryCards.map((item, index) => (
                  <Link
                    className="group w-[78%] shrink-0 snap-start overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.04] shadow-[0_26px_74px_-60px_rgba(0,0,0,0.78)] sm:w-[42%] lg:w-[31%]"
                    href={hrefFor(site, blockValue(item, "href", "/collections"))}
                    key={instanceKey(item, index, "luxury_example")}
                    {...xfcartBlockAttrs(item, index, "luxury_example")}
                  >
                    <div className="relative aspect-[4/5] overflow-hidden bg-[#272321]">
                      <img className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" src={mediaAssetUrl(site, blockValue(item, "imageUrl", fallbackHeroImages[index % fallbackHeroImages.length]))} alt={blockValue(item, "title", "Example")} />
                      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,8,9,0.02)_0%,rgba(8,8,9,0.12)_42%,rgba(8,8,9,0.62)_100%)]" />
                      <div className="absolute inset-x-0 bottom-0 p-4">
                        <p className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-white/66">
                          <MapPin className="h-3.5 w-3.5" strokeWidth={1.8} />
                          {blockValue(item, "location", blockValue(item, "title", "Destination"))}
                        </p>
                        <h3 className="mt-2 text-[1.45rem] font-semibold leading-none tracking-tight [font-family:var(--site-title-font)]">{blockValue(item, "title", "Scene")}</h3>
                        <p className="mt-2 line-clamp-2 text-[0.86rem] leading-5 text-white/62">{blockValue(item, "description", "Scene-ready photo story")}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (section.type === "media_banner") {
    const image = mediaAssetUrl(site, setting(section, "imageUrl", fallbackHeroImages[0]));
    const tone = setting(section, "tone", "warm");
    const dark = tone === "dark";
    const stats = sectionBlocks(section, "stat");
    const displayStats = stats.length
      ? stats
      : [
          { id: "banner_stat_outputs", type: "stat", settings: { value: "40", label: "edited frames" } },
          { id: "banner_stat_delivery", type: "stat", settings: { value: "Private", label: "gallery delivery" } },
          { id: "banner_stat_credit", type: "stat", settings: { value: "Credits", label: "clear checkout history" } }
        ];
    return (
      <section className={dark ? "bg-[#101114] px-5 py-12 text-white" : "grid-paper bg-[#f7f3ec] px-5 py-12 text-[#14161a]"} id={sectionAnchor(section, id)}>
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <Link
            className={dark ? "group grid overflow-hidden rounded-[32px] border border-white/10 bg-[#15171c] shadow-[0_34px_100px_-68px_rgba(0,0,0,0.86)] md:grid-cols-[0.92fr_1.08fr]" : "group grid overflow-hidden rounded-[32px] border border-[#ded5ca] bg-[#fffdf8]/90 shadow-[0_34px_100px_-76px_rgba(20,22,26,0.32)] md:grid-cols-[0.9fr_1.1fr]"}
            href={hrefFor(site, setting(section, "ctaHref", "#packages"))}
          >
            <div className={dark ? "flex min-h-[380px] flex-col justify-between p-7 text-white md:p-10" : "flex min-h-[380px] flex-col justify-between p-7 text-[#14161a] md:p-10"}>
              <div>
                <p className={dark ? "font-mono text-xs uppercase tracking-[0.22em] text-white/58" : "font-mono text-xs uppercase tracking-[0.22em] text-[#8a7a6d]"}>{setting(section, "eyebrow")}</p>
                <h2 className="mt-5 max-w-2xl text-4xl font-semibold leading-[1.02] tracking-tight text-balance [font-family:var(--site-title-font)] md:text-5xl">{setting(section, "title")}</h2>
                <p className={dark ? "mt-5 max-w-xl text-sm leading-7 text-white/70" : "mt-5 max-w-xl text-sm leading-7 text-[#625d56]"}>{setting(section, "subtitle")}</p>
                <div className="mt-7 grid max-w-xl gap-3 sm:grid-cols-3">
                  {displayStats.slice(0, 3).map((stat, index) => (
                    <div className={dark ? "border-t border-white/12 pt-3" : "border-t border-[#ddd4c8] pt-3"} key={instanceKey(stat, index, "media_banner_stat")} {...xfcartBlockAttrs(stat, index, "media_banner_stat")}>
                      <p className="font-mono text-xl font-semibold tracking-tight">{blockValue(stat, "value")}</p>
                      <p className={dark ? "mt-1 text-xs leading-5 text-white/52" : "mt-1 text-xs leading-5 text-[#726b62]"}>{blockValue(stat, "label")}</p>
                    </div>
                  ))}
                </div>
              </div>
              <span className={dark ? "mt-8 inline-flex w-fit items-center gap-2 rounded-[16px] bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition group-hover:-translate-y-0.5" : "mt-8 inline-flex w-fit items-center gap-2 rounded-[16px] bg-[#14161a] px-5 py-3 text-sm font-semibold text-white transition group-hover:-translate-y-0.5"}>
                {setting(section, "ctaLabel", "Explore")}
                <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
              </span>
            </div>
            <div className={dark ? "relative min-h-[340px] overflow-hidden bg-zinc-900" : "relative min-h-[340px] overflow-hidden bg-[#efe6d9]"}>
              <img className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" src={image} alt={setting(section, "title")} />
              <div className={dark ? "absolute inset-0 bg-gradient-to-r from-[#15171c]/76 via-black/10 to-black/34" : "absolute inset-0 bg-gradient-to-r from-black/48 via-black/6 to-black/28"} />
              <div className={dark ? "absolute bottom-5 left-5 right-5 rounded-[24px] border border-white/14 bg-black/48 p-5 text-white shadow-[0_22px_70px_-46px_rgba(0,0,0,0.72)] backdrop-blur-md" : "absolute bottom-5 left-5 right-5 rounded-[24px] border border-white/24 bg-[#111114]/72 p-5 text-white shadow-[0_22px_70px_-46px_rgba(0,0,0,0.64)] backdrop-blur-md"}>
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/62">featured collection</p>
                <p className="mt-2 text-xl font-semibold leading-tight">{setting(section, "imageCaption", "Private photo pack workflow")}</p>
                <p className="mt-2 text-sm leading-6 text-white/74">{setting(section, "imageMeta", "Upload, hold credits, create, and receive your private photo pack from one account.")}</p>
              </div>
            </div>
          </Link>
        </div>
      </section>
    );
  }

  if (section.type === "email_start_panel") {
    const stats = sectionBlocks(section, "stat");
    return (
      <section className="bg-[#0a0a0b] px-5 py-12 text-white" id={sectionAnchor(section, "start")}>
        <div className="mx-auto grid max-w-[var(--site-content-width)] gap-8 rounded-[1.8rem] border border-white/10 bg-[#101014] p-6 shadow-[0_28px_90px_-56px_rgba(0,0,0,0.92)] md:grid-cols-[0.95fr_1.05fr] md:p-8">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em]" style={{ color: accentBlue }}>{setting(section, "eyebrow", "Start your AI shoot")}</p>
            <h2 className="mt-4 max-w-2xl text-3xl font-semibold leading-tight tracking-tight md:text-5xl">{setting(section, "title")}</h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-white/68">{setting(section, "subtitle")}</p>
          </div>
          <div className="rounded-[1.4rem] border border-white/10 bg-[#141419] p-5">
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white p-2 shadow-[0_24px_70px_-58px_rgba(24,24,27,0.65)]">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-950" style={{ color: accentBlue }}>
                <Mail className="h-5 w-5" strokeWidth={1.8} />
              </div>
              <input className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder={setting(section, "placeholder", "you@example.com")} readOnly />
              <Link className="inline-flex items-center gap-2 rounded-full bg-[var(--site-primary-button)] px-4 py-2.5 text-sm font-medium text-[var(--site-primary-button-text)]" href={hrefFor(site, setting(section, "actionHref", "/login"))}>
                {setting(section, "buttonLabel", "Continue")}
                <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
              </Link>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {(stats.length ? stats : [
                { id: "start_credits", type: "stat", settings: { value: "Credits", label: "subscription checkout" } },
                { id: "start_private", type: "stat", settings: { value: "Private", label: "customer uploads" } },
                { id: "start_album", type: "stat", settings: { value: "Albums", label: "download delivery" } }
              ]).map((stat, index) => (
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4" key={instanceKey(stat, index, "start_stat")} {...xfcartBlockAttrs(stat, index, "start_stat")}>
                  <p className="font-mono text-lg">{blockValue(stat, "value")}</p>
                  <p className="mt-1 text-xs leading-5 text-white/55">{blockValue(stat, "label")}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (section.type === "login_method_panel") {
    const methods = sectionBlocks(section, "login_method");
    const auth = runtime?.auth;
    const showRealLoginForm = Boolean(auth) && renderContext.pagePath === "/login" && mode !== "preview";
    const featureImage = mediaAssetUrl(site, setting(section, "imageUrl", dreamshootToolSceneDefaults.upload));
    const secondaryImage = mediaAssetUrl(site, setting(section, "secondaryImageUrl", "/assets/dreamshoot/avatar-nora-gpt2-fast.png"));
    const featureLabel = setting(section, "imageBadge", "Private customer access");
    const featureCaption = setting(section, "imageCaption", "Magazine-grade photo delivery begins with a private sign-in.");
    const featureMeta = setting(section, "imageMeta", "Keep uploads, scene packs, and delivery requests inside one elegant client workspace.");
    return (
      <section className="bg-[#090a0e] px-4 py-6 text-white sm:px-5 md:py-10" id={sectionAnchor(section, "start")}>
        <div className="mx-auto grid min-w-0 max-w-[var(--site-content-width)] gap-6 rounded-[32px] border border-white/10 bg-[#0f1117] p-4 shadow-[0_40px_120px_-84px_rgba(0,0,0,0.88)] sm:p-5 md:p-6 lg:grid-cols-[0.44fr_0.56fr] lg:items-start">
          <div className="min-w-0 rounded-[28px] border border-white/10 bg-white/[0.03] p-5 md:p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-white/46">{setting(section, "eyebrow", "Customer login")}</p>
            <h2 className="mt-4 max-w-full text-[clamp(2.3rem,5.4vw,4.6rem)] font-semibold leading-[0.98] tracking-[-0.03em] text-balance text-white [font-family:var(--site-title-font)]">
              {setting(section, "title")}
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-white/64">{setting(section, "subtitle")}</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {[
                ["Continue with Google", "Available as a brand entry, but the real login flow uses email in this build."],
                ["Email login", "The customer account, credits, uploads, and albums stay scoped to this site."],
                ["Private delivery", "Signed-in customers return to a site-specific workspace and gallery."]
              ].map(([label, detail]) => (
                <div className="flex items-start gap-3 rounded-[18px] border border-white/10 bg-[#12141b] px-4 py-3" key={label}>
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#8ae0b5]" strokeWidth={1.8} />
                  <span>
                    <span className="block text-sm font-semibold text-white">{label}</span>
                    <span className="mt-1 block text-xs leading-5 text-white/58">{detail}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="min-w-0 rounded-[28px] border border-white/10 bg-[#11131a] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-4 md:p-5">
            <div className="min-w-0 overflow-hidden rounded-[24px] border border-white/10 bg-[#0c0e13] shadow-[0_24px_80px_-58px_rgba(0,0,0,0.9)]">
              <div className="relative overflow-hidden border-b border-white/10 bg-[#10131a]">
                <img className="aspect-[16/9] w-full object-cover md:aspect-[16/10]" src={featureImage} alt={setting(section, "title")} />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,10,14,0.14)_0%,rgba(9,10,14,0.2)_38%,rgba(9,10,14,0.78)_100%)]" />
                <div className="absolute left-4 top-4 rounded-full border border-white/12 bg-black/32 px-3 py-1.5 text-[11px] font-medium text-white/86 backdrop-blur">
                  {featureLabel}
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-4 text-white md:p-5">
                  <p className="max-w-lg text-[1rem] font-semibold leading-tight md:text-[1.15rem]">{featureCaption}</p>
                  <p className="mt-2 max-w-lg text-xs leading-5 text-white/72 md:text-sm md:leading-6">{featureMeta}</p>
                </div>
                <div className="absolute bottom-4 right-4 hidden w-[108px] overflow-hidden rounded-[18px] border border-white/12 bg-black/28 shadow-[0_18px_48px_-36px_rgba(0,0,0,0.8)] backdrop-blur-sm md:block">
                  <img className="aspect-[4/5] w-full object-cover" src={secondaryImage} alt={featureLabel} />
                </div>
              </div>
              <div className="p-3 md:p-4">
                {showRealLoginForm ? (
                  <LoginForm
                    defaultEmail={auth?.defaultEmail}
                    defaultName={auth?.defaultName}
                    defaultPassword={auth?.defaultPassword}
                    initialMessage={auth?.initialMessage}
                    siteId={site.id}
                    storefrontBasePath={(site as RoutedSite).__storefrontBasePath}
                    siteSlug={site.slug}
                  />
                ) : (
                  <>
                    <div className="flex items-center gap-3 rounded-[18px] border border-white/10 bg-[#10131a] px-3 py-2">
                      <Mail className="h-5 w-5 text-white/42" strokeWidth={1.8} />
                      <input className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/28" placeholder={setting(section, "emailPlaceholder", "you@example.com")} readOnly />
                      <Link className="rounded-[14px] bg-white px-4 py-2 text-sm font-semibold text-[#111318]" href={hrefFor(site, setting(section, "actionHref", "/login"))}>
                        {setting(section, "buttonLabel", "Continue")}
                      </Link>
                    </div>
                    <div className="mt-4 grid gap-2">
                      {(methods.length ? methods : [
                        { id: "google", type: "login_method", settings: { label: "Continue with Google", helper: "OAuth-ready entry.", kind: "google", href: "/login" } },
                        { id: "email", type: "login_method", settings: { label: "Use email login", helper: "Password login is available for private album access.", kind: "email", href: "/login" } }
                      ]).map((method, index) => (
                        <Link className="flex items-center justify-between gap-3 rounded-[18px] border border-white/10 bg-[#10131a] px-4 py-3 text-sm transition hover:-translate-y-0.5 hover:border-white/18 hover:bg-[#131720]" href={hrefFor(site, blockValue(method, "href", "/login"))} key={instanceKey(method, index, "login_method")} {...xfcartBlockAttrs(method, index, "login_method")}>
                          <span className="flex min-w-0 items-start gap-3">
                            {blockValue(method, "kind", "") === "google" ? (
                              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white ring-1 ring-white/10">
                                <img className="h-5 w-5" src={googleIconPath} alt="" aria-hidden="true" />
                              </span>
                            ) : null}
                            <span className="min-w-0">
                            <span className="block font-semibold text-white">{blockValue(method, "label")}</span>
                            <span className="mt-1 block text-xs leading-5 text-white/54">{blockValue(method, "helper")}</span>
                            </span>
                          </span>
                          <ArrowRight className="h-4 w-4 text-white/62" strokeWidth={1.8} />
                        </Link>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (section.type === "trust_signal_bar") {
    const stats = sectionBlocks(section, "stat");
    const fallbackStats = [
      { id: "trust_private", type: "stat", settings: { value: "100% Private & Secure", label: "Your photos and data are always protected." } },
      { id: "trust_guarantee", type: "stat", settings: { value: "Satisfaction Guarantee", label: "Not satisfied? We'll make it right." } },
      { id: "trust_fees", type: "stat", settings: { value: "No Hidden Fees", label: "What you see is what you pay." } },
      { id: "trust_revisions", type: "stat", settings: { value: "Unlimited Revisions", label: "We work with you until you love the results." } }
    ] as SectionBlockInstance[];
    const items = (stats.length ? stats : fallbackStats).slice(0, 4);
    return (
      <section className="border-y border-[#ece1d3] bg-[#fffaf3] px-5 py-8 text-[#171514]" id={sectionAnchor(section, "trust")}>
        <div className="mx-auto grid max-w-[var(--site-content-width)] gap-0 md:grid-cols-4">
          {items.map((stat, index) => {
            const Icon = index === 0 ? ShieldCheck : index === 1 ? CheckCircle2 : index === 2 ? Tags : BadgeCheck;
            const title = blockValue(stat, "value", blockValue(stat, "title", "Trust"));
            const rawBody = blockValue(stat, "label", blockValue(stat, "description", ""));
            const body = rawBody.includes("|") ? rawBody.split("|").slice(1).join("|").trim() || rawBody : rawBody;
            return (
              <div className={`${index > 0 ? "md:border-l md:border-[#e3d8cc]" : ""} flex gap-5 px-6 py-5`} key={instanceKey(stat, index, "trust_stat")} {...xfcartBlockAttrs(stat, index, "trust_stat")}>
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#f4ebe0] text-[#a6723e]">
                  <Icon className="h-6 w-6" strokeWidth={1.7} />
                </div>
                <div>
                  <p className="text-[1.02rem] font-semibold leading-tight [font-family:var(--site-title-font)]">{title}</p>
                  <p className="mt-1.5 text-[0.9rem] leading-6 text-[#6d665f]">{body}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  if (section.type === "final_cta") {
    const backgroundImage = mediaAssetUrl(site, setting(section, "backgroundImage", firstImage(section) || fallbackHeroImages[0]));
    const primaryCta = setting(section, "primaryCta", "Start Your Journey");
    const primaryHref = setting(section, "primaryHref", "/login");
    const secondaryCta = setting(section, "secondaryCta", "");
    const secondaryHref = setting(section, "secondaryHref", "/pricing");
    return (
      <section className="relative overflow-hidden border-y border-[#eadfce] bg-[#f7f1e8] px-5 py-8 text-[#171514]" id={sectionAnchor(section, "journey")}>
        <div className="absolute inset-0">
          <img className="h-full w-full object-cover opacity-[0.12]" src={backgroundImage} alt={setting(section, "title", "Final call to action")} />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(247,241,232,0.98)_0%,rgba(247,241,232,0.94)_45%,rgba(247,241,232,0.9)_100%)]" />
        </div>
        <div className="relative mx-auto grid max-w-[var(--site-content-width)] gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="text-center lg:text-left">
            <h2 className="text-[2.05rem] font-semibold leading-[1.04] tracking-tight [font-family:var(--site-title-font)] md:text-[2.85rem]">
              {setting(section, "title", "Your Love Story, Anywhere.")}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-[0.95rem] leading-7 text-[#6d665f] lg:mx-0">
              {setting(section, "subtitle", "Create premium AI photos with a plan customers can understand.")}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 lg:justify-end">
            <Link className="inline-flex items-center gap-2 rounded-[12px] bg-[#171514] px-7 py-3.5 text-[0.95rem] font-semibold text-white transition hover:-translate-y-0.5" href={hrefFor(site, primaryHref)}>
              {primaryCta}
              <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
            </Link>
            {secondaryCta ? (
              <Link className="inline-flex items-center gap-2 rounded-[12px] border border-[#ddd0c2] bg-white/82 px-7 py-3.5 text-[0.95rem] font-semibold text-[#171514]" href={hrefFor(site, secondaryHref)}>
                {secondaryCta}
                <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
              </Link>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  if (section.type === "dreamshoot_feature_tabs") {
    const tabs = sectionBlocks(section, "feature_tab");
    const items = tabs.length ? tabs : [
      { id: "tab_packages", type: "feature_tab", settings: { label: "Photo packages", title: "Pick a finished outcome", description: "Start from a known package like headshots, World Cup fan photos, creator portraits, gala, or cyberpunk instead of a blank prompt.", imageUrl: dreamshootToolSceneDefaults.banner, href: "/tools/image_generator" } },
      { id: "tab_tryon", type: "feature_tab", settings: { label: "Try-on and style", title: "Preview themed looks", description: "Simulate wardrobe, hairstyle, beauty, or gala directions before full-package generation.", imageUrl: "/assets/dreamshoot/editorial-headshot.svg", href: "/tools/image_generator" } },
      { id: "tab_video", type: "feature_tab", settings: { label: "Video scenes", title: "Short-form delivery packs", description: "Turn generated package results into campaign-ready motion ideas.", imageUrl: dreamshootToolSceneDefaults.progress, href: "/tools/image_generator" } }
    ];
    const lead = items[0];
    return (
      <section className="bg-[var(--site-muted)] px-5 py-16" id={sectionAnchor(section, "features")}>
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.56fr)_minmax(0,0.44fr)] lg:items-end">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--site-accent)]">{setting(section, "eyebrow", "AI photo tools")}</p>
              <h2 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight tracking-tight md:text-5xl">{setting(section, "title")}</h2>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-zinc-600 lg:justify-self-end">{setting(section, "subtitle")}</p>
          </div>
          <div className="mt-9 grid gap-5 xl:grid-cols-[minmax(320px,0.42fr)_minmax(0,0.58fr)] xl:items-stretch">
            <div className="grid gap-3">
              {items.map((item, index) => (
                <Link className={`group rounded-[1.25rem] border p-4 shadow-[0_20px_48px_-42px_rgba(20,22,26,0.18)] transition hover:-translate-y-1 sm:p-5 ${index === 0 ? "border-zinc-950 bg-white" : "border-black/10 bg-white/70"}`} href={hrefFor(site, blockValue(item, "href", "/tools/image_generator"))} key={instanceKey(item, index, "feature_tab")} {...xfcartBlockAttrs(item, index, "feature_tab")}>
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--site-accent)]">{blockValue(item, "label")}</p>
                  <h3 className="mt-2 text-xl font-semibold tracking-tight">{blockValue(item, "title")}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">{blockValue(item, "description")}</p>
                  <p className="mt-4 inline-flex items-center gap-2 text-sm font-medium">
                    Open flow
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" strokeWidth={1.8} />
                  </p>
                </Link>
              ))}
            </div>
            <div className="relative min-h-[320px] overflow-hidden rounded-[1.7rem] border border-black/10 bg-zinc-200 shadow-diffusion sm:min-h-[400px] xl:min-h-[520px]">
              <img className="absolute inset-0 h-full w-full object-cover" src={mediaAssetUrl(site, blockValue(lead, "imageUrl", fallbackHeroImages[0]))} alt={blockValue(lead, "title", "AI photo feature")} />
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/72 via-transparent to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-6">
                <p className="font-mono text-xs uppercase tracking-[0.22em] text-white/60">Featured flow</p>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{blockValue(lead, "title")}</h3>
                <p className="mt-2 max-w-xl text-sm leading-6 text-white/72">{blockValue(lead, "description")}</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (section.type === "occasion_showcase") {
    const items = settingListBlocks(
      section,
      "items",
      [
        `Creator studio|Profile, travel, and editorial creator looks.|Creator|${packImages.creator}|/tools/image_generator`,
        `World Cup fan photos|Stadium portraits, fan posters, and match-day profile scenes.|Sports|${packImages.sports}|/tools/image_generator`,
        `Headshots|Professional photos for founders, job search, and teams.|Professional|${packImages.headshots}|/tools/image_generator`
      ],
      (item, index) => {
        const [title, description, tag, imageUrl, href] = item.split("|");
        return { id: `legacy_occasion_${index}`, type: "occasion", settings: { title, description, tag, imageUrl, href } };
      }
    );
    return (
      <section className="border-y border-black/10 bg-white px-5 py-16" id={sectionAnchor(section, "occasions")}>
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <div className="grid gap-6 md:grid-cols-[0.72fr_1fr] md:items-end">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--site-accent)]">{setting(section, "eyebrow", "Photo occasions")}</p>
              <h2 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight tracking-tight md:text-5xl">{setting(section, "title")}</h2>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-zinc-600 md:justify-self-end">{setting(section, "subtitle")}</p>
          </div>
          <div className="mt-9 grid gap-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
            {items.map((item, index) => {
              const title = blockValue(item, "title");
              const image = mediaAssetUrl(site, blockValue(item, "imageUrl", packImages.fashion));
              return (
                <Link className="group relative min-h-[340px] overflow-hidden rounded-[1.45rem] border border-black/10 bg-zinc-200 shadow-diffusion" href={hrefFor(site, blockValue(item, "href", "/tools/image_generator"))} key={instanceKey(item, index, "occasion")} {...xfcartBlockAttrs(item, index, "occasion")}>
                  <img className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" src={image} alt={title} />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/76 via-zinc-950/16 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                    <span className="rounded-full bg-white/18 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] backdrop-blur">{blockValue(item, "tag", "Photo set")}</span>
                    <h3 className="mt-4 text-2xl font-semibold tracking-tight">{title}</h3>
                    <p className="mt-2 max-w-md text-sm leading-6 text-white/76">{blockValue(item, "description")}</p>
                    <p className="mt-4 inline-flex items-center gap-2 text-sm font-medium">
                      Open this shoot
                      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" strokeWidth={1.8} />
                    </p>
                  </div>
                  {index === 0 ? <div className="absolute right-4 top-4 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-zinc-950">Featured</div> : null}
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  if (section.type === "ai_feature_launcher") {
    const features = settingListBlocks(
      section,
      "items",
      [
        "Upload photos|Collect selfies and source images inside a private customer workspace.|Private intake|/app",
        "Prepare portraits|Prepare solo, creator, or brand looks before package generation.|Consistent look|/app",
        "Track progress|Show waiting, creating, delivered, review-needed, and returned-credit states.|Live progress|/app",
        "Download albums|Deliver finished images to private customer galleries.|Private delivery|/app"
      ],
      (item, index) => {
        const [title, description, meta, href] = item.split("|");
        return { id: `legacy_launcher_${index}`, type: "feature", settings: { title, description, meta, href } };
      }
    );
    const icons = [UploadCloud, Sparkles, Clock3, Download, Camera, Layers3];
    const leadFeature = features[0];
    const workspaceImage = runtimeCollectionImage(site, section, undefined, `${site.slug}-${id}-workspace`);
    const workspaceChips = listSetting(section, "chipList", ["Private customer account", "Album-ready workflow", "Live credits and delivery"]);
    const ctaLabel = setting(section, "ctaLabel", "Open workspace");
    const ctaHref = hrefFor(site, setting(section, "ctaHref", "/app"));
    const launcherSurface = sectionSurface(
      section,
      renderContext.pagePath === "/account"
        ? "account"
        : renderContext.pagePath === "/app"
        ? "workspace"
        : "showcase"
    );
    const customer = runtime?.customer;
    const workspaceSummary = [
      {
        label: "Available",
        value: customer ? String(customer.balance.available) : "0",
        detail: "credits ready"
      },
      {
        label: "Held",
        value: customer ? String(customer.balance.reserved) : "0",
        detail: "credits in requests"
      },
      {
        label: "Uploads",
        value: String(runtime?.assets.filter((asset) => asset.role === "input").length ?? 0),
        detail: "private source files"
      },
      {
        label: "Albums",
        value: String(runtime?.albums.length ?? 0),
        detail: "delivered collections"
      }
    ];

    if (launcherSurface === "workspace") {
      return (
        <section className="bg-[#f4ede2] px-5 py-10 text-[#14161a]" id={sectionAnchor(section, "workspace")}>
          <div className="mx-auto max-w-[var(--site-content-width)]">
            <div className="grid gap-5 xl:grid-cols-[0.96fr_1.04fr]">
              <div className="overflow-hidden rounded-[32px] border border-[#e3d6c7] bg-[#fffaf3] shadow-[0_30px_80px_-62px_rgba(20,22,26,0.18)]">
                <div className="border-b border-[#eadfce] px-6 py-6 xl:px-8">
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#b17b47]">{setting(section, "eyebrow", "Customer workspace")}</p>
                  <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
                    <div className="max-w-2xl">
                      <h2 className="text-3xl font-semibold leading-[1.02] tracking-tight [font-family:var(--site-title-font)] md:text-[2.7rem]">
                        {setting(section, "title")}
                      </h2>
                      <p className="mt-3 max-w-xl text-sm leading-7 text-[#625d56]">{setting(section, "subtitle")}</p>
                    </div>
                    <Link className="inline-flex items-center gap-2 rounded-[16px] bg-[#14161a] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 active:scale-[0.98]" href={ctaHref}>
                      {ctaLabel}
                      <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                    </Link>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {workspaceChips.map((chip) => (
                      <span className="rounded-full border border-[#e2d6c8] bg-white px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-[#7d6e61]" key={chip}>
                        {chip}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="grid gap-4 px-6 py-6 xl:grid-cols-[1.04fr_0.96fr] xl:px-8 xl:py-8">
                  <div className="relative overflow-hidden rounded-[28px] border border-[#e4dace] bg-[#efe6d9] min-h-[340px]">
                    <img className="absolute inset-0 h-full w-full object-cover" src={workspaceImage} alt={blockValue(leadFeature ?? { id: "lead", type: "feature", settings: {} }, "title", "Customer workspace")} />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,22,26,0.04)_0%,rgba(20,22,26,0.14)_38%,rgba(20,22,26,0.82)_100%)]" />
                    <div className="absolute inset-x-5 top-5 flex items-start justify-between gap-3 text-white">
                      <div>
                        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/68">private client flow</p>
                        <p className="mt-2 max-w-[15rem] text-sm leading-6 text-white/72">
                          Upload, request, track, and review without leaving the client workspace.
                        </p>
                      </div>
                      <span className="rounded-full border border-white/18 bg-black/20 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-white/78 backdrop-blur">
                        {customer?.status ?? "guest"}
                      </span>
                    </div>
                    <div className="absolute inset-x-5 bottom-5 text-white">
                      <h3 className="text-[2rem] font-semibold leading-[1.02] tracking-tight [font-family:var(--site-title-font)] md:text-[2.35rem]">
                        {blockValue(leadFeature ?? { id: "lead", type: "feature", settings: {} }, "title", "Open your photo workflow")}
                      </h3>
                      <p className="mt-3 max-w-md text-sm leading-6 text-white/74">
                        {blockValue(leadFeature ?? { id: "lead", type: "feature", settings: {} }, "description", "Keep every private upload, request, and delivery inside one polished workflow.")}
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-3">
                    {workspaceSummary.map((item) => (
                      <div className="rounded-[22px] border border-[#dfd3c4] bg-white p-5 shadow-[0_20px_56px_-48px_rgba(20,22,26,0.12)]" key={item.label}>
                        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#9b8a79]">{item.label}</p>
                        <p className="mt-3 text-[1.9rem] font-semibold tracking-tight text-[#171514]">{item.value}</p>
                        <p className="mt-1 text-sm leading-6 text-[#625d56]">{item.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {features.slice(0, 4).map((feature, index) => {
                  const Icon = icons[index % icons.length];
                  return (
                    <Link
                      className="group rounded-[26px] border border-[#ddd1c1] bg-[#fffaf3] p-6 shadow-[0_22px_62px_-54px_rgba(20,22,26,0.14)] transition hover:-translate-y-0.5"
                      href={hrefFor(site, blockValue(feature, "href", "/app"))}
                      key={`launcher_workspace_${instanceKey(feature, index, "workspace")}`}
                      {...xfcartBlockAttrs(feature, index, "launcher_workspace")}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#171514] text-white">
                          <Icon className="h-5 w-5" strokeWidth={1.8} />
                        </div>
                        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#9b8a79]">{blockValue(feature, "meta")}</span>
                      </div>
                      <h3 className="mt-6 text-[1.45rem] font-semibold leading-tight tracking-tight text-[#171514] [font-family:var(--site-title-font)]">
                        {blockValue(feature, "title")}
                      </h3>
                      <p className="mt-3 text-sm leading-6 text-[#625d56]">{blockValue(feature, "description")}</p>
                      <p className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#171514]">
                        Open
                        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" strokeWidth={1.8} />
                      </p>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      );
    }

    if (launcherSurface === "account") {
      return (
        <section className="bg-[#f6efe5] px-5 py-10 text-[#14161a]" id={sectionAnchor(section, "account-ops")}>
          <div className="mx-auto max-w-[var(--site-content-width)]">
            <div className="overflow-hidden rounded-[32px] border border-[#e2d7c8] bg-[#fffaf3] shadow-[0_28px_78px_-62px_rgba(20,22,26,0.16)]">
              <div className="grid gap-0 xl:grid-cols-[0.78fr_1.22fr]">
                <div className="border-b border-[#eadfce] px-6 py-6 xl:border-b-0 xl:border-r xl:px-8 xl:py-8">
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#b17b47]">{setting(section, "eyebrow", "Customer account")}</p>
                  <h2 className="mt-4 text-3xl font-semibold leading-[1.02] tracking-tight [font-family:var(--site-title-font)] md:text-[2.7rem]">
                    {setting(section, "title")}
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-7 text-[#625d56]">{setting(section, "subtitle")}</p>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    {workspaceSummary.slice(0, 2).map((item) => (
                      <div className="rounded-[20px] border border-[#dfd3c4] bg-white p-4" key={item.label}>
                        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#9b8a79]">{item.label}</p>
                        <p className="mt-3 text-2xl font-semibold text-[#171514]">{item.value}</p>
                        <p className="mt-1 text-xs leading-5 text-[#625d56]">{item.detail}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {workspaceChips.map((chip) => (
                      <span className="rounded-full border border-[#e2d6c8] bg-white px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-[#7d6e61]" key={chip}>
                        {chip}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="px-6 py-6 xl:px-8 xl:py-8">
                  <div className="mb-5 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#8f8070]">account actions</p>
                      <p className="mt-2 text-sm leading-6 text-[#625d56]">Move between credits, uploads, live requests, and delivered albums from one private account shell.</p>
                    </div>
                    <Link className="inline-flex items-center gap-2 rounded-[16px] bg-[#14161a] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 active:scale-[0.98]" href={ctaHref}>
                      {ctaLabel}
                      <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                    </Link>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {features.slice(0, 4).map((feature, index) => {
                      const Icon = icons[index % icons.length];
                      return (
                        <Link
                          className="group rounded-[24px] border border-[#dfd3c4] bg-[#fdf8f1] p-5 shadow-[0_20px_56px_-48px_rgba(20,22,26,0.1)] transition hover:-translate-y-0.5"
                          href={hrefFor(site, blockValue(feature, "href", "/account"))}
                          key={`launcher_account_${instanceKey(feature, index, "account")}`}
                          {...xfcartBlockAttrs(feature, index, "launcher_account")}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#171514] text-white">
                              <Icon className="h-4 w-4" strokeWidth={1.8} />
                            </div>
                            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#9b8a79]">{blockValue(feature, "meta")}</span>
                          </div>
                          <p className="mt-5 text-[1.25rem] font-semibold leading-tight tracking-tight text-[#171514] [font-family:var(--site-title-font)]">
                            {blockValue(feature, "title")}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-[#625d56]">{blockValue(feature, "description")}</p>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      );
    }

    return (
      <section className="bg-[#f1e6d3] px-5 py-16 text-[#14161a]" id={sectionAnchor(section, "features")}>
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <div className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr] xl:items-start">
            <div className="rounded-[32px] border border-[#ded3c4] bg-[#fbf7ef]/94 p-7 shadow-[0_30px_80px_-64px_rgba(20,22,26,0.2)] xl:p-8">
              <div className="grid gap-5 lg:grid-cols-[1.06fr_0.94fr] lg:items-start">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#b17b47]">{setting(section, "eyebrow", "AI studio features")}</p>
                  <h2 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.02] tracking-tight [font-family:var(--site-title-font)] md:text-5xl">
                    {setting(section, "title")}
                  </h2>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-[#625d56]">{setting(section, "subtitle")}</p>
                </div>
                <div className="grid gap-3 rounded-[24px] border border-[#e3d7ca] bg-white/72 p-5 shadow-[0_22px_56px_-48px_rgba(20,22,26,0.14)]">
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#9b8a79]">workspace overview</p>
                  {features.slice(1, 4).map((feature, index) => {
                    const Icon = icons[(index + 1) % icons.length];
                    return (
                      <Link
                        className="group rounded-[18px] border border-[#efe5d8] bg-[#fffaf4] px-4 py-4 transition hover:-translate-y-0.5 hover:border-[#ddcebc]"
                        href={hrefFor(site, blockValue(feature, "href", "/app"))}
                        key={`launcher_overview_${instanceKey(feature, index + 1, "launcher")}`}
                        {...xfcartBlockAttrs(feature, index + 1, "launcher_overview")}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#171514] text-white">
                            <Icon className="h-4 w-4" strokeWidth={1.8} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold tracking-tight text-[#171514]">{blockValue(feature, "title")}</p>
                              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#9b8a79]">{blockValue(feature, "meta")}</span>
                            </div>
                            <p className="mt-2 text-xs leading-5 text-[#625d56]">{blockValue(feature, "description")}</p>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
              <div className="mt-7 flex flex-wrap gap-2">
                {workspaceChips.map((chip) => (
                  <span className="rounded-full border border-[#e2d6c8] bg-white/74 px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-[#7d6e61]" key={chip}>
                    {chip}
                  </span>
                ))}
              </div>
              <div className="mt-7 grid gap-4 md:grid-cols-[1.08fr_0.92fr]">
                {leadFeature ? (
                  <Link
                    className="group relative min-h-[420px] overflow-hidden rounded-[30px] border border-[#e4dace] bg-[#efe6d9] shadow-[0_28px_72px_-58px_rgba(20,22,26,0.18)]"
                    href={hrefFor(site, blockValue(leadFeature, "href", "/app"))}
                    {...xfcartBlockAttrs(leadFeature, 0, "launcher_lead")}
                  >
                    <img className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" src={workspaceImage} alt={blockValue(leadFeature, "title", "Customer workspace")} />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,22,26,0.06)_0%,rgba(20,22,26,0.16)_32%,rgba(20,22,26,0.82)_100%)]" />
                    <div className="absolute inset-x-5 top-5 flex items-start justify-between gap-4 text-white">
                      <div>
                        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/68">{blockValue(leadFeature, "meta", "Customer workspace")}</p>
                        <p className="mt-2 max-w-[15rem] text-sm leading-6 text-white/72">Private customer journey from source uploads to delivered photo albums.</p>
                      </div>
                      <span className="rounded-full border border-white/20 bg-black/20 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-white/78 backdrop-blur">Live customer flow</span>
                    </div>
                    <div className="absolute inset-x-5 bottom-5 text-white">
                      <h3 className="text-[2rem] font-semibold leading-[1.02] tracking-tight [font-family:var(--site-title-font)] md:text-[2.35rem]">
                        {blockValue(leadFeature, "title", "Upload source photos")}
                      </h3>
                      <p className="mt-3 max-w-md text-sm leading-6 text-white/74">{blockValue(leadFeature, "description")}</p>
                      <p className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-white">
                        Open this step
                        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" strokeWidth={1.8} />
                      </p>
                    </div>
                  </Link>
                ) : null}
                <div className="grid gap-3">
                  {features.slice(0, 3).map((feature, index) => {
                    const Icon = icons[index % icons.length];
                    return (
                      <div className="rounded-[24px] border border-[#dfd3c4] bg-white/82 p-5 shadow-[0_24px_60px_-50px_rgba(20,22,26,0.12)]" key={`workspace_note_${instanceKey(feature, index, "note")}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#14161a] text-white">
                            <Icon className="h-5 w-5" strokeWidth={1.8} />
                          </div>
                          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#9b8a79]">{blockValue(feature, "meta")}</span>
                        </div>
                        <p className="mt-5 text-lg font-semibold text-[#171514]">{blockValue(feature, "title")}</p>
                        <p className="mt-2 text-sm leading-6 text-[#625d56]">{blockValue(feature, "description")}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
              <Link className="mt-6 inline-flex items-center gap-2 rounded-[16px] bg-[#14161a] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 active:scale-[0.98]" href={ctaHref}>
                {ctaLabel}
                <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
              </Link>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {features.slice(0, 4).map((feature, index) => {
                const Icon = icons[index % icons.length];
                return (
                  <Link
                    className="group rounded-[26px] border border-[#ded3c4] bg-[#fffaf3]/92 p-6 shadow-[0_22px_62px_-54px_rgba(20,22,26,0.16)] transition hover:-translate-y-0.5"
                    href={hrefFor(site, blockValue(feature, "href", "/app"))}
                    key={`launcher_panel_${instanceKey(feature, index, "panel")}`}
                    {...xfcartBlockAttrs(feature, index, "launcher_panel")}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#171514] text-white">
                        <Icon className="h-5 w-5" strokeWidth={1.8} />
                      </div>
                      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#9b8a79]">{blockValue(feature, "meta")}</span>
                    </div>
                    <h3 className="mt-6 text-[1.55rem] font-semibold leading-tight tracking-tight text-[#171514] [font-family:var(--site-title-font)]">
                      {blockValue(feature, "title")}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-[#625d56]">{blockValue(feature, "description")}</p>
                    <p className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#171514]">
                      Open
                      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" strokeWidth={1.8} />
                    </p>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (section.type === "feature_grid") {
    const isPackGrid = setting(section, "source") === "creative_packs";
    const packItems = creativePacks.filter((pack) => pack.status === "active");
    const manualItems = settingListBlocks(
      section,
      "items",
      [
        "Upload|Collect customer inputs in a private workspace.",
        "Generate|Begin the private image request.",
        "Deliver|Publish finished images to private customer albums."
      ],
      (item, index) => {
        const [title, text, meta] = parseTriplet(item);
        return { id: `legacy_feature_${index}`, type: "card", settings: { title, text, meta } };
      }
    );
    return (
      <section className="px-5 py-16" id={sectionAnchor(section, id)}>
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <div className="grid gap-6 md:grid-cols-[0.62fr_1fr] md:items-end">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#7a7c80]">{setting(section, "eyebrow", "section")}</p>
              <h2 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight tracking-tight md:text-5xl">{setting(section, "title")}</h2>
            </div>
            <div className="max-w-2xl md:justify-self-end">
              <p className="text-sm leading-7 text-zinc-600">{setting(section, "subtitle")}</p>
            </div>
            {isPackGrid ? (
              <Link className="inline-flex w-fit items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium md:justify-self-start" href={hrefFor(site, "/login")}>
                Create album
                <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
              </Link>
            ) : null}
          </div>

          {isPackGrid ? (
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {packItems.map((pack, index) => (
                <Link
                  className={`group overflow-hidden rounded-[1.4rem] border border-black/10 bg-white shadow-[0_24px_80px_-58px_rgba(24,24,27,0.55)] transition hover:-translate-y-1 ${
                    index === 0 ? "md:col-span-1 md:row-span-2" : ""
                  }`}
                  href={hrefFor(site, `/tools/${pack.aiAppSlug}`)}
                  key={pack.id}
                >
                  <div className={index === 0 ? "aspect-[4/5] overflow-hidden" : "aspect-[16/10] overflow-hidden"}>
                    <img
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                      src={packImage(site, pack)}
                      alt={pack.name}
                    />
                  </div>
                  <div className="p-5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">{pack.outputCount} images</span>
                      <span className="font-mono text-xs text-zinc-500">{pack.creditCost} credits</span>
                    </div>
                    <h3 className="mt-4 text-xl font-semibold tracking-tight">{pack.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-zinc-600">{pack.headline}</p>
                    <p className="mt-4 flex items-center gap-2 text-sm font-medium text-zinc-950">
                      Open pack
                      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" strokeWidth={1.8} />
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {manualItems.map((item, index) => {
                const title = blockValue(item, "title");
                const text = blockValue(item, "text");
                const meta = blockValue(item, "meta");
                const icons = [UploadCloud, Layers3, Sparkles, Download];
                const Icon = icons[index % icons.length];
                return (
                  <article className="rounded-[1.35rem] border border-[#e3ddd2] bg-[#fbfaf7] p-5 shadow-[0_22px_55px_-44px_rgba(20,22,26,0.24)]" key={instanceKey(item, index, "manual_feature")} {...xfcartBlockAttrs(item, index, "manual_feature")}>
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#14161a] text-white">
                      <Icon className="h-5 w-5" strokeWidth={1.8} />
                    </div>
                    <p className="mt-5 text-[11px] font-medium uppercase tracking-[0.14em] text-[#8a8c91]">{meta}</p>
                    <h3 className="mt-2 text-xl font-semibold">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-zinc-600">{text}</p>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    );
  }

  if (section.type === "photo_package_wall") {
    const usePacks = setting(section, "source", "creative_packs") === "creative_packs";
    const manualItems = sectionBlocks(section, "package");
    const packItems = creativePacks.filter((pack) => pack.status === "active");
    const selectedCategory = queryValue(renderContext.query.category).toLowerCase();
    const selectedAiApp = queryValue(renderContext.query.app).toLowerCase();
    const filteredPackItems = packItems.filter((pack) => {
      if (selectedCategory && pack.category.toLowerCase() !== selectedCategory) return false;
      if (selectedAiApp && pack.aiAppSlug.toLowerCase() !== selectedAiApp) return false;
      return true;
    });
    const cards = usePacks
      ? filteredPackItems.map((pack) => ({
          id: pack.id,
          title: pack.name,
          description: pack.description || pack.headline,
          meta: `${pack.outputCount} photos`,
          credits: `${pack.creditCost} credits`,
          imageUrl: packImage(site, pack),
          href: `/tools/${pack.aiAppSlug}`
        }))
      : manualItems.map((item) => ({
          id: item.id,
          title: blockValue(item, "title"),
          description: blockValue(item, "description"),
          meta: blockValue(item, "meta"),
          credits: blockValue(item, "credits"),
          imageUrl: mediaAssetUrl(site, blockValue(item, "imageUrl", packImages.creator)),
          href: blockValue(item, "href", "/tools/image_generator")
        }));
    const fallbackCards = [
      {
        id: "fallback_creator",
        title: "Creator Studio Pack",
        description: "AI portraits for profile updates, gifts, creator posts, and private albums.",
        meta: "40 photos",
        credits: "24 credits",
        imageUrl: packImages.creator,
        href: "/tools/image_generator"
      }
    ];
    const allCards = cards.length
      ? cards
      : fallbackCards;
    const defaultMaxCount = renderContext.pagePath === "/" ? 8 : 12;
    const maxCount = Math.max(1, Number(setting(section, "maxCount", String(defaultMaxCount))) || defaultMaxCount);
    const displayCards = allCards.slice(0, maxCount);
    return (
      <section className="relative overflow-hidden bg-[var(--site-bg)] px-5 py-16" id={sectionAnchor(section, "packages")}>
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.56fr)_minmax(0,0.44fr)] lg:items-end">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#7a7c80]">{setting(section, "eyebrow", "Photo packages")}</p>
              <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-tight md:text-5xl">{setting(section, "title")}</h2>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-zinc-600 lg:justify-self-end">{setting(section, "subtitle")}</p>
          </div>
          {usePacks ? (
            <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              <span className="rounded-full border border-black/10 bg-white px-3 py-1.5">{displayCards.length} visible packs</span>
              <Link className="rounded-full border border-black/10 bg-white px-3 py-1.5 transition hover:border-zinc-950/20 hover:text-zinc-900" href={hrefFor(site, "/collections")}>
                All
              </Link>
              {Array.from(new Set(packItems.map((pack) => pack.category))).map((category) => (
                <Link
                  className={`rounded-full border px-3 py-1.5 transition hover:border-zinc-950/20 hover:text-zinc-900 ${selectedCategory === category ? "border-zinc-950 bg-zinc-950 text-white" : "border-black/10 bg-white"}`}
                  href={hrefFor(site, `/collections?category=${encodeURIComponent(category)}`)}
                  key={category}
                >
                  {category}
                </Link>
              ))}
            </div>
          ) : null}
          <div className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {displayCards.map((card, index) => (
              <Link
                className={`group flex h-full flex-col overflow-hidden rounded-[1.45rem] border border-[#ddd7cb] bg-[#fbfaf7] text-[#14161a] shadow-[0_28px_75px_-58px_rgba(20,22,26,0.24)] transition hover:-translate-y-1 ${
                  index === 0 ? "sm:col-span-2 xl:col-span-2" : ""
                }`}
                href={hrefFor(site, card.href)}
                key={card.id}
              >
                <div className={index === 0 ? "aspect-[16/10] overflow-hidden bg-zinc-200 xl:aspect-[16/9]" : "aspect-[4/5] overflow-hidden bg-zinc-200 sm:aspect-[6/7]"}>
                  <img className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" src={card.imageUrl} alt={card.title} />
                </div>
                <div className="flex flex-1 flex-col p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full border border-black/8 bg-white px-2.5 py-1 text-xs font-medium text-[#5f6269]">{card.meta}</span>
                    <span className="font-mono text-xs text-[#6b6e76]">{card.credits}</span>
                  </div>
                  <h3 className="mt-4 text-xl font-semibold tracking-tight sm:text-[1.35rem]">{card.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#63666d]">{card.description}</p>
                  <p className="mt-5 flex items-center gap-2 text-sm font-medium text-[#14161a]">
                    Open package
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" strokeWidth={1.8} />
                  </p>
                </div>
              </Link>
            ))}
          </div>
          {allCards.length > displayCards.length ? (
            <div className="mt-7 flex justify-center sm:justify-start">
              <Link
                className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-medium text-[#14161a] transition hover:-translate-y-0.5"
                href={hrefFor(site, "/collections")}
              >
                Explore all photo packages
                <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
              </Link>
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  if (section.type === "dreamshoot_package_taxonomy") {
    const blocks = sectionBlocks(section, "taxonomy_card");
    const fallbackCards: SectionBlockInstance[] = [
      {
        id: "taxonomy_creator",
        type: "taxonomy_card",
        settings: {
          title: "Creator portraits",
          description: "Profile, founder, newsletter, social, and personal-brand image sets.",
          meta: "Creator",
          keywords: "creator portraits|profile photos|personal brand",
          imageUrl: packImages.creator,
          href: "/collections?category=creator"
        }
      },
      {
        id: "taxonomy_headshot",
        type: "taxonomy_card",
        settings: {
          title: "Professional headshots",
          description: "Profile photos for LinkedIn, founders, resumes, and teams.",
          meta: "Professional",
          keywords: "headshot|profile|linkedin",
          imageUrl: packImages.headshots,
          href: "/collections?category=headshots"
        }
      },
      {
        id: "taxonomy_creative",
        type: "taxonomy_card",
        settings: {
          title: "Cinematic worlds",
          description: "Cyberpunk, mafia, nature, travel, gala, and dramatic themed photos.",
          meta: "Creative",
          keywords: "cyberpunk|mafia|nature|gala",
          imageUrl: packImages.sports,
          href: "/collections?category=creative"
        }
      }
    ];
    const cards = blocks.length ? blocks : fallbackCards;
    const editorial = setting(section, "layout", "seo_grid") === "editorial";
    const HeadingTag = setting(section, "headingLevel", renderContext.pagePath === "/collections" ? "h1" : "h2") === "h1" ? "h1" : "h2";
    return (
      <section className="relative overflow-hidden border-y border-white/10 bg-[#08080a] px-5 py-16 text-white" id={sectionAnchor(section, "package-taxonomy")}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(47,111,237,0.22),transparent_26%),radial-gradient(circle_at_88%_36%,rgba(215,163,107,0.16),transparent_24%)]" />
        <div className="relative mx-auto max-w-[var(--site-content-width)]">
          <div className="grid gap-7 lg:grid-cols-[minmax(0,0.5fr)_minmax(0,0.5fr)] lg:items-end">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/52">{setting(section, "eyebrow", "Photo package library")}</p>
              <HeadingTag className="mt-4 max-w-3xl text-[clamp(2.1rem,4.4vw,4.65rem)] font-semibold leading-[0.98] tracking-tight text-balance [font-family:var(--site-title-font)]">
                {setting(section, "title", "Package categories customers already understand.")}
              </HeadingTag>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-white/64 lg:justify-self-end">{setting(section, "subtitle")}</p>
          </div>
          <div className={`mt-10 grid gap-4 ${editorial ? "lg:grid-cols-[1.18fr_0.82fr]" : "sm:grid-cols-2 xl:grid-cols-3"}`}>
            {cards.map((card, index) => {
              const image = mediaAssetUrl(site, blockValue(card, "imageUrl", fallbackHeroImages[index % fallbackHeroImages.length]));
              const keywords = listLines(blockValue(card, "keywords", ""));
              return (
                <Link
                  className={`group overflow-hidden rounded-[24px] border border-white/12 bg-white/[0.07] text-white shadow-[0_28px_90px_-60px_rgba(0,0,0,0.9)] backdrop-blur transition hover:-translate-y-1 hover:bg-white/[0.1] ${
                    editorial && index === 0 ? "lg:row-span-2" : ""
                  }`}
                  href={hrefFor(site, blockValue(card, "href", "/collections"))}
                  key={instanceKey(card, index, "dreamshoot_taxonomy")}
                  {...xfcartBlockAttrs(card, index, "dreamshoot_taxonomy")}
                >
                  <div className={editorial && index === 0 ? "aspect-[16/11] overflow-hidden bg-zinc-900 lg:aspect-[16/12]" : "aspect-[16/10] overflow-hidden bg-zinc-900"}>
                    <img className="h-full w-full object-cover opacity-92 transition duration-500 group-hover:scale-[1.04]" src={image} alt={blockValue(card, "title", "Package category")} />
                  </div>
                  <div className="p-5 sm:p-6">
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full border border-white/12 bg-white/[0.08] px-3 py-1 text-xs font-medium text-white/68">{blockValue(card, "meta", "Package")}</span>
                      <ArrowRight className="h-4 w-4 text-white/52 transition group-hover:translate-x-1" strokeWidth={1.8} />
                    </div>
                    <h3 className="mt-5 text-[1.28rem] font-semibold leading-tight tracking-tight sm:text-[1.55rem]">{blockValue(card, "title", "Photo package")}</h3>
                    <p className="mt-3 text-sm leading-6 text-white/64">{blockValue(card, "description")}</p>
                    {keywords.length ? (
                      <div className="mt-5 flex flex-wrap gap-2">
                        {keywords.slice(0, 4).map((keyword) => (
                          <span className="rounded-full bg-white/[0.08] px-2.5 py-1 text-[11px] text-white/62" key={keyword}>
                            {keyword}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  if (section.type === "dreamshoot_visual_proof") {
    const blocks = sectionBlocks(section, "proof_card");
    const fallbackCards: SectionBlockInstance[] = [
      { id: "proof_worldcup", type: "proof_card", settings: { title: "World Cup fan photos", description: "Stadium posters, match-day portraits, and fan profile scenes.", category: "Sports", badge: "Sports", imageUrl: packImages.sports, href: "/collections?category=sports" } },
      { id: "proof_headshots", type: "proof_card", settings: { title: "Professional portraits", description: "Clean founder, resume, and team-ready headshots.", category: "Headshots", badge: "Business", imageUrl: packImages.headshots, href: "/collections?category=headshots" } },
      { id: "proof_style", type: "proof_card", settings: { title: "Style previews", description: "Hairstyle, beauty, and try-on looks before a full album.", category: "Beauty", badge: "Beauty", imageUrl: "/assets/dreamshoot/generated/20260618/hairstyle-preview-v1.png", href: "/collections?category=beauty" } },
      { id: "proof_creative", type: "proof_card", settings: { title: "Cinematic worlds", description: "Cyberpunk, gala, noir, and editorial scene concepts.", category: "Creative", badge: "Creative", imageUrl: packImages.creative, href: "/collections?category=creative" } },
      { id: "proof_engagement", type: "proof_card", settings: { title: "Engagement looks", description: "Announcement-ready portraits, proposal scenes, and romantic album ideas.", category: "Couple", badge: "Couple", imageUrl: "/assets/dreamshoot/frames/sample-engagement.png", href: "/collections?category=couple" } }
    ];
    const cards = (blocks.length ? blocks : fallbackCards).slice(0, 5);
    const lead = cards[0];
    const tabs = listLines(setting(section, "tabs", "All|Couple|Seasonal|Headshots|Beauty|Creative|Video"));
    const badges = listLines(setting(section, "badges", "Private model|Album-ready|15+ package themes"));
    return (
      <section className="relative overflow-hidden bg-[#05070E] px-5 py-16 text-white md:py-24" id={sectionAnchor(section, "proof-gallery")}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_10%,rgba(122,76,255,0.34),transparent_31%),radial-gradient(circle_at_85%_8%,rgba(22,220,240,0.22),transparent_34%),radial-gradient(circle_at_58%_100%,rgba(236,75,221,0.18),transparent_36%)]" />
        <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_center,rgba(255,255,255,0.8)_1px,transparent_1px)] [background-size:90px_90px]" />
        <div className="relative mx-auto max-w-[var(--site-content-width)]">
          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold uppercase tracking-[0.08em] text-white/62">
            <span>{setting(section, "label", "Visual proof gallery")}</span>
          </div>
          <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,0.52fr)_minmax(0,0.48fr)] lg:items-end">
            <div>
              <h2 className="max-w-3xl text-[clamp(2.8rem,7vw,5.25rem)] font-semibold leading-[0.95] tracking-[-0.06em] text-balance [font-family:var(--site-title-font)]">
                {setting(section, "title", "See what your selfies can become.")}
              </h2>
              <div className="mt-10 flex flex-wrap gap-3">
                {tabs.map((tab, index) => (
                  <Link
                    className="rounded-full border border-white/18 px-4 py-2 text-sm font-semibold text-white/78 transition hover:border-white/35 hover:text-white"
                    href={hrefFor(site, tab === "All" ? "/collections" : `/collections?category=${encodeURIComponent(tab.toLowerCase())}`)}
                    key={tab}
                    style={index === 0 ? { background: dreamshootBrandGradient, borderColor: "transparent", color: "white" } : undefined}
                  >
                    {tab}
                  </Link>
                ))}
              </div>
            </div>
            <div className="lg:pb-7">
              <p className="max-w-[38rem] text-[clamp(1.12rem,1.7vw,1.55rem)] leading-[1.22] text-white/72">
                {setting(section, "subtitle", "Use the second screen to prove output quality immediately. Lead with finished albums by intent, not a long feature list.")}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                {badges.map((badge, index) => (
                  <span
                    className="rounded-full border border-white/16 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white/76"
                    key={badge}
                    style={index === 1 ? { background: dreamshootBrandGradient, borderColor: "transparent", color: "white" } : undefined}
                  >
                    {badge}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-10 grid gap-5 lg:grid-cols-[minmax(0,0.98fr)_minmax(0,1.02fr)]">
            <Link
              className="group relative min-h-[460px] overflow-hidden rounded-[28px] border border-white/14 bg-white/[0.05] shadow-[0_36px_120px_-70px_rgba(0,0,0,0.96)]"
              href={hrefFor(site, blockValue(lead, "href", "/login"))}
              {...xfcartBlockAttrs(lead, 0, "visual_proof")}
            >
              <img className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.035]" src={mediaAssetUrl(site, blockValue(lead, "imageUrl", packImages.creator))} alt={blockValue(lead, "title", "Featured photo package")} />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,7,14,0.04)_0%,rgba(5,7,14,0.18)_42%,rgba(5,7,14,0.88)_100%)]" />
              <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
                <span className="rounded-full border border-white/20 bg-white/16 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">{blockValue(lead, "badge", "Featured package")}</span>
                <h3 className="mt-4 text-[clamp(2rem,3vw,2.6rem)] font-semibold leading-none tracking-[-0.04em] text-white">{blockValue(lead, "title", "Featured package")}</h3>
                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <span className="inline-flex items-center gap-2 rounded-[16px] px-5 py-3 text-sm font-semibold text-white" style={{ background: dreamshootBrandGradient }}>
                    {setting(section, "primaryCta", "Start this pack")}
                    <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                  </span>
                  <ArrowRight className="ml-auto h-6 w-6 text-white/82 transition group-hover:translate-x-1" strokeWidth={1.8} />
                </div>
              </div>
            </Link>
            <div className="grid gap-5 sm:grid-cols-2">
              {cards.slice(1, 5).map((card, index) => (
                <Link
                  className="group relative min-h-[230px] overflow-hidden rounded-[24px] border border-white/14 bg-white/[0.05] shadow-[0_28px_90px_-66px_rgba(0,0,0,0.94)]"
                  href={hrefFor(site, blockValue(card, "href", "/collections"))}
                  key={instanceKey(card, index, "visual_proof_card")}
                  {...xfcartBlockAttrs(card, index + 1, "visual_proof")}
                >
                  <img className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.045]" src={mediaAssetUrl(site, blockValue(card, "imageUrl", packImages.fashion))} alt={blockValue(card, "title", "Photo result")} />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,7,14,0.08)_0%,rgba(5,7,14,0.2)_34%,rgba(5,7,14,0.88)_100%)]" />
                  <div className="absolute inset-x-0 bottom-0 p-5">
                    <span className="rounded-full border border-white/18 bg-black/24 px-3 py-1.5 text-xs font-medium text-white/86 backdrop-blur">{blockValue(card, "badge", blockValue(card, "category", "Package"))}</span>
                    <h3 className="mt-4 text-[1.45rem] font-semibold leading-tight tracking-[-0.03em] text-white">{blockValue(card, "title", "Photo result")}</h3>
                    <div className="mt-1 flex items-end justify-between gap-4">
                      <p className="max-w-[17rem] text-sm leading-5 text-white/72">{blockValue(card, "description")}</p>
                      <ArrowRight className="h-5 w-5 shrink-0 text-white/82 transition group-hover:translate-x-1" strokeWidth={1.8} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (section.type === "dreamshoot_featured_pack") {
    const images = sectionBlocks(section, "seasonal_image");
    const fallbackImages: SectionBlockInstance[] = [
      { id: "featured_worldcup_1", type: "seasonal_image", settings: { label: "Stadium Portrait", meta: "Cinematic fan look", imageUrl: "/assets/dreamshoot/generated/20260621-worldcup-pack/stadium-portrait.png", shape: "tall" } },
      { id: "featured_worldcup_2", type: "seasonal_image", settings: { label: "Friend Fan Photos", meta: "Group-friendly shots", imageUrl: "/assets/dreamshoot/generated/20260621-worldcup-pack/friend-fan-photos.png", shape: "wide" } },
      { id: "featured_worldcup_3", type: "seasonal_image", settings: { label: "Match-day Avatar", meta: "Profile-ready crop", imageUrl: "/assets/dreamshoot/generated/20260621-worldcup-pack/match-day-avatar.png", shape: "square" } },
      { id: "featured_worldcup_4", type: "seasonal_image", settings: { label: "Fan Poster", meta: "Story and feed artwork", imageUrl: "/assets/dreamshoot/generated/20260621-worldcup-pack/fan-poster.png", shape: "tall" } },
      { id: "featured_worldcup_5", type: "seasonal_image", settings: { label: "Social Story", meta: "Mobile-first layout", imageUrl: "/assets/dreamshoot/generated/20260621-worldcup-pack/social-story.png", shape: "tall" } },
      { id: "featured_worldcup_6", type: "seasonal_image", settings: { label: "Banner / Cover", meta: "Wide campaign image", imageUrl: "/assets/dreamshoot/generated/20260621-worldcup-pack/banner-cover.png", shape: "wide" } }
    ];
    const collage = (images.length ? images : fallbackImages).slice(0, 6);
    while (collage.length < 6) collage.push(fallbackImages[collage.length]);
    const includedTokens = listLines(
      setting(
        section,
        "includedOutputs",
        "Fan posters|Large portrait graphics for match day|Stadium portraits|Cinematic scenes with floodlights|Match-day avatars|Profile-ready square crops|Social banners|Wide cover images for sharing"
      )
    );
    const includedOutputs = Array.from({ length: Math.ceil(includedTokens.length / 2) }, (_, index) => ({
      title: includedTokens[index * 2] ?? "",
      body: includedTokens[index * 2 + 1] ?? ""
    })).filter((item) => item.title || item.body);
    const overlayChips = listLines(setting(section, "overlayChips", "fan poster|avatar|stadium|social-ready"));
    const metrics = [
      { value: setting(section, "photos", "40 photos"), label: "Full album" },
      { value: setting(section, "credits", "26 credits"), label: "Shown upfront" },
      { value: setting(section, "privacy", "Private album"), label: "Identity-safe" }
    ];
    const collagePlacements = [
      "col-span-12 row-span-3 md:col-span-5 md:row-span-5",
      "col-span-7 row-span-2 md:col-span-7 md:row-span-3",
      "col-span-5 row-span-2 md:col-span-3 md:row-span-2",
      "col-span-6 row-span-2 md:col-span-4 md:row-span-3",
      "col-span-6 row-span-2 md:col-span-4 md:row-span-3",
      "col-span-12 row-span-2 md:col-span-4 md:row-span-3"
    ];
    return (
      <section className="relative overflow-hidden bg-[#05070E] px-5 py-14 text-white md:py-20" id={sectionAnchor(section, "featured-pack")}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(122,76,255,0.22),transparent_34%),radial-gradient(circle_at_84%_12%,rgba(22,220,240,0.18),transparent_32%),radial-gradient(circle_at_54%_96%,rgba(255,166,68,0.2),transparent_36%)]" />
        <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(circle_at_center,rgba(255,255,255,0.7)_1px,transparent_1px)] [background-size:96px_96px]" />
        <div className="relative mx-auto max-w-[var(--site-content-width)]">
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/56">
            <span>{setting(section, "label", "Featured seasonal pack")}</span>
          </div>
          <div className="mt-8 grid gap-7 lg:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)] lg:items-start">
            <div className="flex flex-col rounded-[34px] border border-white/14 bg-[#070911]/88 p-6 shadow-[0_36px_120px_-76px_rgba(0,0,0,0.96)] backdrop-blur md:p-8 lg:p-9">
              <span className="inline-flex w-fit rounded-full px-4 py-2.5 text-xs font-bold uppercase tracking-[0.08em] text-white shadow-[0_20px_58px_-34px_rgba(255,166,68,0.86)]" style={{ background: "linear-gradient(90deg,#ff7a3d 0%,#ec4bdd 48%,#16dcf0 100%)" }}>
                {setting(section, "badge", "Match-day pack")}
              </span>
              <h2 className="mt-7 max-w-xl text-[clamp(2.15rem,3.85vw,3.75rem)] font-semibold leading-[0.98] tracking-[-0.055em] text-balance [font-family:var(--site-title-font)]">
                {setting(section, "title", "World Cup fan photos for match-day moments.")}
              </h2>
              <p className="mt-5 max-w-lg text-[1rem] leading-[1.48] text-white/72">
                {setting(section, "subtitle", "Turn everyday selfies into fan posters, stadium-style portraits, match-day avatars, and private albums built for social sharing.")}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link className="inline-flex items-center gap-2 rounded-[18px] px-6 py-3.5 text-sm font-bold text-white transition hover:-translate-y-0.5 active:scale-[0.98]" href={hrefFor(site, setting(section, "primaryHref", "/login"))} style={{ background: dreamshootBrandGradient }}>
                  {setting(section, "primaryCta", "Create Fan Photos")}
                  <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                </Link>
                <Link className="inline-flex items-center gap-2 rounded-[18px] border border-white/16 bg-white/[0.05] px-6 py-3.5 text-sm font-semibold text-white/86 transition hover:-translate-y-0.5 hover:bg-white/[0.08] active:scale-[0.98]" href={hrefFor(site, setting(section, "secondaryHref", "/collections"))}>
                  {setting(section, "secondaryCta", "View Sports Packs")}
                </Link>
              </div>
              <div className="mt-7 grid gap-3 sm:grid-cols-3">
                {metrics.map((metric) => (
                  <div className="rounded-[18px] border border-white/12 bg-white/[0.06] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]" key={metric.value}>
                    <p className="text-[1.28rem] font-semibold tracking-[-0.03em] text-white">{metric.value}</p>
                    <p className="mt-1 text-xs leading-5 text-white/58">{metric.label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-[24px] border border-white/12 bg-white/[0.05] p-5">
                <p className="text-sm font-semibold tracking-[-0.01em] text-white">{setting(section, "includedTitle", "Included outputs")}</p>
                <div className="mt-4 grid gap-3">
                  {(includedOutputs.length ? includedOutputs : [
                    { title: "Fan posters", body: "Large portrait graphics for match day" },
                    { title: "Stadium portraits", body: "Cinematic scenes with floodlights" },
                    { title: "Match-day avatars", body: "Profile-ready square crops" },
                    { title: "Social banners", body: "Wide cover images for sharing" }
                  ]).slice(0, 6).map((item) => (
                    <div className="grid grid-cols-[10px_1fr] gap-3" key={`${item.title}-${item.body}`}>
                      <span className="mt-2 h-2 w-2 rounded-full" style={{ background: dreamshootBrandGradient }} />
                      <div>
                        <p className="text-sm font-semibold text-white/92">{item.title}</p>
                        {item.body ? <p className="mt-0.5 text-xs leading-5 text-white/52">{item.body}</p> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <p className="mt-5 text-xs leading-5 text-white/45">
                {setting(section, "safetyCopy", "Safe styling: no real player likenesses, official team logos, or protected marks required.")}
              </p>
            </div>
            <div className="relative overflow-hidden rounded-[34px] border border-white/14 bg-[#090A11]/88 p-4 shadow-[0_36px_120px_-76px_rgba(0,0,0,0.96)] backdrop-blur md:p-6">
              <div className="grid h-[880px] grid-cols-12 grid-rows-[repeat(9,minmax(0,1fr))] gap-3 md:h-[690px] md:gap-4">
                {collage.map((item, index) => {
                  return (
                    <div
                      className={`group relative overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.04] ${collagePlacements[index] ?? "col-span-4 row-span-3"}`}
                      key={instanceKey(item, index, "seasonal_image")}
                      {...xfcartBlockAttrs(item, index, "seasonal_image")}
                    >
                      <img className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.035]" src={mediaAssetUrl(site, blockValue(item, "imageUrl", packImages.sports))} alt={blockValue(item, "label", "Featured pack image")} />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/78 via-black/24 to-transparent p-3 opacity-100 md:p-4">
                        <p className="text-xs font-semibold text-white">{blockValue(item, "label", "World Cup image")}</p>
                        {blockValue(item, "meta", "") ? <p className="mt-0.5 hidden text-[11px] leading-4 text-white/58 sm:block">{blockValue(item, "meta", "")}</p> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="absolute left-1/2 top-[47%] w-[min(86%,420px)] -translate-x-1/2 -translate-y-1/2 rounded-[24px] border border-white/14 bg-[#11121C]/88 p-5 shadow-[0_28px_88px_-52px_rgba(0,0,0,0.98)] backdrop-blur-xl">
                <p className="text-sm font-semibold text-white/58">{setting(section, "overlayTitle", "World Cup Pack")}</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">{setting(section, "overlaySubtitle", "Match-day looks without a studio.")}</h3>
                <div className="mt-4 flex flex-wrap gap-2">
                  {overlayChips.map((chip, index) => (
                    <span className="rounded-full border border-white/14 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white/76" key={chip} style={index === 0 ? { background: dreamshootBrandGradient, borderColor: "transparent", color: "white" } : undefined}>
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
                <p className="rounded-[18px] border border-white/10 bg-white/[0.045] px-4 py-3 text-xs leading-5 text-white/54">
                  {setting(section, "bottomNote", "Seasonal packs rotate around tournaments, holidays, and high-intent photo moments.")}
                </p>
                <div className="rounded-[18px] border border-white/10 bg-white/[0.055] p-3">
                  <p className="text-xs font-semibold text-white">{setting(section, "campaignLabel", "Current campaign: World Cup Fan Photos")}</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <span className="block h-full w-[72%] rounded-full" style={{ background: dreamshootBrandGradient }} />
                  </div>
                  <p className="mt-2 text-[11px] leading-4 text-white/48">{setting(section, "nextCampaignLabel", "Next: Valentine / Graduation Season")}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (section.type === "dreamshoot_package_catalog") {
    const usePacks = setting(section, "source", "creative_packs") === "creative_packs";
    const manualCards = sectionBlocks(section, "catalog_pack").map((item) => dreamshootCatalogCardFromBlock(site, item));
    const packItems = creativePacks.filter((pack) => pack.status === "active").map((pack) => dreamshootCatalogCardFromPack(site, pack));
    const cards = usePacks && packItems.length ? packItems : manualCards;
    const fallbackCards: DreamShootCatalogCard[] = [
      dreamshootCatalogCardFromBlock(site, { id: "catalog_worldcup", type: "catalog_pack", settings: { title: "World Cup fan photos", description: "Match-day portraits, fan posters, and stadium-inspired profile images.", category: "Sports", meta: "40 photos", credits: "26 credits", imageUrl: packImages.sports, href: "/tools/image-studio" } }),
      dreamshootCatalogCardFromBlock(site, { id: "catalog_headshot", type: "catalog_pack", settings: { title: "Professional Headshots", description: "LinkedIn, founder, resume, and team-ready portraits.", category: "Headshots", meta: "20 photos", credits: "20 credits", imageUrl: packImages.headshots, href: "/tools/image-studio" } }),
      dreamshootCatalogCardFromBlock(site, { id: "catalog_cyberpunk", type: "catalog_pack", settings: { title: "Cyberpunk", description: "Neon city portraits and future-fashion scenes.", category: "Creative", meta: "20 photos", credits: "26 credits", imageUrl: packImages.creative, href: "/tools/image-studio" } }),
      dreamshootCatalogCardFromBlock(site, { id: "catalog_gala", type: "catalog_pack", settings: { title: "Gala Photos", description: "Formal night-out portraits and red-carpet styling.", category: "Creative", meta: "20 photos", credits: "24 credits", imageUrl: packImages.gala, href: "/tools/image-studio" } })
    ];
    const displayCards = cards.length ? cards : fallbackCards;
    const featuredCount = Math.max(3, Math.min(6, numberSetting(section, "featuredCount", 5)));
    const featured = [...displayCards]
      .sort((a, b) => dreamshootFeaturedCatalogScore(a) - dreamshootFeaturedCatalogScore(b))
      .slice(0, featuredCount);
    const featuredIds = new Set(featured.map((card) => card.id));
    const directory = [
      ...featured,
      ...displayCards.filter((card) => !featuredIds.has(card.id))
    ];
    const rest = directory.slice(featured.length);
    const tabs = listLines(setting(section, "tabs", "All|Headshots|Beauty|Creative|Sports|Wedding|Cultural|Couple|Seasonal|Video"));
    const steps = listLines(setting(section, "steps", "Pick pack|See credit cost|Generate album"));
    const directoryCount = directory.length;
    return (
      <section className="relative overflow-hidden bg-[#05070E] px-5 py-16 text-white md:py-24" id={sectionAnchor(section, "packages")} data-dreamshoot-catalog-count={directoryCount}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_8%,rgba(122,76,255,0.28),transparent_31%),radial-gradient(circle_at_82%_18%,rgba(22,220,240,0.2),transparent_31%),radial-gradient(circle_at_54%_92%,rgba(255,166,68,0.24),transparent_39%)]" />
        <div className="absolute inset-0 opacity-35 [background-image:radial-gradient(circle_at_center,rgba(255,255,255,0.7)_1px,transparent_1px)] [background-size:94px_94px]" />
        <div className="relative mx-auto max-w-[var(--site-content-width)]">
          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold uppercase tracking-[0.08em] text-white/62">
            <span>{setting(section, "label", "Photo package catalog")}</span>
          </div>
          <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,0.52fr)_minmax(0,0.48fr)] lg:items-end">
            <div>
              <h2 className="max-w-[46rem] text-[clamp(2.8rem,7vw,5.25rem)] font-semibold leading-[0.95] tracking-[-0.06em] text-balance [font-family:var(--site-title-font)]">
                {setting(section, "title", "Choose a photo package first.")}
              </h2>
              <div className="mt-10 flex flex-wrap gap-3">
                {tabs.map((tab, index) => (
                  <Link
                    className="rounded-full border border-white/18 px-4 py-2 text-sm font-semibold text-white/78 transition hover:border-white/35 hover:text-white"
                    href={hrefFor(site, tab === "All" ? "/collections" : `/collections?category=${encodeURIComponent(dreamshootCategorySlug(tab))}`)}
                    key={tab}
                    style={index === 0 ? { background: dreamshootBrandGradient, borderColor: "transparent", color: "white" } : undefined}
                  >
                    {tab}
                  </Link>
                ))}
              </div>
            </div>
            <div className="lg:pb-4">
              <p className="max-w-[42rem] text-[clamp(1.12rem,1.7vw,1.55rem)] leading-[1.25] text-white/72">
                {setting(section, "subtitle", "This is where browsing turns into buying: each card has a clear outcome, credit cost, photo count, and one next action.")}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/12 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-white/72">
                  {directoryCount} active packages
                </span>
                <span className="rounded-full border border-white/12 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-white/72">
                  Reference breadth covered
                </span>
                <span className="rounded-full border border-white/12 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-white/72">
                  Editable in Products
                </span>
              </div>
              <div className="mt-8 rounded-[26px] border border-white/14 bg-white/[0.05] p-4 shadow-[0_28px_90px_-70px_rgba(0,0,0,0.95)]">
                <div className="flex flex-wrap items-center gap-4">
                  {steps.map((step, index) => (
                    <div className="flex items-center gap-3" key={step}>
                      <span className="grid h-9 w-9 place-items-center rounded-full text-sm font-bold text-white" style={{ background: dreamshootBrandGradient }}>{index + 1}</span>
                      <span className="text-[clamp(1rem,1.45vw,1.35rem)] font-semibold text-white">{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
            {featured.map((card, index) => (
              <Link
                className="group flex min-h-[386px] flex-col overflow-hidden rounded-[26px] border border-white/14 bg-[#11121C]/80 shadow-[0_34px_105px_-72px_rgba(0,0,0,0.98)] transition hover:-translate-y-1 hover:border-white/24"
                href={hrefFor(site, card.href)}
                key={card.id}
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-white/[0.04]">
                  <img className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.045]" src={card.imageUrl} alt={card.title} />
                  <span className="absolute left-4 top-4 rounded-full border border-white/18 bg-black/28 px-3 py-1.5 text-xs font-semibold text-white/88 backdrop-blur">{dreamshootCategoryLabel(card.category)}</span>
                  {index === 0 ? <span className="absolute inset-x-0 top-0 h-1" style={{ background: dreamshootBrandGradient }} /> : null}
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="text-[1.42rem] font-semibold leading-tight tracking-[-0.035em] text-white">{card.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/62">{card.description}</p>
                  <div className="mt-auto flex flex-wrap items-center gap-3 pt-7">
                    <span className="rounded-full bg-white/[0.08] px-3 py-1.5 text-xs font-semibold text-white/82">{card.meta}</span>
                    <span className="rounded-full bg-white/[0.08] px-3 py-1.5 text-xs font-semibold text-white/82">{card.credits}</span>
                    <ArrowRight className="ml-auto h-5 w-5 text-white/82 transition group-hover:translate-x-1" strokeWidth={1.8} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
          {rest.length ? (
            <div className="mt-9">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/42">Full directory</p>
                  <h3 className="mt-2 text-[clamp(1.65rem,3vw,2.45rem)] font-semibold tracking-[-0.045em] text-white">All package outcomes, not a short demo list.</h3>
                </div>
                <Link className="inline-flex items-center gap-2 rounded-full border border-white/14 px-4 py-2 text-sm font-semibold text-white/78 transition hover:border-white/28 hover:text-white" href={hrefFor(site, "/collections")}>
                  Open collections
                  <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                </Link>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {rest.map((card, index) => (
                  <Link
                    className="group overflow-hidden rounded-[22px] border border-white/10 bg-[#10121a]/74 shadow-[0_24px_74px_-64px_rgba(0,0,0,0.96)] transition hover:-translate-y-0.5 hover:border-white/24 hover:bg-white/[0.075]"
                    href={hrefFor(site, card.href)}
                    key={`rest_${card.id}`}
                  >
                    <div className="relative aspect-[1.42] overflow-hidden bg-white/[0.04]">
                      <img className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.045]" src={card.imageUrl} alt={card.title} />
                      <span className="absolute left-3 top-3 rounded-full border border-white/18 bg-black/32 px-2.5 py-1 text-[11px] font-semibold text-white/84 backdrop-blur">{dreamshootCategoryLabel(card.category)}</span>
                      {index < 3 ? <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-[#10121a]">Popular</span> : null}
                    </div>
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="min-w-0">
                          <h3 className="line-clamp-1 text-base font-semibold tracking-[-0.025em] text-white">{card.title}</h3>
                          <p className="mt-2 line-clamp-2 min-h-[2.6rem] text-sm leading-5 text-white/56">{card.description}</p>
                        </div>
                        <ArrowRight className="mt-1 h-4.5 w-4.5 shrink-0 text-white/46 transition group-hover:translate-x-1 group-hover:text-white/82" strokeWidth={1.8} />
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="rounded-full bg-white/[0.08] px-2.5 py-1 text-[11px] font-semibold text-white/76">{card.meta}</span>
                        <span className="rounded-full bg-white/[0.08] px-2.5 py-1 text-[11px] font-semibold text-white/76">{card.credits}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  if (section.type === "dreamshoot_flow_bridge") {
    const steps = sectionBlocks(section, "card");
    const fallbackSteps: SectionBlockInstance[] = [
      { id: "flow_upload", type: "card", settings: { title: "Upload selfies", text: "Use 8-12 clear phone photos per person.", meta: "01" } },
      { id: "flow_model", type: "card", settings: { title: "Build private model", text: "Keep identity consistent across packages.", meta: "02" } },
      { id: "flow_pack", type: "card", settings: { title: "Pick a package", text: "Choose the result, not a blank prompt.", meta: "03" } },
      { id: "flow_album", type: "card", settings: { title: "Generate album", text: "Review, download, upscale, or make video.", meta: "04" } }
    ];
    const displaySteps = (steps.length ? steps : fallbackSteps).slice(0, 4);
    const beforeImage = mediaAssetUrl(site, setting(section, "beforeImage", "/assets/dreamshoot/frames/workflow-upload-source.png"));
    const afterImage = mediaAssetUrl(site, setting(section, "afterImage", "/assets/dreamshoot/generated/20260618/hairstyle-preview-v1.png"));
    const albumImages = [
      setting(section, "albumImageOne", packImages.sports),
      setting(section, "albumImageTwo", packImages.headshots),
      setting(section, "albumImageThree", packImages.creative)
    ].map((image) => mediaAssetUrl(site, image));
    return (
      <section className="relative overflow-hidden bg-[#05070E] text-white" id={sectionAnchor(section, "workflow")}>
        <div className="absolute inset-x-0 top-0 h-[46%] bg-[radial-gradient(circle_at_74%_0%,rgba(122,76,255,0.32),transparent_32%),#05070E]" />
        <div className="absolute inset-0 opacity-35 [background-image:radial-gradient(circle_at_center,rgba(255,255,255,0.72)_1px,transparent_1px)] [background-size:96px_96px]" />
        <div className="relative mx-auto max-w-[var(--site-content-width)] px-5 py-16 md:py-24">
          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold uppercase tracking-[0.08em] text-white/62">
            <span>{setting(section, "label", "How it works + proof bridge")}</span>
          </div>
          <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,0.52fr)_minmax(0,0.48fr)]">
            <h2 className="max-w-[45rem] text-[clamp(2.8rem,7vw,5.25rem)] font-semibold leading-[0.95] tracking-[-0.06em] text-balance [font-family:var(--site-title-font)]">
              {setting(section, "title", "From upload to private album.")}
            </h2>
            <p className="max-w-[42rem] text-[clamp(1.12rem,1.7vw,1.55rem)] leading-[1.25] text-white/72 lg:pt-4">
              {setting(section, "subtitle", "After packages, reduce hesitation: explain the 4-step flow, show a before/after transformation, and make credits feel safe.")}
            </p>
          </div>
        </div>
        <div className="relative bg-[#F4F1EA] px-5 py-12 text-[#0C0D12] md:py-14">
          <div className="mx-auto max-w-[var(--site-content-width)]">
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {displaySteps.map((step, index) => (
                <article className={`rounded-[26px] border p-6 shadow-[0_24px_78px_-62px_rgba(10,10,12,0.35)] ${index < 2 ? "border-[#D7D1C7] bg-white" : "border-[#11131B] bg-[#0D0F18] text-white"}`} key={instanceKey(step, index, "flow_step")} {...xfcartBlockAttrs(step, index, "flow_step")}>
                  <div className="grid h-14 w-14 place-items-center rounded-full text-lg font-bold" style={index === 1 ? { background: dreamshootBrandGradient, color: "white" } : index < 2 ? { background: "#EFEFEF", color: "#0C0D12" } : { background: "rgba(255,255,255,0.08)", color: "white" }}>
                    {blockValue(step, "meta", `0${index + 1}`)}
                  </div>
                  <h3 className="mt-6 text-[1.35rem] font-semibold leading-tight tracking-[-0.03em]">{blockValue(step, "title", "Workflow step")}</h3>
                  <p className={index < 2 ? "mt-2 text-sm leading-6 text-[#586071]" : "mt-2 text-sm leading-6 text-white/64"}>{blockValue(step, "text", blockValue(step, "description", ""))}</p>
                </article>
              ))}
            </div>
            <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1fr)]">
              <div className="rounded-[28px] border border-[#D7D1C7] bg-white p-6 shadow-[0_24px_78px_-62px_rgba(10,10,12,0.35)]">
                <h3 className="text-[1.8rem] font-semibold leading-tight tracking-[-0.04em]">Before / after proof</h3>
                <p className="mt-2 max-w-xl text-[1.05rem] leading-6 text-[#586071]">Do not just explain the model. Show the customer what changes.</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                  <div className="relative h-[96px] overflow-hidden rounded-[22px] bg-[#101114]">
                    <img className="h-full w-full object-cover" src={beforeImage} alt="Before upload" />
                    <span className="absolute left-4 top-4 rounded-full bg-black/42 px-3 py-1 text-xs font-semibold text-white backdrop-blur">Before</span>
                  </div>
                  <div className="hidden h-[104px] w-px bg-[#b8b2a9] sm:block" />
                  <div className="relative h-[96px] overflow-hidden rounded-[22px] bg-[#101114]">
                    <img className="h-full w-full object-cover" src={afterImage} alt="After AI result" />
                    <span className="absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ background: dreamshootBrandGradient }}>After</span>
                  </div>
                </div>
              </div>
              <div className="rounded-[28px] border border-[#11131B] bg-[#0D0F18] p-6 text-white shadow-[0_24px_78px_-62px_rgba(10,10,12,0.55)]">
                <h3 className="text-[1.8rem] font-semibold leading-tight tracking-[-0.04em]">Private album workspace</h3>
                <p className="mt-2 max-w-2xl text-[1.05rem] leading-6 text-white/68">One signed-in place for uploads, credit ledger, finished albums, and add-ons.</p>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  {albumImages.map((image, index) => (
                    <div className="h-[86px] w-[132px] overflow-hidden rounded-[18px] bg-white/[0.06]" key={image}>
                      <img className="h-full w-full object-cover" src={image} alt={`Album preview ${index + 1}`} />
                    </div>
                  ))}
                  <div className="ml-auto grid h-[86px] min-w-[86px] place-items-center rounded-[20px] border border-white/12 bg-white/[0.06] px-4 text-center">
                    <div>
                      <p className="text-2xl font-semibold">200</p>
                      <p className="text-xs text-white/62">credits</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-center">
              <Link className="inline-flex w-full max-w-[560px] items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 active:scale-[0.98]" href={hrefFor(site, setting(section, "bridgeHref", "/pricing"))} style={{ background: dreamshootBrandGradient }}>
                {setting(section, "bridgeCta", "After this, show pricing with value already understood")}
                <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (section.type === "dreamshoot_tool_collection") {
    const blocks = sectionBlocks(section, "tool_card");
    const fallbackTools: SectionBlockInstance[] = [
      {
        id: "tool_background",
        type: "tool_card",
        settings: {
          title: "Background changer",
          description: "Swap a plain portrait background before creating a full scene pack.",
          category: "AI Photo Edit",
          badge: "Free",
          imageUrl: dreamshootToolSceneDefaults.entry,
          href: "/tools/image-studio"
        }
      },
      {
        id: "tool_preview",
        type: "tool_card",
        settings: {
          title: "Package preview",
          description: "Try a guided package preview before subscribing to full private packs.",
          category: "AI Photo",
          badge: "Popular",
          imageUrl: fallbackHeroImages[0],
          href: "/tools/image-studio"
        }
      },
      {
        id: "tool_video",
        type: "tool_card",
        settings: {
          title: "Image to video",
          description: "Turn a favorite generated photo into a short motion concept.",
          category: "AI Video",
          badge: "Preview",
          imageUrl: dreamshootToolSceneDefaults.progress,
          href: "/tools/image-studio"
        }
      }
    ];
    const tools = blocks.length ? blocks : fallbackTools;
    const configuredCategories = listLines(setting(section, "categories", "AI Photo Edit|AI Photo|AI Video"));
    const categories = configuredCategories.length ? configuredCategories : Array.from(new Set(tools.map((tool) => blockValue(tool, "category", "AI Photo"))));
    const layout = setting(section, "layout", "directory");
    const dark = layout === "dark";
    if (layout === "mega_menu") {
      return (
        <section className="relative isolate overflow-hidden bg-[#08080a] px-4 py-10 text-white sm:px-5 sm:py-14" id={sectionAnchor(section, "free-tools")}>
          <div className="absolute inset-0 -z-10 opacity-46">
            <div className="grid h-full min-h-[620px] grid-cols-3 gap-3 blur-[0.2px] sm:grid-cols-4 lg:grid-cols-6">
              {tools.slice(0, 12).map((tool, index) => (
                <div className={`overflow-hidden rounded-[16px] bg-zinc-900 ${index % 4 === 0 ? "translate-y-7" : ""}`} key={`mega_bg_${tool.id}_${index}`}>
                  <img className="h-full min-h-[180px] w-full object-cover opacity-76" src={mediaAssetUrl(site, blockValue(tool, "imageUrl", fallbackHeroImages[index % fallbackHeroImages.length]))} alt="" />
                </div>
              ))}
            </div>
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,8,10,0.97)_0%,rgba(8,8,10,0.84)_48%,rgba(8,8,10,0.96)_100%)]" />
          </div>
          <div className="mx-auto max-w-[1180px]">
            <DreamShootMegaToolsPanel
              ctaHref={setting(section, "secondaryHref", "/tools")}
              ctaLabel={setting(section, "secondaryCta", "View all tools")}
              site={site}
              tools={tools}
              variant="section"
            />
          </div>
        </section>
      );
    }
    return (
      <section className={dark ? "bg-[#0a0a0b] px-5 py-16 text-white" : "bg-[#fffaf3] px-5 py-16 text-[#14161a]"} id={sectionAnchor(section, "free-tools")}>
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <div className="grid gap-7 lg:grid-cols-[minmax(0,0.54fr)_minmax(0,0.46fr)] lg:items-end">
            <div>
              <p className={dark ? "text-[11px] font-medium uppercase tracking-[0.14em] text-white/48" : "text-[11px] font-medium uppercase tracking-[0.14em] text-[#7a7c80]"}>
                {setting(section, "eyebrow", "Free AI tools")}
              </p>
              <h2 className="mt-4 max-w-4xl text-[clamp(2rem,4vw,4.15rem)] font-semibold leading-[1.02] tracking-tight text-balance [font-family:var(--site-title-font)]">
                {setting(section, "title", "Free AI tools that lead into private photo packs.")}
              </h2>
            </div>
            <div>
              <p className={dark ? "max-w-2xl text-sm leading-7 text-white/62" : "max-w-2xl text-sm leading-7 text-[#63666d]"}>
                {setting(section, "subtitle")}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {categories.map((category) => (
                  <a
                    className={dark ? "rounded-full border border-white/12 bg-white/[0.06] px-3 py-1.5 text-xs text-white/72 transition hover:bg-white/[0.1]" : "rounded-full border border-[#ded5ca] bg-white px-3 py-1.5 text-xs text-[#5f6269] transition hover:border-[#14161a]/20 hover:text-[#14161a]"}
                    href={`#${sectionAnchor(section, "free-tools")}-${slugify(category)}`}
                    key={category}
                  >
                    {category}
                  </a>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-10 grid gap-7">
            {categories.map((category) => {
              const grouped = tools.filter((tool) => blockValue(tool, "category", "AI Photo") === category);
              if (!grouped.length) return null;
              return (
                <div className={dark ? "rounded-[28px] border border-white/10 bg-white/[0.05] p-4 sm:p-5" : "rounded-[28px] border border-[#e2d8cc] bg-white/72 p-4 shadow-[0_28px_80px_-62px_rgba(20,22,26,0.2)] sm:p-5"} id={`${sectionAnchor(section, "free-tools")}-${slugify(category)}`} key={category}>
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <h3 className="text-[1.08rem] font-semibold tracking-tight">{category}</h3>
                    <span className={dark ? "rounded-full bg-white/[0.08] px-2.5 py-1 text-xs text-white/52" : "rounded-full bg-[#f5eee5] px-2.5 py-1 text-xs text-[#7a6d60]"}>
                      {grouped.length} tools
                    </span>
                  </div>
                  <div className={layout === "compact" ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-3" : "grid gap-4 md:grid-cols-2 xl:grid-cols-3"}>
                    {grouped.map((tool, index) => {
                      const image = mediaAssetUrl(site, blockValue(tool, "imageUrl", fallbackHeroImages[index % fallbackHeroImages.length]));
                      return (
                        <Link
                          className={dark ? "group overflow-hidden rounded-[22px] border border-white/10 bg-black/24 text-white transition hover:-translate-y-1 hover:bg-black/32" : "group overflow-hidden rounded-[22px] border border-[#e5dbce] bg-[#fbfaf7] text-[#14161a] transition hover:-translate-y-1 hover:bg-white"}
                          href={hrefFor(site, blockValue(tool, "href", "/tools/image-studio"))}
                          key={instanceKey(tool, index, "dreamshoot_tool")}
                          {...xfcartBlockAttrs(tool, index, "dreamshoot_tool")}
                        >
                          <div className="grid grid-cols-[104px_1fr] gap-0 sm:grid-cols-[128px_1fr]">
                            <div className="h-full min-h-[148px] overflow-hidden bg-zinc-900">
                              <img className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" src={image} alt={blockValue(tool, "title", "AI tool")} />
                            </div>
                            <div className="flex min-w-0 flex-col p-4">
                              <div className="flex items-center justify-between gap-2">
                                <span className={dark ? "rounded-full bg-white/[0.08] px-2.5 py-1 text-[11px] text-white/58" : "rounded-full bg-[#f3eadf] px-2.5 py-1 text-[11px] text-[#78695b]"}>
                                  {blockValue(tool, "badge", "Free")}
                                </span>
                                <ArrowRight className={dark ? "h-4 w-4 text-white/42 transition group-hover:translate-x-1" : "h-4 w-4 text-[#858077] transition group-hover:translate-x-1"} strokeWidth={1.8} />
                              </div>
                              <h4 className="mt-4 text-[1.05rem] font-semibold leading-tight tracking-tight">{blockValue(tool, "title", "AI photo tool")}</h4>
                              <p className={dark ? "mt-2 line-clamp-3 text-sm leading-6 text-white/58" : "mt-2 line-clamp-3 text-sm leading-6 text-[#63666d]"}>
                                {blockValue(tool, "description")}
                              </p>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className={dark ? "inline-flex items-center gap-2 rounded-[16px] bg-white px-5 py-3 text-sm font-semibold text-[#101114] transition hover:-translate-y-0.5 active:scale-[0.98]" : "inline-flex items-center gap-2 rounded-[16px] bg-[#14161a] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 active:scale-[0.98]"} href={hrefFor(site, setting(section, "primaryHref", "/login"))}>
              {setting(section, "primaryCta", "Start private studio")}
              <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
            </Link>
            <Link className={dark ? "inline-flex items-center gap-2 rounded-[16px] border border-white/14 bg-white/[0.06] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/[0.1] active:scale-[0.98]" : "inline-flex items-center gap-2 rounded-[16px] border border-[#ded5ca] bg-white px-5 py-3 text-sm font-semibold text-[#14161a] transition hover:-translate-y-0.5 hover:bg-[#fbfaf7] active:scale-[0.98]"} href={hrefFor(site, setting(section, "secondaryHref", "/collections"))}>
              {setting(section, "secondaryCta", "View packs")}
              <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (section.type === "shoot_pack_marquee") {
    const usePacks = setting(section, "source", "creative_packs") === "creative_packs";
    const packItems = creativePacks.filter((pack) => pack.status === "active");
    const manualItems = sectionBlocks(section, "package");
    const cards = usePacks
      ? packItems.map((pack) => ({
          id: pack.id,
          title: pack.name,
          description: pack.description || pack.headline,
          meta: `${pack.outputCount} photos`,
          credits: `${pack.creditCost} credits`,
          imageUrl: packImages[pack.category] ?? packImages.fashion,
          href: `/tools/${pack.aiAppSlug}`
        }))
      : manualItems.map((item) => ({
          id: item.id,
          title: blockValue(item, "title"),
          description: blockValue(item, "description"),
          meta: blockValue(item, "meta"),
          credits: blockValue(item, "credits"),
          imageUrl: mediaAssetUrl(site, blockValue(item, "imageUrl", packImages.seasonal)),
          href: blockValue(item, "href", "/tools/image_generator")
        }));
    const fallbackCards = [
      { id: "worldcup", title: "World Cup Fan Photos", description: "Stadium portraits, fan posters, and match-day profile scenes.", meta: "40 photos", credits: "26 credits", imageUrl: packImages.sports, href: "/tools/image_generator" },
      { id: "creator_portraits", title: "Creator Portraits", description: "Profile, landing-page, and newsletter-ready portraits from selfies.", meta: "20 photos", credits: "16 credits", imageUrl: packImages.creator, href: "/tools/image_generator" },
      { id: "gala", title: "Gala Photos", description: "Formal night-out scenes and editorial lighting.", meta: "40 photos", credits: "22 credits", imageUrl: packImages.gala, href: "/tools/image_generator" }
    ];
    const displayCards = [...(cards.length ? cards : fallbackCards), ...(cards.length ? cards : fallbackCards)];
    return (
      <section className="overflow-hidden bg-white px-5 py-16" id={sectionAnchor(section, "packs")}>
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <div className="grid gap-6 md:grid-cols-[0.72fr_1fr] md:items-end">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--site-accent)]">{setting(section, "eyebrow", "Popular packs")}</p>
              <h2 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight tracking-tight md:text-5xl">{setting(section, "title")}</h2>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-zinc-600 md:justify-self-end">{setting(section, "subtitle")}</p>
          </div>
        </div>
        <div className="mt-9 flex gap-4 overflow-hidden">
          <div className="flex min-w-max gap-4 animate-[sample-drift_42s_linear_infinite]">
            {displayCards.map((card, index) => (
              <Link className="group w-[280px] shrink-0 overflow-hidden rounded-[1.35rem] border border-black/10 bg-white shadow-[0_24px_80px_-58px_rgba(24,24,27,0.55)] transition hover:-translate-y-1 md:w-[360px]" href={hrefFor(site, card.href)} key={`${card.id}_${index}`}>
                <div className="aspect-[4/5] overflow-hidden bg-zinc-200">
                  <img className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" src={card.imageUrl} alt={card.title} />
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">{card.meta}</span>
                    <span className="font-mono text-xs text-zinc-500">{card.credits}</span>
                  </div>
                  <h3 className="mt-4 text-xl font-semibold tracking-tight">{card.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">{card.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (section.type === "sample_strip") {
    const items = settingListBlocks(
      section,
      "items",
      [
        `Creator studio|${packImages.creator}|Profile album`,
        `Headshot|${packImages.headshots}|Profile pack`,
        `Editorial|${packImages.fashion}|Studio set`,
        `Travel|${packImages.travel}|Destination pack`
      ],
      (item, index) => {
        const [label, imageUrl, meta] = parseTriplet(item);
        return { id: `legacy_sample_${index}`, type: "sample", settings: { label, imageUrl, meta } };
      }
    );
    const displayItems = items.length ? items : [...items, ...items].slice(0, Math.max(items.length, 8));
    const isProblemStrip = sectionAnchor(section, "samples") === "pain-points";
    if (isProblemStrip) {
      return (
        <section className="overflow-hidden bg-[#fffaf3] px-5 py-12 text-[#171514] md:py-14" id={sectionAnchor(section, "pain-points")}>
          <div className="mx-auto max-w-[var(--site-content-width)]">
            <div className="text-center">
              <h2 className="mx-auto max-w-4xl text-[clamp(2rem,3.7vw,3.15rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-balance [font-family:var(--site-title-font)]">
                {setting(section, "title")}
              </h2>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {displayItems.map((item, index) => {
                const label = blockValue(item, "label", "Problem");
                const image = mediaAssetUrl(site, blockValue(item, "imageUrl", blockValue(item, "image", packImages.fashion)));
                const meta = blockValue(item, "meta", "Pain point");
                return (
                  <article className="group overflow-hidden rounded-[22px] border border-[#d8cdbf] bg-white shadow-[0_24px_60px_-54px_rgba(20,22,26,0.18)]" key={`${item.id}_${index}`} {...xfcartBlockAttrs(item, index, "pain_point")}>
                    <div className="relative aspect-[1.18/1] overflow-hidden bg-[#272321] lg:aspect-[1.03/1]">
                      <img className="h-full w-full object-cover grayscale transition duration-500 group-hover:scale-[1.04]" src={image} alt={label} />
                      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,8,9,0.16)_0%,rgba(8,8,9,0.28)_42%,rgba(8,8,9,0.64)_100%)]" />
                      <div className="absolute inset-x-0 bottom-0 p-4 text-white lg:p-5">
                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/22 backdrop-blur xl:mb-4">
                          {index === 0 ? <BadgeCheck className="h-5 w-5" strokeWidth={1.8} /> : index === 1 ? <Clock3 className="h-5 w-5" strokeWidth={1.8} /> : index === 2 ? <CloudRain className="h-5 w-5" strokeWidth={1.8} /> : <Globe2 className="h-5 w-5" strokeWidth={1.8} />}
                        </div>
                        <h3 className="text-[1.22rem] font-semibold leading-tight tracking-[-0.02em] lg:text-[1.34rem]">{label}</h3>
                        <p className="mt-2 max-w-[19ch] text-[0.86rem] leading-5 text-white/78 lg:text-[0.9rem]">{meta}</p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      );
    }
    const shouldUseGrid = displayItems.length <= 6 || setting(section, "presentation", "grid") === "grid";
    return (
      <section className="overflow-hidden border-y border-black/10 bg-white px-5 py-14 text-[#171514]" id={sectionAnchor(section, "samples")}>
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.56fr)_minmax(0,0.44fr)] lg:items-end">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#7a7c80]">{setting(section, "eyebrow", "Generated looks")}</p>
              <h2 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight tracking-tight md:text-5xl">{setting(section, "title")}</h2>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-zinc-600 lg:justify-self-end">{setting(section, "subtitle")}</p>
          </div>
        </div>
        <div className="mx-auto mt-9 max-w-[var(--site-content-width)]">
          {shouldUseGrid ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {displayItems.map((item, index) => {
                const label = blockValue(item, "label", blockValue(item, "title", "Sample"));
                const image = mediaAssetUrl(site, blockValue(item, "imageUrl", blockValue(item, "image", packImages.fashion)));
                const meta = blockValue(item, "meta", "AI photo set");
                return (
                  <article className="overflow-hidden rounded-[1.25rem] border border-[#e2ddcf] bg-[#fbfaf7] shadow-[0_24px_60px_-48px_rgba(20,22,26,0.22)]" key={`${item.id}_${index}`} {...xfcartBlockAttrs(item, index, "sample")}>
                    <div className="aspect-[4/5] overflow-hidden bg-zinc-200">
                      <img className="h-full w-full object-cover" src={image} alt={label} />
                    </div>
                    <div className="flex items-start justify-between gap-3 p-4">
                      <h3 className="text-[1rem] font-medium leading-6">{label}</h3>
                      <span className="font-mono text-xs text-[#72747c]">{meta}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="flex gap-4 overflow-hidden">
              <div className={`flex min-w-max gap-4 ${setting(section, "speed", "slow") === "slow" ? "animate-[sample-drift_38s_linear_infinite]" : ""}`}>
                {displayItems.map((item, index) => {
                  const label = blockValue(item, "label", blockValue(item, "title", "Sample"));
                  const image = mediaAssetUrl(site, blockValue(item, "imageUrl", blockValue(item, "image", packImages.fashion)));
                  const meta = blockValue(item, "meta", "AI photo set");
                  return (
                    <article className="w-[230px] shrink-0 overflow-hidden rounded-[1.25rem] border border-[#e2ddcf] bg-[#fbfaf7] shadow-[0_24px_60px_-48px_rgba(20,22,26,0.22)] md:w-[300px]" key={`${item.id}_${index}`} {...xfcartBlockAttrs(item, index, "sample")}>
                      <div className="aspect-[4/5] overflow-hidden bg-zinc-200">
                        <img className="h-full w-full object-cover" src={image} alt={label} />
                      </div>
                      <div className="flex items-center justify-between gap-3 p-4">
                        <h3 className="font-medium">{label}</h3>
                        <span className="font-mono text-xs text-[#72747c]">{meta}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>
    );
  }

  if (section.type === "studio_steps") {
    const steps = settingListBlocks(
      section,
      "items",
      [
        "Upload selfies|Customers add clear photos for each person.|01",
        "Prepare your look|A private profile helps keep faces, styling, and scene details consistent.|02",
        "Choose a pack|Packages carry credit rules and output counts.|03",
        "Deliver album|Finished results arrive in a private gallery with clear credit settlement.|04"
      ],
      (item, index) => {
        const [title, text, meta] = parseTriplet(item);
        return { id: `legacy_step_${index}`, type: "card", settings: { title, text, meta } };
      }
    );
    const stepIcons = [UploadCloud, Search, Sparkles, Download];
    return (
      <section className="relative overflow-hidden bg-[#fffaf3] px-5 py-20 text-[#171514]" id={sectionAnchor(section, "workflow")}>
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <div className="mx-auto max-w-3xl text-center">
            <div className="flex items-center justify-center gap-5">
              <div className="hidden h-px w-20 bg-[#d8cab9] sm:block" />
              <h2 className="text-4xl font-semibold leading-[1.01] tracking-tight text-balance [font-family:var(--site-title-font)] md:text-5xl">{setting(section, "title")}</h2>
              <div className="hidden h-px w-20 bg-[#d8cab9] sm:block" />
            </div>
            <p className="mt-5 text-sm leading-7 text-[#6d665f]">{setting(section, "subtitle")}</p>
          </div>
          <div className="relative mt-10">
            <div className="grid gap-4 lg:grid-cols-4">
              {steps.map((step, index) => {
                const Icon = stepIcons[index] || Sparkles;
                return (
                  <article className="relative rounded-[24px] border border-[#ece1d4] bg-white px-5 py-5 shadow-[0_24px_60px_-52px_rgba(20,22,26,0.12)]" key={instanceKey(step, index, "step")}>
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#f7efe5] text-[#171514]">
                        <Icon className="h-5 w-5" strokeWidth={1.8} />
                      </div>
                      <h3 className="text-[1.18rem] font-semibold leading-tight tracking-tight text-[#171514]">
                        {blockValue(step, "meta", `${index + 1}`)}. {blockValue(step, "title")}
                      </h3>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-[#6d665f]">{blockValue(step, "text")}</p>
                    {index < steps.length - 1 ? <ArrowRight className="absolute -right-3 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-[#c9b8a3] lg:block" strokeWidth={1.8} /> : null}
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (section.type === "conversion_panel") {
    const stats = sectionBlocks(section, "stat");
    return (
      <section className="px-5 py-16" id={sectionAnchor(section, "start")}>
        <div className="mx-auto grid max-w-[var(--site-content-width)] overflow-hidden rounded-[1.7rem] border border-[#ddd7cb] bg-[#fbfaf7] shadow-[0_28px_75px_-52px_rgba(20,22,26,0.24)] md:grid-cols-[1fr_0.78fr]">
          <div className="p-8 text-[#14161a] md:p-12">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#7a7c80]">{setting(section, "eyebrow", "Start creating")}</p>
            <h2 className="mt-5 max-w-3xl text-3xl font-semibold leading-tight tracking-tight md:text-5xl">{setting(section, "title")}</h2>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-[#64686f]">{setting(section, "subtitle")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="inline-flex items-center gap-2 rounded-full bg-[#14161a] px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5 active:scale-[0.98]" href={hrefFor(site, setting(section, "primaryHref", "/login"))}>
                {setting(section, "primaryCta", "Create account")}
                <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
              </Link>
              <Link className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-medium text-[#14161a] transition hover:-translate-y-0.5 active:scale-[0.98]" href={hrefFor(site, setting(section, "secondaryHref", "/pricing"))}>
                {setting(section, "secondaryCta", "View pricing")}
                <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
              </Link>
            </div>
          </div>
          <div className="grid border-t border-[#e4dfd4] bg-[#f5f2eb] md:border-l md:border-t-0">
            {(stats.length ? stats : [
              { id: "metric_outputs", type: "stat", settings: { value: "40", label: "images in premium packs" } },
              { id: "metric_private", type: "stat", settings: { value: "Private", label: "customer albums" } },
              { id: "metric_credits", type: "stat", settings: { value: "Credits", label: "clear checkout history" } }
            ]).map((stat, index) => (
              <div className="border-b border-[#e4dfd4] p-7 last:border-b-0" key={instanceKey(stat, index, "conversion_stat")}>
                <p className="font-mono text-3xl text-[#14161a]">{blockValue(stat, "value")}</p>
                <p className="mt-2 text-sm leading-6 text-[#65686f]">{blockValue(stat, "label")}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (section.type === "pricing_table") {
    const configuredFeaturedProductId = selectorIdSetting(section, "featuredProductId", "");
    const displayProducts = products.filter((product) => product.type === "subscription" && product.status === "active");
    const creditPacks = products.filter((product) => product.type === "credit_pack" && product.status === "active");
    const featuredProductId =
      displayProducts.find((product) => product.id === configuredFeaturedProductId)?.id ??
      displayProducts.find((product) => priceMetaBool(productPrice(product), "featured", false))?.id ??
      displayProducts[0]?.id;
    const pricingImage = mediaAssetUrl(site, setting(section, "backgroundImage", "/assets/dreamshoot/generated/20260619/cyberpunk-solo-city-v1.png"));
    return (
      <section className="relative overflow-hidden bg-[#111114] px-5 py-16 text-white" id={sectionAnchor(section, "plans")}>
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_28%,rgba(255,210,158,0.12),transparent_18%)]" />
          <div className="absolute right-0 top-0 hidden h-full w-[52%] overflow-hidden lg:block">
            <img className="h-full w-full object-cover object-center opacity-[0.9]" src={pricingImage} alt={setting(section, "title", "Pricing background")} />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(17,17,20,0.86)_0%,rgba(17,17,20,0.48)_32%,rgba(17,17,20,0.12)_74%,rgba(17,17,20,0.24)_100%)]" />
          </div>
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(12,12,14,0.98)_0%,rgba(12,12,14,0.96)_42%,rgba(12,12,14,0.68)_60%,rgba(12,12,14,0.18)_100%)]" />
        </div>
        <div className="relative mx-auto max-w-[var(--site-content-width)]">
          <div className="max-w-[48rem]">
            <h2 className="text-[clamp(2.25rem,3.6vw,3.35rem)] font-semibold leading-[1.04] tracking-[-0.03em] text-balance [font-family:var(--site-title-font)]">
              {setting(section, "title", "Simple, Transparent Pricing")}
            </h2>
            <p className="mt-3 text-[0.98rem] leading-7 text-white/72">{setting(section, "subtitle", "Choose the right credit plan for private AI photo packages.")}</p>
          </div>
          <div className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,0.72fr)_minmax(300px,0.28fr)]">
            <div className="grid gap-4 lg:grid-cols-3">
              {displayProducts.slice(0, 3).map((product) => {
                const price = productPrice(product);
                if (!price) return null;
                const deliveryDays = priceMetaNumber(price, "deliveryDays", product.name === "Deluxe" ? 1 : product.name === "Premium" ? 2 : 3);
                const destinations = priceMetaNumber(price, "destinationCount", product.name === "Deluxe" ? 999 : product.name === "Premium" ? 4 : 2);
                const photos = priceMetaNumber(price, "generatedPhotos", product.name === "Deluxe" ? 60 : product.name === "Premium" ? 30 : 15);
                const featured = product.id === featuredProductId;
                const pricePeriod = price.interval === "month" ? "/ month" : "one-time";
                const originalAmountCents = priceMetaNumber(price, "originalAmountCents", 0);
                const discountLabel = priceMetaString(price, "discountLabel", "");
                const planSubtitle = priceMetaString(
                  price,
                  "planSubtitle",
                  product.name === "Starter"
                    ? "For your first private AI shoot"
                    : product.name === "Popular"
                      ? "Balanced credits for more styles"
                      : "Maximum credits for premium packs"
                );
                const editingLabel = priceMetaString(
                  price,
                  "editingLabel",
                  product.name === "Premium" || product.name === "Deluxe" ? "Advanced editing" : "Basic editing"
                );
                return (
                  <div className={`relative flex h-full flex-col rounded-[12px] border ${featured ? "border-[#c99152] bg-white text-[#171514] ring-1 ring-[#e9bf89]" : "border-white/12 bg-white text-[#171514]"} p-5 shadow-[0_28px_66px_-52px_rgba(0,0,0,0.28)]`} key={product.id}>
                    {featured ? (
                      <div className="absolute left-5 top-5 rounded-full bg-[#c99152] px-3 py-1.5 text-center text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-white shadow-[0_16px_34px_-24px_rgba(201,145,82,0.85)]">
                        {setting(section, "featuredBadgeLabel", "Most Popular")}
                      </div>
                    ) : null}
                    <p className={`${featured ? "mt-12" : "mt-2"} text-[1.72rem] font-semibold leading-none tracking-[-0.03em] [font-family:var(--site-title-font)]`}>{product.name}</p>
                    <p className="mt-2 min-h-[2.75rem] text-[0.92rem] text-[#6d665f]">{planSubtitle}</p>
                    <div className="mt-6 flex items-end gap-2">
                      <p className="text-[2.65rem] font-semibold leading-none tracking-[-0.04em] [font-family:var(--site-title-font)]">{formatCurrency(price.amountCents, price.currency)}</p>
                      <p className="pb-2 text-[0.88rem] text-[#7f786f]">{pricePeriod}</p>
                    </div>
                    {originalAmountCents > price.amountCents ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="text-sm text-[#8a837b] line-through">{formatCurrency(originalAmountCents, price.currency)}</span>
                        {discountLabel ? <span className="rounded-full bg-[#f4e0c7] px-2.5 py-1 text-[0.72rem] font-semibold text-[#8a5728]">{discountLabel}</span> : null}
                      </div>
                    ) : null}
                    <div className="mt-6 grid gap-2.5 text-[0.88rem] text-[#4f4944]">
                      <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#b07b47]" strokeWidth={1.8} /><span>{price.creditsGranted} credits included</span></div>
                      <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#b07b47]" strokeWidth={1.8} /><span>{photos} AI-generated photos</span></div>
                      <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#b07b47]" strokeWidth={1.8} /><span>{destinations >= 999 ? "Unlimited destinations / styles" : `${destinations} destinations / styles`}</span></div>
                      <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#b07b47]" strokeWidth={1.8} /><span>High-resolution images</span></div>
                      <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#b07b47]" strokeWidth={1.8} /><span>{deliveryDays}-day delivery</span></div>
                      <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#b07b47]" strokeWidth={1.8} /><span>{editingLabel}</span></div>
                    </div>
                    <Link className={`mt-6 inline-flex min-h-[48px] w-full items-center justify-center rounded-[10px] text-[0.95rem] font-semibold transition hover:-translate-y-0.5 ${featured ? "bg-[#c99152] text-white" : "bg-[#171514] text-white"}`} href={hrefFor(site, `/cart?product=${product.id}&price=${price.id}`)}>
                      Select plan
                    </Link>
                  </div>
                );
              })}
            </div>
            <div className="relative hidden min-h-[430px] xl:block" aria-hidden="true">
              <div className="absolute inset-y-0 right-0 flex w-full flex-col justify-between rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.09)_0%,rgba(255,255,255,0.03)_100%)] p-6 shadow-[0_28px_80px_-52px_rgba(0,0,0,0.72)] backdrop-blur">
                <div>
                  <p className="text-[0.74rem] font-semibold uppercase tracking-[0.18em] text-[#d8a76a]">Why people subscribe</p>
                  <h3 className="mt-3 max-w-[14ch] text-[1.9rem] font-semibold leading-[1.02] tracking-[-0.03em] [font-family:var(--site-title-font)]">
                    Credits stay predictable while packs stay flexible.
                  </h3>
                  <p className="mt-4 max-w-[26rem] text-[0.94rem] leading-7 text-white/68">
                    Customers can start with a monthly plan, test multiple styles, and only top up when they need extra runs for a new occasion.
                  </p>
                </div>
                <div className="grid gap-3">
                  {[
                    ["Starter", "Best for one focused headshot, portrait, or travel set."],
                    ["Popular", "Balanced for buyers comparing several package looks."],
                    ["Premium", "Highest credit volume for repeat campaigns and add-ons."]
                  ].map(([label, detail]) => (
                    <div className="rounded-[16px] border border-white/10 bg-white/[0.06] px-4 py-4" key={label}>
                      <p className="text-sm font-semibold text-white">{label}</p>
                      <p className="mt-1 text-sm leading-6 text-white/64">{detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {creditPacks.length ? (
            <div className="mt-5 rounded-[16px] border border-white/10 bg-white/[0.06] p-4 backdrop-blur">
              <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <p className="text-[0.78rem] font-semibold uppercase tracking-[0.18em] text-[#d8a76a]">Add-on credits</p>
                  <h3 className="mt-2 text-[1.35rem] font-semibold tracking-[-0.02em] [font-family:var(--site-title-font)]">Need more generations this month?</h3>
                  <p className="mt-1 text-sm leading-6 text-white/66">One-time credit packs are sold separately from subscriptions and are still read from the same product catalog.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  {creditPacks.slice(0, 2).map((product) => {
                    const price = productPrice(product);
                    if (!price) return null;
                    return (
                      <Link className="flex min-w-[260px] items-center justify-between gap-4 rounded-[12px] border border-white/12 bg-[#f7f3ec] px-4 py-3 text-[#171514] transition hover:-translate-y-0.5" href={hrefFor(site, `/cart?product=${product.id}&price=${price.id}`)} key={product.id}>
                        <span>
                          <span className="block text-sm font-semibold">{product.name}</span>
                          <span className="mt-0.5 block text-xs text-[#6d665f]">{price.creditsGranted} one-time credits</span>
                        </span>
                        <span className="font-mono text-sm">{formatCurrency(price.amountCents, price.currency)}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  if (section.type === "ai_tool_grid") {
    const apps = siteAiApps.filter((app) => app.enabled);
    return (
      <section className="bg-[#fffdf8] px-5 py-16 text-[#14161a]" id={sectionAnchor(section, "tools")}>
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <div className="grid gap-6 md:grid-cols-[0.7fr_1fr] md:items-end">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#8a7a6d]">installed AI apps</p>
              <h2 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.04] tracking-tight text-balance [font-family:var(--site-title-font)] md:text-6xl">{setting(section, "title")}</h2>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-[#625d56] md:justify-self-end">{setting(section, "subtitle")}</p>
          </div>
          <div className="mt-9 grid gap-4 md:grid-cols-[1fr_1.25fr]">
            {apps.map((app, index) => (
              <Link
                href={hrefFor(site, `/tools/${app.aiApp.slug}`)}
                key={app.id}
                className={`group rounded-[26px] border border-[#ded5ca] bg-[#f7f3ec] p-6 shadow-[0_24px_70px_-58px_rgba(20,22,26,0.24)] transition hover:-translate-y-1 hover:bg-white ${
                  index === 1 ? "md:row-span-2" : ""
                }`}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[#14161a] text-white">
                  {app.aiApp.appType === "image" ? <Camera className="h-5 w-5" strokeWidth={1.8} /> : <ImageIcon className="h-5 w-5" strokeWidth={1.8} />}
                </div>
                <p className="mt-6 font-mono text-xs uppercase tracking-[0.2em] text-[#8a7a6d]">private album experience</p>
                <h3 className="mt-5 text-2xl font-semibold tracking-tight">{app.aiApp.name}</h3>
                <p className="mt-3 text-sm leading-6 text-[#625d56]">{app.aiApp.description}</p>
                <p className="mt-6 flex items-center gap-2 font-mono text-sm text-[#14161a]">
                  {app.creditCost} credits per run
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" strokeWidth={1.8} />
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (section.type === "ai_tool_entry") {
    const appSlug = setting(section, "aiAppSlug", "image_generator");
    const boundApp =
      siteAiApps.find((app) => app.enabled && app.aiApp.slug === appSlug) ??
      siteAiApps.find((app) => app.enabled) ??
      siteAiApps[0];
    const customerSignedIn = Boolean(runtime?.customer) && !runtime?.isPreview;
    const actionHref = hrefFor(site, customerSignedIn ? "/app" : "/login");
    const actionLabel = customerSignedIn ? setting(section, "ctaLabel", "Open workspace") : "Sign in to start";
    const heroImage = mediaAssetUrl(site, setting(section, "imageUrl", dreamshootToolSceneDefaults.entry));
    return (
      <section className="grid-paper overflow-hidden bg-[#fffaf3] px-5 py-18 text-[#14161a]">
        <div className="mx-auto grid max-w-[var(--site-content-width)] gap-8 md:grid-cols-[0.82fr_1.18fr] md:items-center">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#8a7a6d]">{setting(section, "eyebrow", "Customer-facing tool")}</p>
            <h1 className="mt-4 max-w-4xl text-4xl font-semibold leading-[1.02] tracking-tight text-balance [font-family:var(--site-title-font)] md:text-6xl">{setting(section, "title", "AI tool")}</h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-[#625d56]">{setting(section, "subtitle")}</p>
            <div className="mt-7 rounded-[30px] border border-[#e2d7ca] bg-white/88 p-5 shadow-[0_24px_72px_-56px_rgba(20,22,26,0.14)]">
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ["Upload", "private intake"],
                  ["Hold", `${boundApp?.creditCost ?? 0} credits`],
                  ["Deliver", "album gallery"]
                ].map(([label, detail]) => (
                  <div className="rounded-[20px] border border-[#ece2d7] bg-[#fcf8f2] px-4 py-4" key={label}>
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#9d8c7d]">{label}</p>
                    <p className="mt-2 text-sm font-semibold text-[#171514]">{detail}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-[0.54fr_0.46fr]">
                <div className="rounded-[22px] border border-[#ece2d7] bg-[#fbf6ef] px-4 py-4">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#9d8c7d]">why this converts</p>
                  <p className="mt-2 text-sm leading-6 text-[#6d665f]">The tool page reads like one guided customer journey: intake, credit hold, private progress, then finished gallery delivery.</p>
                </div>
                <div className="rounded-[22px] border border-[#ece2d7] bg-white px-4 py-4">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#9d8c7d]">album promise</p>
                  <p className="mt-2 text-sm leading-6 text-[#6d665f]">Scene styling, private delivery, and finished galleries stay tied to the same customer account.</p>
                </div>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link className="inline-flex items-center gap-2 rounded-[16px] bg-[#14161a] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 active:scale-[0.98]" href={actionHref}>
                {actionLabel}
                <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
              </Link>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#9d8c7d]">
                {boundApp ? `${boundApp.creditCost} credits per private request` : "Private request flow"}
              </span>
            </div>
          </div>
          <div className="rounded-[34px] border border-[#ded5ca] bg-[#fffdf8]/92 p-4 shadow-[0_34px_100px_-72px_rgba(20,22,26,0.32)]">
            <div className="relative min-h-[500px] overflow-hidden rounded-[30px] bg-[#efe6d9]">
              <img className="absolute inset-0 h-full w-full object-cover" src={heroImage} alt={setting(section, "title", "AI tool")} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/68 via-black/8 to-transparent" />
              <div className="absolute left-5 top-5 max-w-[220px] rounded-[22px] border border-white/30 bg-white/18 p-4 text-white backdrop-blur">
                <Sparkles className="h-7 w-7" strokeWidth={1.6} />
                <div className="mt-1">
                  <p className="mt-4 font-mono text-xs uppercase tracking-[0.2em] text-white/70">{boundApp ? `${boundApp.creditCost} credits per album request` : "Private request"}</p>
                  <p className="mt-2 text-2xl font-semibold leading-tight">{boundApp?.aiApp.name ?? "Credits held before creation"}</p>
                </div>
              </div>
              <div className="absolute bottom-5 left-5 right-5 grid gap-4 rounded-[24px] border border-white/18 bg-black/34 p-5 text-white backdrop-blur lg:grid-cols-[0.62fr_0.38fr] lg:items-end">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/56">guided workflow</p>
                  <p className="mt-2 text-xl font-semibold">Source images, album progress, and delivered galleries stay in one private customer journey.</p>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-white/74">
                    Start with source photos, follow progress, and receive the finished gallery in the same private account.
                  </p>
                </div>
                <div className="rounded-[20px] border border-white/12 bg-white/[0.08] p-4">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/46">request path</p>
                  <div className="mt-3 grid gap-2">
                    {["Private intake", "Credits held", "Album delivered"].map((item) => (
                      <div className="flex items-center justify-between gap-3 text-sm" key={item}>
                        <span className="text-white/76">{item}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-white/44" strokeWidth={1.8} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (section.type === "upload_panel" || section.type === "generation_form" || section.type === "job_progress" || section.type === "album_gallery") {
    const customer = runtime?.customer;
    const jobs = runtime?.jobs ?? [];
    const assets = runtime?.assets ?? [];
    const albums = runtime?.albums ?? [];
    const previewMode = mode === "preview" || runtime?.isPreview;
    const boundAppSlug = setting(section, "aiAppSlug", "image_generator");
    const enabledApps = siteAiApps.filter((app) => app.enabled);
    const boundApps = section.type === "generation_form"
      ? enabledApps.filter((app) => app.aiApp.slug === boundAppSlug)
      : enabledApps;
    const visibleOutputAssets = assets.filter((asset) => asset.role === "output");
    const previewCards = {
      upload_panel: assets.slice(0, 3).map((asset) => ({
        id: asset.id,
        title: asset.label,
        meta: asset.mimeType,
        detail: asset.role === "input" ? "Private source photo" : "Private album image"
      })),
      generation_form: boundApps.slice(0, 2).map((app) => ({
        id: app.id,
        title: app.aiApp.name,
        meta: `${app.creditCost} credits`,
        detail: "Ready for private album requests"
      })),
      job_progress: jobs.slice(0, 3).map((job, index) => ({
        id: job.id,
        title: customerRequestTitle(job, index),
        meta: customerStatusLabel(job.status),
        detail: `${job.creditsReserved} credits held`
      })),
      album_gallery: (albums.length ? albums : visibleOutputAssets).slice(0, 4).map((item) => ({
        id: "outputCount" in item ? item.id : item.id,
        title: "outputCount" in item ? item.title : item.label,
        meta: "outputCount" in item ? `${item.outputCount} images` : "Delivered image",
	        detail: "outputCount" in item ? customerAlbumStatusLabel(item.status) : "Private download"
      }))
    } as const;
    const featureFallback =
      section.type === "upload_panel"
        ? dreamshootToolSceneDefaults.upload
        : section.type === "generation_form"
        ? dreamshootToolSceneDefaults.form
        : section.type === "job_progress"
        ? dreamshootToolSceneDefaults.progress
        : dreamshootToolSceneDefaults.album;
    const featureImage = mediaAssetUrl(
      site,
      setting(section, "imageUrl", runtimeCollectionImage(site, section, undefined, `${site.slug}-${section.type}`) || featureFallback)
    );
    const albumSideImages = [
      "/assets/dreamshoot/generated/20260619/cyberpunk-solo-city-v1.png",
      "/assets/dreamshoot/frames/story-beauty-portrait.png"
    ];
    const sectionEyebrow = setting(section, "eyebrow", section.type.replace(/_/g, " "));
    const sectionTitle = setting(section, "title", id);
    const sectionSubtitle = setting(section, "subtitle", "");
    const sectionDisplayName = getSectionSchema(section.type).label;
    const emptyTitle = setting(section, "emptyTitle", section.type === "album_gallery" ? "No delivered images yet." : "Nothing here yet.");
    const emptyBody = setting(
      section,
      "emptyBody",
      section.type === "album_gallery"
        ? "Delivered album images will appear here automatically after final approval."
        : "Private uploads, credits, album requests, and delivered images will appear here as soon as the account has activity."
    );
    const countLabel =
      section.type === "upload_panel"
        ? `${assets.length} uploads`
        : section.type === "generation_form"
        ? `${(boundApps.length ? boundApps : enabledApps).length} album experiences`
        : section.type === "job_progress"
        ? `${jobs.length} album requests`
        : `${(albums.length ? albums : visibleOutputAssets).length} gallery items`;
    const workflowLabel =
      section.type === "upload_panel"
        ? "Step 01"
        : section.type === "generation_form"
        ? "Step 02"
        : section.type === "job_progress"
        ? "Step 03"
        : "Step 04";
    const summaryCards =
      section.type === "upload_panel"
        ? [
            { label: "Uploads", value: String(assets.length), detail: "source photos and references" },
            { label: "Profiles", value: String(runtime?.customerModels?.length ?? 0), detail: "private looks prepared" },
            { label: "Access", value: customer ? customer.status : "guest", detail: "private account" }
          ]
        : section.type === "generation_form"
        ? [
            { label: "Available", value: customer ? `${customer.balance.available}` : "0", detail: "credits ready to use" },
            { label: "Held", value: customer ? `${customer.balance.reserved}` : "0", detail: "credits in active requests" },
            { label: "Experience", value: boundApps[0]?.aiApp.name ?? enabledApps[0]?.aiApp.name ?? "Opening soon", detail: "album style enabled" }
          ]
        : section.type === "job_progress"
        ? [
            { label: "Waiting", value: String(jobs.filter((job) => job.status === "queued").length), detail: "requests in line" },
            { label: "Creating", value: String(jobs.filter((job) => job.status === "running").length), detail: "albums in progress" },
            { label: "Delivered", value: String(jobs.filter((job) => job.status === "succeeded").length), detail: "albums ready" }
          ]
        : [
            { label: "Albums", value: String(albums.length), detail: "private collections" },
            { label: "Images", value: String(visibleOutputAssets.length), detail: "delivered files" },
            { label: "Downloads", value: settingBool(section, "showDownloads", true) ? "On" : "Off", detail: "gallery actions" }
          ];
    const sectionTheme =
      section.type === "upload_panel"
        ? {
            shell: "bg-[#fbf7f0]",
            panel: "bg-[#fffaf3]",
            accent: "text-[#b57b46]",
            border: "border-[#eadfce]"
          }
        : section.type === "generation_form"
        ? {
            shell: "bg-[#141314]",
            panel: "bg-[#19181a]",
            accent: "text-[#d8ac74]",
            border: "border-white/10"
          }
        : section.type === "job_progress"
        ? {
            shell: "bg-[#f6f0e6]",
            panel: "bg-[#fffaf3]",
            accent: "text-[#b57b46]",
            border: "border-[#eadfce]"
          }
        : {
            shell: "bg-[#111114]",
            panel: "bg-[#161518]",
            accent: "text-[#d8ac74]",
            border: "border-white/10"
          };
    const darkSection = section.type === "generation_form" || section.type === "album_gallery";
    const sectionText = darkSection ? "text-white" : "text-[#14161a]";
    const sectionBody = darkSection ? "text-white/68" : "text-[#625d56]";
    const sectionShellText = darkSection ? "text-white/56" : "text-[#8a7a6d]";
    const guestSurface = sectionSurface(section, "workspace");
    const journeySurface = !customer && guestSurface === "journey";
    const journeySteps = [
      { type: "upload_panel", label: "Upload", detail: "Private intake" },
      { type: "generation_form", label: "Configure", detail: "Hold credits" },
      { type: "job_progress", label: "Track", detail: "Live requests" },
      { type: "album_gallery", label: "Deliver", detail: "Private album" }
    ] as const;
    const journeyStepIndex = journeySteps.findIndex((item) => item.type === section.type);
    const renderJourneyRail = (dark: boolean) => (
      <div className={dark ? "border-b border-white/10 bg-black/16 px-5 py-4" : "border-b border-[#eadfce] bg-white/46 px-5 py-4"}>
        <div className="flex flex-wrap items-center gap-2">
          {journeySteps.map((item, index) => {
            const active = index === journeyStepIndex;
            return (
              <div
                className={
                  dark
                    ? `rounded-full border px-3 py-2 ${active ? "border-[#d8ac74] bg-white text-[#14161a]" : "border-white/10 bg-white/[0.04] text-white/72"}`
                    : `rounded-full border px-3 py-2 ${active ? "border-[#171514] bg-[#171514] text-white" : "border-[#dfd3c5] bg-[#fbf7f0] text-[#6f655c]"}`
                }
                key={item.type}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em]">{String(index + 1).padStart(2, "0")}</span>
                  <span className="text-xs font-semibold">{item.label}</span>
                  <span className={dark ? "text-[11px] text-inherit/70" : "text-[11px] text-inherit/80"}>{item.detail}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );

    if (previewMode) {
      const cards = previewCards[section.type];
      return (
        <section className={`${sectionTheme.shell} px-5 py-8 ${sectionText}`} id={section.type === "generation_form" ? "create" : id}>
          <div className={`mx-auto overflow-hidden rounded-[32px] border ${sectionTheme.border} ${sectionTheme.panel} shadow-[0_24px_72px_-58px_rgba(20,22,26,0.24)]`}>
            <div className="grid gap-0 lg:grid-cols-[0.92fr_1.08fr]">
              <div className="border-b border-black/5 p-6 lg:border-b-0 lg:border-r lg:border-r-black/5 xl:p-8">
                <p className={`font-mono text-xs uppercase tracking-[0.22em] ${sectionTheme.accent}`}>workspace preview</p>
                <h2 className={`mt-3 text-3xl font-semibold tracking-tight [font-family:var(--site-title-font)] ${sectionText}`}>{sectionTitle}</h2>
                <p className={`mt-3 max-w-xl text-sm leading-7 ${sectionBody}`}>
                  {sectionSubtitle || "Review how this private photo workspace step will feel before it goes live."}
                </p>
                <p className={`mt-4 max-w-xl text-sm leading-6 ${sectionBody}`}>
                  Sample activity shows spacing, cards, and account flow. Live storefronts show each customer's own credits, uploads, and album requests.
                </p>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  {summaryCards.map((card) => (
                    <div className={`rounded-[18px] border ${darkSection ? "border-white/10 bg-white/[0.04]" : "border-[#e4dace] bg-white"} p-4`} key={card.label}>
                      <p className={`font-mono text-[10px] uppercase tracking-[0.16em] ${sectionShellText}`}>{card.label}</p>
                      <p className={`mt-3 text-2xl font-semibold ${sectionText}`}>{card.value}</p>
                      <p className={`mt-1 text-xs leading-5 ${sectionBody}`}>{card.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-6 xl:p-8">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div>
                    <p className={`font-mono text-xs uppercase tracking-[0.2em] ${sectionShellText}`}>{workflowLabel}</p>
                    <p className={`mt-2 text-sm ${sectionBody}`}>{countLabel}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${darkSection ? "border-white/12 bg-white/[0.05] text-white/74" : "border-[#ded5ca] bg-[#f8f4ed] text-[#706961]"}`}>
                    {sectionDisplayName}
                  </span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {cards.length ? cards.map((card) => (
                    <div className={`rounded-[20px] border ${darkSection ? "border-white/10 bg-white/[0.04]" : "border-[#e4dace] bg-[#f8f4ed]"} p-4`} key={card.id}>
                      <p className={`text-sm font-semibold ${sectionText}`}>{card.title}</p>
                      <p className={`mt-2 font-mono text-[11px] uppercase tracking-[0.14em] ${sectionShellText}`}>{card.meta}</p>
                      <p className={`mt-2 break-all text-xs leading-5 ${sectionBody}`}>{card.detail}</p>
                    </div>
                  )) : (
                    <div className={`rounded-[20px] border border-dashed ${darkSection ? "border-white/12 bg-white/[0.03]" : "border-[#cfc3b6] bg-[#f8f4ed]"} p-5 text-sm ${sectionBody} md:col-span-2`}>
                      Sample activity will appear here as soon as uploads, enabled tools, or album requests are available.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      );
    }

    if (!customer) {
      if (journeySurface && section.type === "upload_panel") {
        return (
          <section className={`${sectionTheme.shell} px-5 py-10 ${sectionText}`} id={id}>
            <div className={`mx-auto overflow-hidden rounded-[36px] border ${sectionTheme.border} ${sectionTheme.panel} shadow-[0_28px_82px_-64px_rgba(20,22,26,0.22)]`}>
              {renderJourneyRail(false)}
              <div className="grid gap-0 xl:grid-cols-[0.92fr_1.08fr]">
                <div className="border-b border-black/5 p-6 xl:border-b-0 xl:border-r xl:border-r-black/5 xl:p-8">
                  <p className={`font-mono text-xs uppercase tracking-[0.22em] ${sectionTheme.accent}`}>{sectionEyebrow}</p>
                  <h2 className={`mt-3 max-w-2xl text-3xl font-semibold leading-[1.04] tracking-tight [font-family:var(--site-title-font)] ${sectionText}`}>{sectionTitle}</h2>
                  <p className={`mt-4 max-w-xl text-sm leading-7 ${sectionBody}`}>{sectionSubtitle || "Sign in to continue this private photo workflow."}</p>
                  <p className={`mt-4 max-w-2xl text-sm leading-6 ${sectionBody}`}>
                    {setting(section, "helper", "Sign in first to upload private source photos for this customer account.")}
                  </p>
                  <div className="mt-6 grid gap-3">
                    {[
                      ["Source portraits", "Upload source portraits, style references, and inspiration images without exposing them publicly."],
                      ["Private intake", "Only the signed-in account and studio operators should see these references."],
                      ["Album-ready prep", "Clean uploads make the collection request and revision flow faster later on."]
                    ].map(([label, detail]) => (
                      <div className="rounded-[20px] border border-[#e4dace] bg-white/76 px-4 py-4 shadow-[0_18px_46px_-40px_rgba(20,22,26,0.10)]" key={label}>
                        <p className="text-sm font-semibold text-[#171514]">{label}</p>
                        <p className="mt-2 text-xs leading-5 text-[#706961]">{detail}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link className="inline-flex items-center gap-2 rounded-[16px] bg-[#14161a] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 active:scale-[0.98]" href={hrefFor(site, "/login")}>
                      Sign in
                      <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                    </Link>
                    <Link className="inline-flex items-center gap-2 rounded-[16px] border border-[#ded5ca] bg-white/58 px-5 py-3 text-sm font-semibold text-[#14161a]" href={hrefFor(site, "/pricing")}>
                      View pricing
                    </Link>
                  </div>
                </div>
                <div className="p-6 xl:p-8">
                  <div className="relative overflow-hidden rounded-[30px] border border-[#e4dace] bg-[#efe6d9] shadow-[0_24px_68px_-52px_rgba(20,22,26,0.16)]">
                    <img className="aspect-[16/11] w-full object-cover" src={featureImage} alt={sectionTitle} />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,22,26,0.08)_0%,rgba(20,22,26,0.18)_42%,rgba(20,22,26,0.76)_100%)]" />
                    <div className="absolute left-5 top-5 rounded-full border border-white/52 bg-white/18 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white backdrop-blur">
                      Step 01 · intake
                    </div>
                    <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                      <p className="text-[1.9rem] font-semibold leading-[1.04] tracking-tight text-balance [font-family:var(--site-title-font)]">
                        Collect source photos and style references before the request starts.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {[
                      ["Source", "portrait set"],
                      ["Venue", "reference mood"],
                      ["Wardrobe", "style details"]
                    ].map(([label, detail]) => (
                      <div className="rounded-[18px] border border-[#e4dace] bg-white px-4 py-4" key={label}>
                        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#8a7a6d]">{detail}</p>
                        <p className="mt-2 text-sm font-semibold text-[#171514]">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        );
      }

      if (section.type === "upload_panel") {
        return (
          <section className={`${sectionTheme.shell} px-5 py-8 ${sectionText}`} id={id}>
            <div className={`mx-auto overflow-hidden rounded-[32px] border ${sectionTheme.border} ${sectionTheme.panel} shadow-[0_24px_72px_-58px_rgba(20,22,26,0.24)]`}>
              <div className="grid gap-0 xl:grid-cols-[0.9fr_1.1fr]">
                <div className="border-b border-black/5 p-6 xl:border-b-0 xl:border-r xl:border-r-black/5 xl:p-8">
                  <p className={`font-mono text-xs uppercase tracking-[0.22em] ${sectionTheme.accent}`}>private account</p>
                  <h2 className={`mt-3 text-3xl font-semibold tracking-tight [font-family:var(--site-title-font)] ${sectionText}`}>{sectionTitle}</h2>
                  <p className={`mt-3 max-w-xl text-sm leading-7 ${sectionBody}`}>{sectionSubtitle || "Sign in to continue this private photo workflow."}</p>
                  <p className={`mt-4 max-w-2xl text-sm leading-6 ${sectionBody}`}>
                    {setting(section, "helper", "Sign in first to upload private source photos for this customer account.")}
                  </p>
                  <div className="mt-6 grid gap-3">
                    {[
                      ["Source portraits", "Upload source portraits, style references, and inspiration images without exposing them publicly."],
                      ["Private intake", "Only the signed-in account and studio operators should see these references."],
                      ["Album-ready prep", "Clean uploads make the collection request and revision flow faster later on."]
                    ].map(([label, detail]) => (
                      <div className="rounded-[18px] border border-[#e4dace] bg-white/72 px-4 py-3" key={label}>
                        <p className="text-sm font-semibold text-[#171514]">{label}</p>
                        <p className="mt-1 text-xs leading-5 text-[#706961]">{detail}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link className="inline-flex items-center gap-2 rounded-[16px] bg-[#14161a] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 active:scale-[0.98]" href={hrefFor(site, "/login")}>
                      Sign in
                      <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                    </Link>
                    <Link className="inline-flex items-center gap-2 rounded-[16px] border border-[#ded5ca] bg-white/58 px-5 py-3 text-sm font-semibold text-[#14161a]" href={hrefFor(site, "/pricing")}>
                      View pricing
                    </Link>
                  </div>
                </div>
                <div className="p-6 xl:p-8">
                  <div className="relative overflow-hidden rounded-[28px] border border-[#e4dace] bg-[#efe6d9] shadow-[0_20px_56px_-44px_rgba(20,22,26,0.16)]">
                    <img className="aspect-[16/11] w-full object-cover" src={featureImage} alt={sectionTitle} />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,22,26,0.12)_0%,rgba(20,22,26,0.18)_36%,rgba(20,22,26,0.72)_100%)]" />
                    <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/60">{workflowLabel}</p>
                      <p className="mt-2 text-2xl font-semibold leading-tight">Collect source photos and style references before the request starts.</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {[
                      ["Source", "portrait set"],
                      ["Venue", "reference mood"],
                      ["Wardrobe", "style details"]
                    ].map(([label, detail]) => (
                      <div className="rounded-[18px] border border-[#e4dace] bg-white px-4 py-4" key={label}>
                        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#8a7a6d]">{detail}</p>
                        <p className="mt-2 text-sm font-semibold text-[#171514]">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        );
      }

      if (journeySurface && section.type === "generation_form") {
        return (
          <section className={`${sectionTheme.shell} px-5 py-10 ${sectionText}`} id="create">
            <div className={`mx-auto overflow-hidden rounded-[36px] border ${sectionTheme.border} ${sectionTheme.panel} shadow-[0_28px_82px_-64px_rgba(20,22,26,0.34)]`}>
              {renderJourneyRail(true)}
              <div className="grid gap-0 xl:grid-cols-[0.84fr_1.16fr]">
                <div className="border-b border-white/8 p-6 xl:border-b-0 xl:border-r xl:border-r-white/8 xl:p-8">
                  <p className={`font-mono text-xs uppercase tracking-[0.22em] ${sectionTheme.accent}`}>{sectionEyebrow}</p>
                  <h2 className={`mt-3 max-w-2xl text-3xl font-semibold leading-[1.04] tracking-tight [font-family:var(--site-title-font)] ${sectionText}`}>{sectionTitle}</h2>
                  <p className={`mt-4 max-w-xl text-sm leading-7 ${sectionBody}`}>{sectionSubtitle || "Sign in to continue this private photo workflow."}</p>
                  <p className={`mt-4 max-w-2xl text-sm leading-6 ${sectionBody}`}>
                    {setting(section, "helper", "Sign in first to hold credits and start a private album request.")}
                  </p>
                  <div className="mt-6 grid gap-3">
                    {[
                      ["Choose style", "Destination and visual direction stay clear before creation."],
                      ["Hold credits", "Credits reserve before the request begins, not after."],
                      ["Deliver privately", "Finished images return to the same signed-in account."]
                    ].map(([label, detail]) => (
                      <div className="rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-4" key={label}>
                        <p className="text-sm font-semibold text-white">{label}</p>
                        <p className="mt-2 text-xs leading-5 text-white/62">{detail}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link className="inline-flex items-center gap-2 rounded-[16px] bg-white px-5 py-3 text-sm font-semibold text-[#14161a] transition hover:-translate-y-0.5 active:scale-[0.98]" href={hrefFor(site, "/login")}>
                      Sign in
                      <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                    </Link>
                    <Link className="inline-flex items-center gap-2 rounded-[16px] border border-white/12 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white" href={hrefFor(site, "/pricing")}>
                      View pricing
                    </Link>
                  </div>
                </div>
                <div className="p-6 xl:p-8">
                  <div className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
                    <div className="relative overflow-hidden rounded-[26px] border border-white/10 bg-black/20">
                      <img className="aspect-[4/5] w-full object-cover opacity-74" src={featureImage} alt={sectionTitle} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/76 via-black/16 to-transparent" />
                      <div className="absolute left-5 top-5 rounded-full border border-white/20 bg-white/[0.08] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/82 backdrop-blur">
                        Step 02 · configure
                      </div>
                      <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                        <p className="text-[1.8rem] font-semibold leading-[1.04] tracking-tight text-balance [font-family:var(--site-title-font)]">
                          Configure the collection, then hold credits before creation.
                        </p>
                      </div>
                    </div>
                    <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_22px_60px_-54px_rgba(0,0,0,0.46)]">
                      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/56">album request form</p>
                      <div className="mt-4 grid gap-3">
                        {[
                          ["Album style", "Image Studio - 108 credits"],
                          ["Style", "editorial"],
                          ["Output count", "4"]
                        ].map(([label, value]) => (
                          <div className="rounded-[16px] border border-white/10 bg-black/18 px-4 py-3" key={label}>
                            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/50">{label}</p>
                            <p className="mt-2 text-sm font-semibold text-white">{value}</p>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 rounded-[18px] border border-white/10 bg-black/18 px-4 py-4">
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div>
                            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/50">Credits</p>
                            <p className="mt-2 text-sm font-semibold text-white">108</p>
                          </div>
                          <div>
                            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/50">Delivery</p>
                            <p className="mt-2 text-sm font-semibold text-white">Private gallery</p>
                          </div>
                          <div>
                            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/50">Balance</p>
                            <p className="mt-2 text-sm font-semibold text-white">Sign in to view</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        );
      }

      if (section.type === "generation_form") {
        return (
          <section className={`${sectionTheme.shell} px-5 py-8 ${sectionText}`} id="create">
            <div className={`mx-auto overflow-hidden rounded-[32px] border ${sectionTheme.border} ${sectionTheme.panel} shadow-[0_24px_72px_-58px_rgba(20,22,26,0.24)]`}>
              <div className="grid gap-0 xl:grid-cols-[0.82fr_1.18fr]">
                <div className="border-b border-white/8 p-6 xl:border-b-0 xl:border-r xl:border-r-white/8 xl:p-8">
                  <p className={`font-mono text-xs uppercase tracking-[0.22em] ${sectionTheme.accent}`}>private account</p>
                  <h2 className={`mt-3 text-3xl font-semibold tracking-tight [font-family:var(--site-title-font)] ${sectionText}`}>{sectionTitle}</h2>
                  <p className={`mt-3 max-w-xl text-sm leading-7 ${sectionBody}`}>{sectionSubtitle || "Sign in to continue this private photo workflow."}</p>
                  <p className={`mt-4 max-w-2xl text-sm leading-6 ${sectionBody}`}>
                    {setting(section, "helper", "Sign in first to hold credits and start a private album request.")}
                  </p>
                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    {[
                      ["Choose style", "Destination and visual direction stay clear before creation."],
                      ["Hold credits", "Credits reserve before the request begins, not after."],
                      ["Deliver privately", "Finished images return to the same signed-in account."]
                    ].map(([label, detail]) => (
                      <div className="rounded-[18px] border border-white/10 bg-white/[0.04] p-4" key={label}>
                        <p className="text-sm font-semibold text-white">{label}</p>
                        <p className="mt-2 text-xs leading-5 text-white/62">{detail}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link className="inline-flex items-center gap-2 rounded-[16px] bg-white px-5 py-3 text-sm font-semibold text-[#14161a] transition hover:-translate-y-0.5 active:scale-[0.98]" href={hrefFor(site, "/login")}>
                      Sign in
                      <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                    </Link>
                    <Link className="inline-flex items-center gap-2 rounded-[16px] border border-white/12 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white" href={hrefFor(site, "/pricing")}>
                      View pricing
                    </Link>
                  </div>
                </div>
                <div className="p-6 xl:p-8">
                  <div className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
                    <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-black/20">
                      <img className="aspect-[4/5] w-full object-cover opacity-72" src={featureImage} alt={sectionTitle} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/72 via-black/18 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/58">{workflowLabel}</p>
                        <p className="mt-2 text-lg font-semibold">Configure the collection, then hold credits before creation.</p>
                      </div>
                    </div>
                    <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
                      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/56">album request form</p>
                      <div className="mt-4 grid gap-3">
                        {[
                          ["Album style", "Image Studio - 108 credits"],
                          ["Style", "editorial"],
                          ["Output count", "4"]
                        ].map(([label, value]) => (
                          <div className="rounded-[16px] border border-white/10 bg-black/18 px-4 py-3" key={label}>
                            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/50">{label}</p>
                            <p className="mt-2 text-sm font-semibold text-white">{value}</p>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 rounded-[18px] border border-white/10 bg-black/18 px-4 py-4">
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div>
                            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/50">Credits</p>
                            <p className="mt-2 text-sm font-semibold text-white">108</p>
                          </div>
                          <div>
                            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/50">Delivery</p>
                            <p className="mt-2 text-sm font-semibold text-white">Private gallery</p>
                          </div>
                          <div>
                            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/50">Balance</p>
                            <p className="mt-2 text-sm font-semibold text-white">Sign in to view</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        );
      }

      if (journeySurface && section.type === "job_progress") {
        return (
          <section className={`${sectionTheme.shell} px-5 py-10 ${sectionText}`} id={id}>
            <div className={`mx-auto overflow-hidden rounded-[36px] border ${sectionTheme.border} ${sectionTheme.panel} shadow-[0_28px_82px_-64px_rgba(20,22,26,0.22)]`}>
              {renderJourneyRail(false)}
              <div className="grid gap-0 xl:grid-cols-[0.84fr_1.16fr]">
                <div className="border-b border-black/5 p-6 xl:border-b-0 xl:border-r xl:border-r-black/5 xl:p-8">
                  <p className={`font-mono text-xs uppercase tracking-[0.22em] ${sectionTheme.accent}`}>{sectionEyebrow}</p>
                  <h2 className={`mt-3 max-w-2xl text-3xl font-semibold leading-[1.04] tracking-tight [font-family:var(--site-title-font)] ${sectionText}`}>{sectionTitle}</h2>
                  <p className={`mt-4 max-w-xl text-sm leading-7 ${sectionBody}`}>{sectionSubtitle || "Sign in to continue this private photo workflow."}</p>
                  <p className={`mt-4 max-w-2xl text-sm leading-6 ${sectionBody}`}>
                    Sign in to view waiting, creating, delivered, and review-needed album requests for this account only.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link className="inline-flex items-center gap-2 rounded-[16px] bg-[#14161a] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 active:scale-[0.98]" href={hrefFor(site, "/login")}>
                      Sign in
                      <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                    </Link>
                    <Link className="inline-flex items-center gap-2 rounded-[16px] border border-[#ded5ca] bg-white/58 px-5 py-3 text-sm font-semibold text-[#14161a]" href={hrefFor(site, "/pricing")}>
                      View pricing
                    </Link>
                  </div>
                </div>
                <div className="p-6 xl:p-8">
                  <div className="rounded-[28px] border border-[#e4dace] bg-white/80 p-5 shadow-[0_22px_60px_-54px_rgba(20,22,26,0.14)]">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#8a7a6d]">sample request timeline</p>
                      <span className="rounded-full border border-[#e1d5c8] bg-[#fbf7f0] px-3 py-1 text-[11px] font-semibold text-[#7d7064]">Step 03 · track</span>
                    </div>
                    <div className="mt-4 grid gap-3">
                      {[
                        ["01", "Queued", "The request is in line and waiting for generation to start."],
                        ["02", "Creating", "Credits remain held while the scene pack is actively rendering."],
                        ["03", "Delivered", "Finished images return to the private gallery once approved."]
                      ].map(([step, label, detail]) => (
                        <div className="grid gap-4 rounded-[18px] border border-[#e4dace] bg-[#fffaf3] px-4 py-4 md:grid-cols-[auto_1fr] md:items-start" key={step}>
                          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f3e7d9] text-xs font-semibold text-[#9b7a57]">{step}</span>
                          <div>
                            <p className="text-sm font-semibold text-[#171514]">{label}</p>
                            <p className="mt-1 text-xs leading-5 text-[#706961]">{detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 relative overflow-hidden rounded-[24px] border border-[#e4dace] bg-[#efe6d9]">
                      <img className="aspect-[16/9] w-full object-cover" src={featureImage} alt={sectionTitle} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/56 via-black/10 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                        <p className="text-[1.45rem] font-semibold leading-tight text-balance [font-family:var(--site-title-font)]">
                          Show each customer exactly where every package request stands.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        );
      }

      if (section.type === "job_progress") {
        return (
          <section className={`${sectionTheme.shell} px-5 py-8 ${sectionText}`} id={id}>
            <div className={`mx-auto overflow-hidden rounded-[32px] border ${sectionTheme.border} ${sectionTheme.panel} shadow-[0_24px_72px_-58px_rgba(20,22,26,0.24)]`}>
              <div className="grid gap-0 xl:grid-cols-[0.84fr_1.16fr]">
                <div className="border-b border-black/5 p-6 xl:border-b-0 xl:border-r xl:border-r-black/5 xl:p-8">
                  <p className={`font-mono text-xs uppercase tracking-[0.22em] ${sectionTheme.accent}`}>private account</p>
                  <h2 className={`mt-3 text-3xl font-semibold tracking-tight [font-family:var(--site-title-font)] ${sectionText}`}>{sectionTitle}</h2>
                  <p className={`mt-3 max-w-xl text-sm leading-7 ${sectionBody}`}>{sectionSubtitle || "Sign in to continue this private photo workflow."}</p>
                  <p className={`mt-4 max-w-2xl text-sm leading-6 ${sectionBody}`}>
                    Sign in to view waiting, creating, delivered, and review-needed album requests for this account only.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link className="inline-flex items-center gap-2 rounded-[16px] bg-[#14161a] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 active:scale-[0.98]" href={hrefFor(site, "/login")}>
                      Sign in
                      <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                    </Link>
                    <Link className="inline-flex items-center gap-2 rounded-[16px] border border-[#ded5ca] bg-white/58 px-5 py-3 text-sm font-semibold text-[#14161a]" href={hrefFor(site, "/pricing")}>
                      View pricing
                    </Link>
                  </div>
                </div>
                <div className="p-6 xl:p-8">
                  <div className="rounded-[24px] border border-[#e4dace] bg-white/76 p-5 shadow-[0_18px_48px_-44px_rgba(20,22,26,0.12)]">
                    <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#8a7a6d]">sample request timeline</p>
                    <div className="mt-4 grid gap-3">
                      {[
                        ["01", "Queued", "The request is in line and waiting for generation to start."],
                        ["02", "Creating", "Credits remain held while the scene pack is actively rendering."],
                        ["03", "Delivered", "Finished images return to the private gallery once approved."]
                      ].map(([step, label, detail]) => (
                        <div className="grid gap-4 rounded-[18px] border border-[#e4dace] bg-[#fffaf3] px-4 py-4 md:grid-cols-[auto_1fr] md:items-start" key={step}>
                          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f3e7d9] text-xs font-semibold text-[#9b7a57]">{step}</span>
                          <div>
                            <p className="text-sm font-semibold text-[#171514]">{label}</p>
                            <p className="mt-1 text-xs leading-5 text-[#706961]">{detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 relative overflow-hidden rounded-[22px] border border-[#e4dace] bg-[#efe6d9]">
                      <img className="aspect-[16/9] w-full object-cover" src={featureImage} alt={sectionTitle} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/56 via-black/10 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/60">{workflowLabel}</p>
                        <p className="mt-2 text-lg font-semibold">Show each customer exactly where every package request stands.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        );
      }

      if (journeySurface && section.type === "album_gallery") {
        return (
          <section className={`${sectionTheme.shell} px-5 py-10 ${sectionText}`} id={id}>
            <div className={`mx-auto overflow-hidden rounded-[36px] border ${sectionTheme.border} ${sectionTheme.panel} shadow-[0_28px_82px_-64px_rgba(20,22,26,0.34)]`}>
              {renderJourneyRail(true)}
              <div className="grid gap-0 xl:grid-cols-[0.8fr_1.2fr]">
                <div className="border-b border-white/8 p-6 xl:border-b-0 xl:border-r xl:border-r-white/8 xl:p-8">
                  <p className={`font-mono text-xs uppercase tracking-[0.22em] ${sectionTheme.accent}`}>{sectionEyebrow}</p>
                  <h2 className={`mt-3 max-w-2xl text-3xl font-semibold leading-[1.04] tracking-tight [font-family:var(--site-title-font)] ${sectionText}`}>{sectionTitle}</h2>
                  <p className={`mt-4 max-w-xl text-sm leading-7 ${sectionBody}`}>{sectionSubtitle || "Sign in to continue this private photo workflow."}</p>
                  <p className={`mt-4 max-w-2xl text-sm leading-6 ${sectionBody}`}>
                    Sign in to view private gallery images and delivered albums for this account only.
                  </p>
                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    {[
                      ["Private", "customer-only review"],
                      ["Download", "ready when delivered"],
                      ["Secure", "brand-safe gallery"]
                    ].map(([label, detail]) => (
                      <div className="rounded-[18px] border border-white/10 bg-white/[0.04] p-4" key={label}>
                        <p className="text-sm font-semibold text-white">{label}</p>
                        <p className="mt-2 text-xs leading-5 text-white/60">{detail}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link className="inline-flex items-center gap-2 rounded-[16px] bg-white px-5 py-3 text-sm font-semibold text-[#14161a] transition hover:-translate-y-0.5 active:scale-[0.98]" href={hrefFor(site, "/login")}>
                      Sign in
                      <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                    </Link>
                    <Link className="inline-flex items-center gap-2 rounded-[16px] border border-white/12 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white" href={hrefFor(site, "/pricing")}>
                      View pricing
                    </Link>
                  </div>
                </div>
                <div className="p-6 xl:p-8">
                  <div className="grid gap-4 lg:grid-cols-[1.02fr_0.98fr]">
                    <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-black/20">
                      <img className="aspect-[4/5] w-full object-cover opacity-78" src={featureImage} alt={sectionTitle} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                      <div className="absolute left-5 top-5 rounded-full border border-white/20 bg-white/[0.08] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/82 backdrop-blur">
                        Step 04 · deliver
                      </div>
                      <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                        <p className="text-[1.8rem] font-semibold leading-[1.04] tracking-tight text-balance [font-family:var(--site-title-font)]">
                          Finished lifestyle, destination, and editorial images stay inside one premium gallery.
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-3">
                      {[
                        ["City creator story", "18 images", "Ready"],
                        ["Editorial travel draft", "0 images", "Preparing"]
                      ].map(([label, detail, status], index) => (
                        <div className="overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.04]" key={label}>
                          <div className="aspect-[16/10] overflow-hidden bg-white/6">
                            <img className="h-full w-full object-cover" src={albumSideImages[index] ?? featureImage} alt={label} />
                          </div>
                          <div className="p-4">
                            <p className="font-semibold text-white">{label}</p>
                            <p className="mt-2 text-sm text-white/68">{detail}</p>
                            <div className="mt-4 flex items-center justify-between gap-3">
                              <span className="rounded-full border border-white/12 bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold text-white/72">{status}</span>
                              <span className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                                {setting(section, "showDownloads", "true") === "true" ? "Open downloads" : "Open album"}
                                <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        );
      }

      if (section.type === "album_gallery") {
        return (
          <section className={`${sectionTheme.shell} px-5 py-8 ${sectionText}`} id={id}>
            <div className={`mx-auto overflow-hidden rounded-[32px] border ${sectionTheme.border} ${sectionTheme.panel} shadow-[0_24px_72px_-58px_rgba(20,22,26,0.24)]`}>
              <div className="grid gap-0 xl:grid-cols-[0.8fr_1.2fr]">
                <div className="border-b border-white/8 p-6 xl:border-b-0 xl:border-r xl:border-r-white/8 xl:p-8">
                  <p className={`font-mono text-xs uppercase tracking-[0.22em] ${sectionTheme.accent}`}>private account</p>
                  <h2 className={`mt-3 text-3xl font-semibold tracking-tight [font-family:var(--site-title-font)] ${sectionText}`}>{sectionTitle}</h2>
                  <p className={`mt-3 max-w-xl text-sm leading-7 ${sectionBody}`}>{sectionSubtitle || "Sign in to continue this private photo workflow."}</p>
                  <p className={`mt-4 max-w-2xl text-sm leading-6 ${sectionBody}`}>
                    Sign in to view private gallery images and delivered albums for this account only.
                  </p>
                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    {[
                      ["Private", "customer-only review"],
                      ["Download", "ready when delivered"],
                      ["Secure", "brand-safe gallery"]
                    ].map(([label, detail]) => (
                      <div className="rounded-[18px] border border-white/10 bg-white/[0.04] p-4" key={label}>
                        <p className="text-sm font-semibold text-white">{label}</p>
                        <p className="mt-2 text-xs leading-5 text-white/60">{detail}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link className="inline-flex items-center gap-2 rounded-[16px] bg-white px-5 py-3 text-sm font-semibold text-[#14161a] transition hover:-translate-y-0.5 active:scale-[0.98]" href={hrefFor(site, "/login")}>
                      Sign in
                      <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                    </Link>
                    <Link className="inline-flex items-center gap-2 rounded-[16px] border border-white/12 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white" href={hrefFor(site, "/pricing")}>
                      View pricing
                    </Link>
                  </div>
                </div>
                <div className="p-6 xl:p-8">
                  <div className="grid gap-4 lg:grid-cols-[1.06fr_0.94fr]">
                    <div className="relative overflow-hidden rounded-[26px] border border-white/10 bg-black/20">
                      <img className="aspect-[4/5] w-full object-cover opacity-76" src={featureImage} alt={sectionTitle} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/12 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/58">{workflowLabel}</p>
                        <p className="mt-2 text-2xl font-semibold leading-tight">Finished lifestyle, destination, and editorial images stay inside one premium gallery.</p>
                      </div>
                    </div>
                    <div className="grid gap-3">
                      {[
                        ["City creator story", "18 images", "Ready"],
                        ["Editorial travel draft", "0 images", "Preparing"]
                      ].map(([label, detail, status], index) => (
                        <div className="overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.04]" key={label}>
                          <div className="aspect-[16/10] overflow-hidden bg-white/6">
                            <img className="h-full w-full object-cover" src={albumSideImages[index] ?? featureImage} alt={label} />
                          </div>
                          <div className="p-4">
                            <p className="font-semibold text-white">{label}</p>
                            <p className="mt-2 text-sm text-white/68">{detail}</p>
                            <div className="mt-4 flex items-center justify-between gap-3">
                              <span className="rounded-full border border-white/12 bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold text-white/72">{status}</span>
                              <span className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                                {setting(section, "showDownloads", "true") === "true" ? "Open downloads" : "Open album"}
                                <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        );
      }

      return (
        <section className={`${sectionTheme.shell} px-5 py-8 ${sectionText}`} id={section.type === "generation_form" ? "create" : id}>
          <div className={`mx-auto overflow-hidden rounded-[32px] border ${sectionTheme.border} ${sectionTheme.panel} shadow-[0_24px_72px_-58px_rgba(20,22,26,0.24)]`}>
            <div className="grid gap-0 lg:grid-cols-[0.92fr_1.08fr]">
              <div className="border-b border-black/5 p-6 lg:border-b-0 lg:border-r lg:border-r-black/5 xl:p-8">
                <p className={`font-mono text-xs uppercase tracking-[0.22em] ${sectionTheme.accent}`}>private account</p>
                <h2 className={`mt-3 text-3xl font-semibold tracking-tight [font-family:var(--site-title-font)] ${sectionText}`}>{sectionTitle}</h2>
                <p className={`mt-3 max-w-xl text-sm leading-7 ${sectionBody}`}>
                  {sectionSubtitle || "Sign in to continue this private photo workflow."}
                </p>
                <p className={`mt-4 max-w-2xl text-sm leading-6 ${sectionBody}`}>
                  {section.type === "upload_panel"
                    ? setting(section, "helper", "Sign in first to upload private source photos for this customer account.")
                    : section.type === "generation_form"
                    ? setting(section, "helper", "Sign in first to hold credits and start a private album request.")
                    : section.type === "job_progress"
                    ? "Sign in to view waiting, creating, delivered, and review-needed album requests for this account only."
                    : "Sign in to view private gallery images and delivered albums for this account only."}
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link className="inline-flex items-center gap-2 rounded-[16px] bg-[#14161a] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 active:scale-[0.98]" href={hrefFor(site, "/login")}>
                    Sign in
                    <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                  </Link>
                  <Link className={`inline-flex items-center gap-2 rounded-[16px] border px-5 py-3 text-sm font-semibold ${darkSection ? "border-white/12 bg-white/[0.05] text-white" : "border-[#ded5ca] bg-white/58 text-[#14161a]"}`} href={hrefFor(site, "/pricing")}>
                    View pricing
                  </Link>
                </div>
              </div>
              <div className="p-6 xl:p-8">
                <div className="relative min-h-[300px] overflow-hidden rounded-[28px]">
                  <img className="absolute inset-0 h-full w-full object-cover" src={featureImage} alt={sectionTitle} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/72 via-black/24 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/58">{workflowLabel}</p>
                    <p className="mt-2 text-2xl font-semibold leading-tight">{sectionTitle}</p>
                    <p className="mt-3 max-w-lg text-sm leading-6 text-white/72">
                      Sign in to keep uploads, credits, requests, and delivered albums private to your account.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      );
    }

    if (section.type === "upload_panel") {
      return (
        <section className={`${sectionTheme.shell} px-5 py-8 ${sectionText}`} id={id}>
          <div className={`mx-auto overflow-hidden rounded-[32px] border ${sectionTheme.border} ${sectionTheme.panel} shadow-[0_24px_72px_-58px_rgba(20,22,26,0.24)]`}>
            <div className="grid gap-0 lg:grid-cols-[0.84fr_1.16fr]">
              <div className="border-b border-black/5 p-6 lg:border-b-0 lg:border-r lg:border-r-black/5 xl:p-8">
                <p className={`font-mono text-xs uppercase tracking-[0.22em] ${sectionTheme.accent}`}>{sectionEyebrow}</p>
                <h2 className={`mt-3 text-3xl font-semibold tracking-tight [font-family:var(--site-title-font)] ${sectionText}`}>{sectionTitle}</h2>
                <p className={`mt-3 max-w-xl text-sm leading-7 ${sectionBody}`}>{sectionSubtitle || setting(section, "helper", "Upload source photos into the current customer's private site library.")}</p>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  {summaryCards.map((card) => (
                    <div className="rounded-[18px] border border-[#e4dace] bg-white p-4" key={card.label}>
                      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#8a7a6d]">{card.label}</p>
                      <p className="mt-3 text-2xl font-semibold text-[#14161a]">{card.value}</p>
                      <p className="mt-1 text-xs leading-5 text-[#625d56]">{card.detail}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-6 relative overflow-hidden rounded-[24px] border border-[#e4dace] bg-[#efe6d9]">
                  <img className="aspect-[4/3] w-full object-cover" src={featureImage} alt={sectionTitle} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/52 via-black/10 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/60">{workflowLabel}</p>
                    <p className="mt-2 text-lg font-semibold">Keep the customer upload intake elegant and private.</p>
                  </div>
                </div>
              </div>
              <div className="p-6 xl:p-8">
                <div className="mb-5">
                  <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#8a7a6d]">private upload intake</p>
                  <p className="mt-2 text-sm leading-6 text-[#625d56]">{setting(section, "helper", "Upload source photos into the current customer's private site library.")}</p>
                </div>
                <AssetsPanel assets={assets} customer={customer} emptyBody={emptyBody} emptyTitle={emptyTitle} siteId={site.id} />
              </div>
            </div>
          </div>
        </section>
      );
    }

    if (section.type === "generation_form") {
      return (
        <section className={`${sectionTheme.shell} px-5 py-8 ${sectionText}`} id="create">
          <div className={`mx-auto overflow-hidden rounded-[32px] border ${sectionTheme.border} ${sectionTheme.panel} shadow-[0_24px_72px_-58px_rgba(20,22,26,0.3)]`}>
            <div className="grid gap-0 lg:grid-cols-[0.84fr_1.16fr]">
              <div className="border-b border-white/8 p-6 lg:border-b-0 lg:border-r lg:border-r-white/8 xl:p-8">
                <p className={`font-mono text-xs uppercase tracking-[0.22em] ${sectionTheme.accent}`}>{sectionEyebrow}</p>
                <h2 className={`mt-3 text-3xl font-semibold tracking-tight [font-family:var(--site-title-font)] ${sectionText}`}>{sectionTitle}</h2>
                <p className={`mt-3 max-w-xl text-sm leading-7 ${sectionBody}`}>{sectionSubtitle || setting(section, "helper", "Hold credits and begin the current customer's private album request.")}</p>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  {summaryCards.map((card) => (
                    <div className="rounded-[18px] border border-white/10 bg-white/[0.04] p-4" key={card.label}>
                      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/56">{card.label}</p>
                      <p className="mt-3 text-2xl font-semibold text-white">{card.value}</p>
                      <p className="mt-1 text-xs leading-5 text-white/68">{card.detail}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-6 relative overflow-hidden rounded-[24px] border border-white/10 bg-black/20">
                  <img className="aspect-[4/3] w-full object-cover opacity-70" src={featureImage} alt={sectionTitle} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/58">{workflowLabel}</p>
                    <p className="mt-2 text-lg font-semibold">Configure the collection, then hold credits before creation.</p>
                  </div>
                </div>
              </div>
              <div className="p-6 xl:p-8">
                <div className="mb-5">
                  <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/56">album request form</p>
                  <p className="mt-2 text-sm leading-6 text-white/68">{setting(section, "helper", "Hold credits and begin the current customer's private album request.")}</p>
                </div>
                <JobCreateForm
                  customer={customer}
                  emptyBody={emptyBody}
                  emptyTitle={emptyTitle}
                  siteId={site.id}
                  siteSlug={site.slug}
                  siteAiApps={boundApps.length ? boundApps : enabledApps}
                />
              </div>
            </div>
          </div>
        </section>
      );
    }

    if (section.type === "job_progress") {
      const latestJob = jobs[0];
      const progressSurface = sectionSurface(
        section,
        renderContext.pagePath === "/app/jobs/progress" ? "timeline" : "workspace"
      );

      if (progressSurface === "workspace") {
        return (
          <section className={`${sectionTheme.shell} px-5 py-8 ${sectionText}`} id={id}>
            <div className={`mx-auto overflow-hidden rounded-[32px] border ${sectionTheme.border} ${sectionTheme.panel} shadow-[0_24px_72px_-58px_rgba(20,22,26,0.24)]`}>
              <div className="grid gap-0 xl:grid-cols-[0.78fr_1.22fr]">
                <div className="border-b border-black/5 p-6 xl:border-b-0 xl:border-r xl:border-r-black/5 xl:p-8">
                  <p className={`font-mono text-xs uppercase tracking-[0.22em] ${sectionTheme.accent}`}>{sectionEyebrow}</p>
                  <h2 className={`mt-3 text-3xl font-semibold tracking-tight [font-family:var(--site-title-font)] ${sectionText}`}>{sectionTitle}</h2>
                  <p className={`mt-3 max-w-xl text-sm leading-7 ${sectionBody}`}>{sectionSubtitle || "Only album requests for the current signed-in customer are visible here."}</p>
                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    {summaryCards.map((card) => (
                      <div className="rounded-[18px] border border-[#e4dace] bg-white p-4" key={card.label}>
                        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#8a7a6d]">{card.label}</p>
                        <p className="mt-3 text-2xl font-semibold text-[#14161a]">{card.value}</p>
                        <p className="mt-1 text-xs leading-5 text-[#625d56]">{card.detail}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 relative overflow-hidden rounded-[24px] border border-[#e4dace] bg-[#efe6d9]">
                    <img className="aspect-[16/10] w-full object-cover" src={featureImage} alt={sectionTitle} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/56 via-black/12 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/60">{workflowLabel}</p>
                      <p className="mt-2 text-lg font-semibold">Live request status stays next to uploads, credits, and delivered albums.</p>
                    </div>
                  </div>
                </div>
                <div className="p-6 xl:p-8">
                  <div className="mb-5 flex items-end justify-between gap-4">
                    <div>
                      <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#8a7a6d]">recent requests</p>
                      <p className="mt-2 text-sm leading-6 text-[#625d56]">The workspace keeps the latest private requests close to the next action.</p>
                    </div>
                    <Link className="inline-flex items-center gap-2 rounded-full border border-[#ded5ca] bg-[#f8f4ed] px-3 py-2 text-xs font-semibold text-[#706961]" href={hrefFor(site, "/app/jobs/progress")}>
                      Open timeline
                      <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
                    </Link>
                  </div>
                  <div className="grid gap-3">
                    {jobs.length ? jobs.slice(0, 3).map((job, index) => (
                      <Link className="grid gap-4 rounded-[20px] border border-[#e4dace] bg-white p-4 transition hover:-translate-y-0.5 hover:bg-[#fffaf3] md:grid-cols-[auto_1fr_auto]" href={hrefFor(site, `/app/jobs/${job.id}`)} key={job.id}>
                        <div className="flex items-start justify-center pt-1">
                          <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold ${
                            job.status === "succeeded"
                              ? "bg-emerald-50 text-emerald-700"
                              : job.status === "failed" || job.status === "refunded"
                              ? "bg-rose-50 text-rose-700"
                              : job.status === "running"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-zinc-100 text-zinc-700"
                          }`}>
                            {String(index + 1).padStart(2, "0")}
                          </span>
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                            <p className="font-semibold text-[#14161a]">{customerRequestTitle(job, index)}</p>
                            <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                              job.status === "succeeded"
                                ? "bg-emerald-50 text-emerald-700"
                                : job.status === "failed" || job.status === "refunded"
                                ? "bg-rose-50 text-rose-700"
                                : job.status === "running"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-zinc-100 text-zinc-700"
                            }`}>
                              {customerStatusLabel(job.status)}
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-[#625d56]">{customerStatusNarrative(job.status)}</p>
                          <p className="mt-2 text-xs text-[#706961]">{new Date(job.updatedAt).toLocaleString("zh-CN", { hour12: false })}</p>
                        </div>
                        <div className="flex flex-col items-start gap-2 text-sm text-[#625d56] md:items-end">
                          <span>{job.creditsReserved} credits held</span>
                          <span className="inline-flex items-center gap-2 font-semibold text-[#171514]">
                            Open request
                            <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                          </span>
                        </div>
                      </Link>
                    )) : (
                      <div className="rounded-[18px] border border-dashed border-[#cfc3b6] bg-[#f8f4ed] p-5 text-sm text-[#706961]">
                        <p className="font-semibold text-[#14161a]">{emptyTitle}</p>
                        <p className="mt-2 leading-6">{emptyBody}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        );
      }

      return (
        <section className={`${sectionTheme.shell} px-5 py-8 ${sectionText}`} id={id}>
          <div className={`mx-auto overflow-hidden rounded-[32px] border ${sectionTheme.border} ${sectionTheme.panel} shadow-[0_24px_72px_-58px_rgba(20,22,26,0.24)]`}>
            <div className="grid gap-0 xl:grid-cols-[0.86fr_1.14fr]">
              <div className="border-b border-black/5 p-6 xl:border-b-0 xl:border-r xl:border-r-black/5 xl:p-8">
                <p className={`font-mono text-xs uppercase tracking-[0.22em] ${sectionTheme.accent}`}>{sectionEyebrow}</p>
                <h2 className={`mt-3 text-3xl font-semibold tracking-tight [font-family:var(--site-title-font)] ${sectionText}`}>{sectionTitle}</h2>
                <p className={`mt-3 max-w-xl text-sm leading-7 ${sectionBody}`}>{sectionSubtitle || "Only album requests for the current signed-in customer are visible here."}</p>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  {summaryCards.map((card) => (
                    <div className="rounded-[18px] border border-[#e4dace] bg-white p-4" key={card.label}>
                      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#8a7a6d]">{card.label}</p>
                      <p className="mt-3 text-2xl font-semibold text-[#14161a]">{card.value}</p>
                      <p className="mt-1 text-xs leading-5 text-[#625d56]">{card.detail}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-6 grid gap-4 lg:grid-cols-[1.04fr_0.96fr]">
                  <div className="relative overflow-hidden rounded-[24px] border border-[#e4dace] bg-[#efe6d9]">
                    <img className="aspect-[4/3] w-full object-cover" src={featureImage} alt={sectionTitle} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/52 via-black/10 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/60">{workflowLabel}</p>
                      <p className="mt-2 text-lg font-semibold">Show each customer exactly where every package request stands.</p>
                    </div>
                  </div>
                  <div className="rounded-[24px] border border-[#e4dace] bg-white/76 p-5 shadow-[0_18px_48px_-44px_rgba(20,22,26,0.12)]">
                    <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#8a7a6d]">timeline guide</p>
                    <div className="mt-4 grid gap-3">
                      {[
                        ["Waiting", "The request is queued and holding credits safely until rendering starts."],
                        ["Creating", "The photo pack is generating and remains visible inside the private account."],
                        ["Delivered", "Finished images move into the gallery without leaving the storefront workflow."]
                      ].map(([label, detail]) => (
                        <div className="rounded-[18px] border border-[#e4dace] bg-[#fffaf3] px-4 py-3" key={label}>
                          <p className="text-sm font-semibold text-[#171514]">{label}</p>
                          <p className="mt-1 text-xs leading-5 text-[#706961]">{detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-6 xl:p-8">
                <div className="mb-5 flex items-end justify-between gap-4">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#8a7a6d]">private request timeline</p>
                    <p className="mt-2 text-sm leading-6 text-[#625d56]">Waiting, creating, delivered, and review states are shown from this account only.</p>
                  </div>
                  <span className="rounded-full border border-[#ded5ca] bg-[#f8f4ed] px-3 py-1 text-xs font-semibold text-[#706961]">
                    {jobs.length} requests
                  </span>
                </div>
                <div className="grid gap-4">
                  {latestJob ? (
                    <div className="rounded-[24px] border border-[#e4dace] bg-white p-5 shadow-[0_20px_54px_-46px_rgba(20,22,26,0.14)]">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#8a7a6d]">latest request</p>
                          <h3 className="mt-3 text-2xl font-semibold tracking-tight text-[#171514]">{customerRequestTitle(latestJob, 0)}</h3>
                          <p className="mt-2 max-w-xl text-sm leading-6 text-[#625d56]">{customerStatusNarrative(latestJob.status)}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                          latestJob.status === "succeeded"
                            ? "bg-emerald-50 text-emerald-700"
                            : latestJob.status === "failed" || latestJob.status === "refunded"
                            ? "bg-rose-50 text-rose-700"
                            : latestJob.status === "running"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-zinc-100 text-zinc-700"
                        }`}>
                          {customerStatusLabel(latestJob.status)}
                        </span>
                      </div>
                      <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        {[
                          ["Updated", new Date(latestJob.updatedAt).toLocaleString("zh-CN", { hour12: false })],
                          ["Credits held", `${latestJob.creditsReserved}`],
                          ["Delivery path", latestJob.status === "succeeded" ? "Gallery ready" : "In private workflow"]
                        ].map(([label, value]) => (
                          <div className="rounded-[16px] border border-[#e5dbcf] bg-[#f8f4ed] px-4 py-3" key={label}>
                            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#8a7a6d]">{label}</p>
                            <p className="mt-2 text-sm font-semibold text-[#171514]">{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {jobs.length ? (
                    <div className="grid gap-3">
                      {jobs.map((job, index) => (
                        <Link className="grid gap-4 rounded-[20px] border border-[#e4dace] bg-[#f8f4ed] p-4 transition hover:-translate-y-0.5 hover:bg-white md:grid-cols-[auto_1fr_auto]" href={hrefFor(site, `/app/jobs/${job.id}`)} key={job.id}>
                          <div className="flex items-start justify-center pt-1">
                            <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold ${
                              job.status === "succeeded"
                                ? "bg-emerald-50 text-emerald-700"
                                : job.status === "failed" || job.status === "refunded"
                                ? "bg-rose-50 text-rose-700"
                                : job.status === "running"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-zinc-100 text-zinc-700"
                            }`}>
                              {String(index + 1).padStart(2, "0")}
                            </span>
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-3">
                              <p className="font-semibold text-[#14161a]">{customerRequestTitle(job, index)}</p>
                              <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                                job.status === "succeeded"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : job.status === "failed" || job.status === "refunded"
                                  ? "bg-rose-50 text-rose-700"
                                  : job.status === "running"
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-zinc-100 text-zinc-700"
                              }`}>
                                {customerStatusLabel(job.status)}
                              </span>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-[#625d56]">{customerStatusNarrative(job.status)}</p>
                            <p className="mt-2 text-xs text-[#706961]">{new Date(job.updatedAt).toLocaleString("zh-CN", { hour12: false })}</p>
                          </div>
                          <div className="flex flex-col items-start gap-2 text-sm text-[#625d56] md:items-end">
                            <span>{job.creditsReserved} credits held</span>
                            <span className="inline-flex items-center gap-2 font-semibold text-[#171514]">
                              Open request
                              <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-[18px] border border-dashed border-[#cfc3b6] bg-[#f8f4ed] p-5 text-sm text-[#706961]">
                      <p className="font-semibold text-[#14161a]">{emptyTitle}</p>
                      <p className="mt-2 leading-6">{emptyBody}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      );
    }

    const galleryItems = (albums.length ? albums : visibleOutputAssets);
    const leadGalleryItem = galleryItems[0];
    const secondaryGalleryItems = galleryItems.slice(1);
    const secondaryDisplayItems = secondaryGalleryItems.length ? secondaryGalleryItems : leadGalleryItem ? [leadGalleryItem] : [];
    return (
      <section className={`${sectionTheme.shell} px-5 py-8 ${sectionText}`} id={id}>
        <div className={`mx-auto overflow-hidden rounded-[32px] border ${sectionTheme.border} ${sectionTheme.panel} shadow-[0_24px_72px_-58px_rgba(20,22,26,0.3)]`}>
          <div className="grid gap-0 xl:grid-cols-[0.78fr_1.22fr]">
            <div className="border-b border-white/8 p-6 xl:border-b-0 xl:border-r xl:border-r-white/8 xl:p-8">
              <p className={`font-mono text-xs uppercase tracking-[0.22em] ${sectionTheme.accent}`}>{sectionEyebrow}</p>
              <h2 className={`mt-3 text-3xl font-semibold tracking-tight [font-family:var(--site-title-font)] ${sectionText}`}>{sectionTitle}</h2>
              <p className={`mt-3 max-w-xl text-sm leading-7 ${sectionBody}`}>{sectionSubtitle || "Only the current customer's delivered albums and gallery images are visible here."}</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {summaryCards.map((card) => (
                  <div className="rounded-[18px] border border-white/10 bg-white/[0.04] p-4" key={card.label}>
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/56">{card.label}</p>
                    <p className="mt-3 text-2xl font-semibold text-white">{card.value}</p>
                    <p className="mt-1 text-xs leading-5 text-white/68">{card.detail}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 grid gap-4">
                <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-black/20">
                  <img className="aspect-[4/3] w-full object-cover opacity-70" src={featureImage} alt={sectionTitle} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/58">{workflowLabel}</p>
                    <p className="mt-2 text-lg font-semibold">Deliver private lifestyle, portrait, and editorial images without breaking the premium look.</p>
                  </div>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-5">
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/56">delivery standard</p>
                  <div className="mt-4 grid gap-3">
                    {[
                      ["Private review", "Only the signed-in account can open, review, and download the delivered album."],
                      ["Download-ready files", "Albums stay grouped by pack so lifestyle, portrait, and editorial sets remain easy to download."],
                      ["Brand consistency", "The gallery stays inside the same luxury storefront language as pricing, login, and account pages."]
                    ].map(([label, detail]) => (
                      <div className="rounded-[18px] border border-white/10 bg-black/16 px-4 py-3" key={label}>
                        <p className="text-sm font-semibold text-white">{label}</p>
                        <p className="mt-1 text-xs leading-5 text-white/60">{detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 xl:p-8">
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/56">private album gallery</p>
                  <p className="mt-2 text-sm leading-6 text-white/68">Albums and gallery images stay private to this account, while still feeling like part of the photo storefront.</p>
                </div>
                <span className="rounded-full border border-white/12 bg-white/[0.05] px-3 py-1 text-xs font-semibold text-white/74">
                  {albums.length} albums
                </span>
              </div>
              <div className="grid gap-4">
                {leadGalleryItem ? (
                  (() => {
                    const href = "outputCount" in leadGalleryItem
                      ? (leadGalleryItem.sourceJobId ? hrefFor(site, `/app/jobs/${leadGalleryItem.sourceJobId}`) : hrefFor(site, "/app"))
                      : (leadGalleryItem.jobId ? hrefFor(site, `/app/jobs/${leadGalleryItem.jobId}`) : hrefFor(site, "/app"));
                    const title = "outputCount" in leadGalleryItem ? leadGalleryItem.title : leadGalleryItem.label;
                    const detail = "outputCount" in leadGalleryItem ? `${leadGalleryItem.outputCount} images` : "Private gallery image";
                    const status = "outputCount" in leadGalleryItem ? customerAlbumStatusLabel(leadGalleryItem.status) : customerAssetReviewLabel(leadGalleryItem.reviewStatus);
                    const thumb =
                      "outputCount" in leadGalleryItem
                        ? albumPreviewUrl(site, leadGalleryItem, runtime)
                        : assetPreviewUrl(site, leadGalleryItem.id, runtime) || fallbackImageForSeed(`${site.slug}-${leadGalleryItem.id}-album`);
                    return (
                      <Link className="group overflow-hidden rounded-[26px] border border-white/10 bg-white/[0.04] transition hover:-translate-y-0.5 hover:bg-white/[0.06]" href={href}>
                        <div className="relative aspect-[16/9] overflow-hidden bg-white/6">
                          <img className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" src={thumb} alt={title} />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/72 via-black/12 to-transparent" />
                          <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <span className="rounded-full border border-white/14 bg-white/[0.08] px-2.5 py-1 text-[11px] font-semibold text-white/72">{status}</span>
                              <span className="text-xs text-white/62">{detail}</span>
                            </div>
                            <h3 className="mt-4 text-2xl font-semibold tracking-tight [font-family:var(--site-title-font)]">{title}</h3>
                          </div>
                        </div>
                      </Link>
                    );
                  })()
                ) : null}
                {galleryItems.length ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {secondaryDisplayItems.map((item) => {
                      const href =
                        "outputCount" in item
                          ? item.sourceJobId
                            ? hrefFor(site, `/app/jobs/${item.sourceJobId}`)
                            : hrefFor(site, "/app")
                          : item.jobId
                            ? hrefFor(site, `/app/jobs/${item.jobId}`)
                            : hrefFor(site, "/app");
                      const title = "outputCount" in item ? item.title : item.label;
                      const detail = "outputCount" in item ? `${item.outputCount} images` : "Private gallery image";
                      const status = "outputCount" in item ? customerAlbumStatusLabel(item.status) : customerAssetReviewLabel(item.reviewStatus);
                      const thumb =
                        "outputCount" in item
                          ? albumPreviewUrl(site, item, runtime)
                          : assetPreviewUrl(site, item.id, runtime) || fallbackImageForSeed(`${site.slug}-${item.id}-album`);
                      return (
                        <Link className="overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.04] transition hover:-translate-y-0.5 hover:bg-white/[0.06]" href={href} key={item.id}>
                          <div className="aspect-[4/3] overflow-hidden bg-white/6">
                            <img className="h-full w-full object-cover" src={thumb} alt={title} />
                          </div>
                          <div className="p-4">
                            <p className="font-semibold text-white">{title}</p>
                            <p className="mt-2 text-sm text-white/68">{detail}</p>
                            <div className="mt-4 flex items-center justify-between gap-3">
                              <span className="rounded-full border border-white/12 bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold text-white/72">{status}</span>
                              <span className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                                {setting(section, "showDownloads", "true") === "true" ? "Open downloads" : "Open album"}
                                <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                              </span>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
                {!galleryItems.length ? (
                  <div className="rounded-[18px] border border-dashed border-white/12 bg-white/[0.03] p-5 text-sm text-white/68 md:col-span-2">
                    <p className="font-semibold text-white">{emptyTitle}</p>
                    <p className="mt-2 leading-6">{emptyBody}</p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (section.type === "search_results") {
    const searchTerm = queryValue(renderContext.query.q);
    const resultLimit = Math.max(1, numberSetting(section, "resultLimit", 12));
    const cards = searchCardsForQuery(
      siteSearchCards(site, products, siteAiApps, creativePacks, renderContext.pages),
      searchTerm
    ).slice(0, resultLimit);
    return (
      <section className="px-5 py-14" data-saas-section-renderer="search_results" id={sectionAnchor(section, id)}>
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <div className="rounded-[1.4rem] border border-black/10 bg-white p-5 shadow-[0_24px_70px_-58px_rgba(24,24,27,0.22)]">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--site-accent)]">{setting(section, "eyebrow", "Site search")}</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">
              {searchTerm ? `Results for "${searchTerm}"` : setting(section, "title", "Search this storefront")}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-600">{setting(section, "subtitle", "Search products, packs, tools, and content for this site.")}</p>
            <div className="mt-5 flex items-center gap-3 rounded-full border border-black/10 bg-zinc-50 px-4 py-3">
              <Search className="h-5 w-5 text-zinc-400" strokeWidth={1.8} />
              <span className="text-sm text-zinc-500">
                {searchTerm ? `${cards.length} storefront results` : "Use ?q= to search products, packs, tools, and content"}
              </span>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span className="rounded-full border border-black/10 bg-white px-3 py-1.5">{cards.length} results</span>
            <span className="rounded-full border border-black/10 bg-white px-3 py-1.5">products, packs, tools, pages</span>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((card) => (
              <Link className="rounded-[1.1rem] border border-black/10 bg-white p-4 transition hover:-translate-y-1" href={hrefFor(site, card.href)} key={`${card.kind}_${card.id}`}>
                <img className="aspect-[4/3] w-full rounded-[0.8rem] object-cover" src={card.imageUrl} alt={card.title} />
                <div className="mt-4 flex items-center justify-between gap-3">
                  <h3 className="font-semibold">{card.title}</h3>
                  <span className="rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-500">{card.kind}</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-zinc-500">{card.description}</p>
                <p className="mt-3 font-mono text-[11px] text-zinc-400">{card.meta}</p>
              </Link>
            ))}
          </div>
          {!cards.length ? (
            <div className="mt-8 rounded-[1.2rem] border border-dashed border-black/10 bg-white px-5 py-10 text-center">
              <p className="text-base font-semibold text-zinc-950">{setting(section, "emptyTitle", "No matching content yet.")}</p>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-zinc-500">{setting(section, "emptyBody", "Try pricing, credits, album, help, or privacy.")}</p>
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  if (section.type === "cart_summary") {
    const active = activeProducts(products);
    const selectedProductId = queryValue(renderContext.query.product);
    const selectedPriceId = queryValue(renderContext.query.price);
    const hasExplicitSelection = Boolean(selectedProductId || selectedPriceId);
    const { product: selectedProduct, price: selectedPrice } = selectedCartProduct(products, renderContext.query);
    const productsForCart = hasExplicitSelection && selectedProduct ? [selectedProduct] : active.slice(0, 2);
    const estimatedCredits = productsForCart.reduce((sum, product) => {
      const linePrice = product.id === selectedProduct?.id ? selectedPrice : productPrice(product);
      return sum + (linePrice?.creditsGranted ?? 0);
    }, 0);
    const estimatedAmount = productsForCart.reduce((sum, product) => {
      const linePrice = product.id === selectedProduct?.id ? selectedPrice : productPrice(product);
      return sum + (linePrice?.amountCents ?? 0);
    }, 0);
    const currency = selectedPrice?.currency ?? productsForCart[0]?.prices[0]?.currency ?? site.currency;
    const returnHref = setting(section, "returnHref", "/pricing");
    return (
      <section className="px-5 py-14" data-saas-section-renderer="cart_summary" id={sectionAnchor(section, id)}>
        <div className="mx-auto grid max-w-[var(--site-content-width)] gap-8 lg:grid-cols-[1fr_360px]">
          <div className="rounded-[1.4rem] border border-black/10 bg-white shadow-[0_24px_70px_-58px_rgba(24,24,27,0.22)]">
            <div className="border-b border-black/10 p-5">
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--site-accent)]">{setting(section, "eyebrow", "Checkout summary")}</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">{productsForCart.length ? setting(section, "title", "Your selected plan") : setting(section, "emptyTitle", "Choose a plan first")}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                {productsForCart.length ? setting(section, "subtitle", "Products, prices, credits, and checkout state stay tied to this storefront.") : setting(section, "emptyBody", "Open pricing to select a subscription or credit pack.")}
              </p>
            </div>
            <div className="divide-y divide-black/10">
              {productsForCart.map((product, index) => {
                const price = product.id === selectedProduct?.id ? selectedPrice ?? productPrice(product) : productPrice(product);
                return (
                  <div className="grid gap-4 p-5 sm:grid-cols-[96px_1fr_auto] sm:items-center" key={product.id}>
                    <img className="aspect-square rounded-[0.9rem] object-cover" src={productImage(site, product, index)} alt={product.name} />
                    <div>
                      <p className="font-semibold">{product.name}</p>
                      <p className="mt-1 text-sm text-zinc-500">{price?.creditsGranted ?? 0} credits</p>
                      {product.id === selectedProduct?.id && hasExplicitSelection ? <p className="mt-1 text-xs font-mono text-[var(--site-accent)]">Selected from pricing/search</p> : null}
                    </div>
                    <p className="font-mono">{price ? formatCurrency(price.amountCents, price.currency) : ""}</p>
                  </div>
                );
              })}
              {!productsForCart.length ? (
                <div className="p-8 text-sm text-zinc-500">{setting(section, "emptyBody", "Open pricing to select a subscription or credit pack.")}</div>
              ) : null}
            </div>
          </div>
          <aside className="h-fit rounded-[1.4rem] border border-black/10 bg-zinc-950 p-6 text-white shadow-[0_24px_70px_-58px_rgba(24,24,27,0.34)]">
            <ShoppingCart className="h-6 w-6 text-white/70" strokeWidth={1.8} />
            <h3 className="mt-5 text-2xl font-semibold">Checkout summary</h3>
            <p className="mt-2 text-sm leading-6 text-stone-300">
              {settingBool(section, "showCheckoutNote", true)
                ? "Credits appear after payment confirmation, so the account balance stays accurate."
                : "Review selected items before checkout."}
            </p>
            <div className="mt-6 rounded-[1rem] border border-white/10 bg-white/[0.05] p-4">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-white/64">Items</span>
                <span>{productsForCart.length}</span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                <span className="text-white/64">Credits</span>
                <span>{estimatedCredits}</span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                <span className="text-white/64">Amount</span>
                <span>{estimatedAmount ? formatCurrency(estimatedAmount, currency) : "--"}</span>
              </div>
            </div>
            <Link className="mt-6 inline-flex w-full justify-center rounded-full bg-white px-4 py-3 text-sm font-medium text-zinc-950" href={hrefFor(site, returnHref)}>
              {setting(section, "returnLabel", "Back to pricing")}
            </Link>
          </aside>
        </div>
      </section>
    );
  }

  if (section.type === "job_detail") {
    const jobDetail = runtime?.jobDetail;
    const job = jobDetail?.job;
    const app = job ? siteAiApps.find((item) => item.aiApp.id === job.aiAppId) : undefined;
    return (
      <section className="px-5 py-14" data-saas-section-renderer="job_detail" id={sectionAnchor(section, id)}>
        <div className="mx-auto max-w-[var(--site-content-width)]">
          {!job ? (
            <div className="rounded-[1.4rem] border border-dashed border-black/10 bg-white p-8 text-center">
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--site-accent)]">{setting(section, "eyebrow", "Album request")}</p>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight">{setting(section, "title", "Review one private album request.")}</h1>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-zinc-600">Open a request from the workspace to review its status, credits, and delivered images.</p>
            </div>
          ) : (
            <>
              <div className="grid gap-6 md:grid-cols-[1fr_0.82fr]">
                <div>
                  <Link className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-600" href={hrefFor(site, "/app")}>
                    <ChevronRight className="h-4 w-4 rotate-180" strokeWidth={1.8} />
                    Back to workspace
                  </Link>
                  <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--site-accent)]">{setting(section, "eyebrow", "Album request")}</p>
                  <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">{customerRequestTitle(job)}</h1>
                  <p className="mt-4 max-w-2xl leading-7 text-zinc-600">{setting(section, "subtitle", "Review the selected album request, held credits, delivered images, and credit history.")}</p>
                </div>
                <div className="rounded-[1.4rem] border border-black/10 bg-white p-6 shadow-[0_24px_70px_-58px_rgba(24,24,27,0.22)]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-zinc-500">{app?.aiApp.name ?? job.aiAppId}</p>
                      <h2 className="mt-1 text-2xl font-semibold">{job.creditsReserved} credits held</h2>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                      job.status === "succeeded"
                        ? "bg-emerald-50 text-emerald-700"
                        : job.status === "failed" || job.status === "refunded"
                        ? "bg-rose-50 text-rose-700"
                        : job.status === "running"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-zinc-100 text-zinc-700"
                    }`}>
                      {customerStatusLabel(job.status)}
                    </span>
                  </div>
                  <div className="mt-5 grid gap-3 text-sm">
                    <div className="flex items-center justify-between rounded-[1rem] border border-black/10 bg-[#fbfaf7] px-4 py-3">
                      <span className="text-zinc-500">Created</span>
                      <span className="font-mono">{new Date(job.createdAt).toLocaleString("zh-CN", { hour12: false })}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-[1rem] border border-black/10 bg-[#fbfaf7] px-4 py-3">
                      <span className="text-zinc-500">Updated</span>
                      <span className="font-mono">{new Date(job.updatedAt).toLocaleString("zh-CN", { hour12: false })}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-[1rem] border border-black/10 bg-[#fbfaf7] px-4 py-3">
                      <span className="text-zinc-500">Delivered files</span>
                      <span className="font-mono">{jobDetail.assets.length}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-8 grid gap-4 md:grid-cols-4">
                {[
                  { label: "Request status", value: customerStatusLabel(job.status), detail: "private request progress" },
                  { label: "Credits held", value: String(job.creditsReserved), detail: "held while creating" },
                  { label: "Credit entries", value: String(jobDetail.ledger.length), detail: "history for this request" },
                  { label: "Delivered files", value: String(jobDetail.assets.length), detail: "private gallery images" }
                ].map((item) => (
                  <div className="rounded-[1.1rem] border border-black/10 bg-white p-4" key={item.label}>
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400">{item.label}</p>
                    <p className="mt-3 text-2xl font-semibold">{item.value}</p>
                    <p className="mt-1 text-xs text-zinc-500">{item.detail}</p>
                  </div>
                ))}
              </div>
              <div className="mt-8 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
                {settingBool(section, "showLedger", true) ? (
                  <div className="rounded-[1.3rem] border border-black/10 bg-white p-5">
                    <h2 className="text-2xl font-semibold">Credit history</h2>
                    <div className="mt-5 divide-y divide-black/10 overflow-hidden rounded-[1rem] border border-black/10 bg-white">
                      {jobDetail.ledger.length ? jobDetail.ledger.map((entry) => (
                        <div className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[0.6fr_0.35fr_1fr]" key={entry.id}>
                          <span className="font-medium">{customerLedgerLabel(entry.type)}</span>
                          <span className="font-mono">{entry.amount}</span>
                          <span className="truncate font-mono text-xs text-zinc-500">{entry.createdAt}</span>
                        </div>
                      )) : (
                        <div className="px-4 py-6 text-sm text-zinc-500">No credit history for this request yet.</div>
                      )}
                    </div>
                  </div>
                ) : null}
                {settingBool(section, "showAssets", true) ? (
                  <div className="rounded-[1.3rem] border border-black/10 bg-white p-5">
                    <h2 className="text-2xl font-semibold">Delivered images</h2>
                    <div className="mt-5 grid gap-3">
                      {jobDetail.assets.length ? jobDetail.assets.map((asset) => (
                        <div className="rounded-[1rem] border border-black/10 bg-[#fbfaf7] p-4" key={asset.id}>
                          <p className="font-semibold">{asset.label}</p>
                          <p className="mt-1 text-sm text-zinc-500">Private gallery image</p>
                          <p className="mt-3 text-xs text-zinc-500">{asset.mimeType} / {customerAssetReviewLabel(asset.reviewStatus)}</p>
                        </div>
                      )) : (
                        <div className="rounded-[1rem] border border-dashed border-black/10 bg-[#fbfaf7] p-5 text-sm text-zinc-500">No delivered images are attached to this request yet.</div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>
      </section>
    );
  }

  if (section.type === "before_after_gallery") {
    const items = settingListBlocks(
      section,
      "items",
      [`Selfie intake|Editorial output|${fallbackHeroImages[1]}|${fallbackHeroImages[0]}`],
      (item, index) => {
        const [beforeLabel = "Before", afterLabel = "After", beforeImage = fallbackHeroImages[1], afterImage = fallbackHeroImages[0]] = item.split("|");
        return { id: `legacy_before_after_${index}`, type: "before_after", settings: { beforeLabel, afterLabel, beforeImage, afterImage } };
      }
    );
    return (
      <section className="px-5 py-16" id={sectionAnchor(section, id)}>
        <div className="mx-auto grid max-w-[var(--site-content-width)] gap-8 md:grid-cols-[0.8fr_1.2fr] md:items-center">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--site-accent)]">before and after</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">{setting(section, "title")}</h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-600">{setting(section, "subtitle")}</p>
          </div>
          <div className="grid gap-4">
            {items.map((item, index) => {
              const beforeLabel = blockValue(item, "beforeLabel", "Before");
              const afterLabel = blockValue(item, "afterLabel", "After");
              const beforeImage = mediaAssetUrl(site, blockValue(item, "beforeImage", fallbackHeroImages[1]));
              const afterImage = mediaAssetUrl(site, blockValue(item, "afterImage", fallbackHeroImages[0]));
              return (
                <div className="grid gap-3 rounded-[1.4rem] border border-black/10 bg-white p-3 shadow-[0_24px_80px_-60px_rgba(24,24,27,0.55)] sm:grid-cols-2" key={instanceKey(item, index, "before_after")} {...xfcartBlockAttrs(item, index, "before_after")}>
                  {[
                    [beforeLabel, beforeImage],
                    [afterLabel, afterImage]
                  ].map(([label, image]) => (
                    <div className="relative aspect-[4/5] overflow-hidden rounded-[1rem] bg-zinc-200" key={label}>
                      <img className="h-full w-full object-cover" src={image} alt={label} />
                      <span className="absolute left-3 top-3 rounded-full bg-white/82 px-3 py-1 text-xs font-medium backdrop-blur">{label}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  if (section.type === "testimonial_wall") {
    const items = settingListBlocks(
      section,
      "items",
      ["Private albums stay scoped.|Lumen customer|verified"],
      (item, index) => {
        const [quote, name, role] = parseTriplet(item);
        return { id: `legacy_testimonial_${index}`, type: "testimonial", settings: { quote, name, role } };
      }
    );
    const featuredVoices = items.slice(0, 4);
    return (
      <section className="relative overflow-hidden bg-[#fffaf3] px-5 py-16 text-[#14161a] md:py-18" id={sectionAnchor(section, id)}>
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <div className="grid gap-8 lg:grid-cols-[minmax(250px,0.3fr)_minmax(0,0.7fr)]">
            <div className="pt-2">
              <div className="h-px w-14 bg-[#b98a57]" />
              <h2 className="mt-4 max-w-[12ch] text-[clamp(2rem,3.4vw,3.35rem)] font-semibold leading-[1.04] tracking-[-0.03em] text-balance [font-family:var(--site-title-font)]">
                {setting(section, "summaryTitle", setting(section, "title"))}
              </h2>
              <p className="mt-5 max-w-[17rem] text-[0.94rem] leading-7 text-[#6d665f]">{setting(section, "summaryBody", setting(section, "subtitle"))}</p>
              <div className="mt-8 flex items-center gap-2 text-[#d59a4b]">
                {Array.from({ length: 5 }).map((_, starIndex) => (
                  <span key={starIndex}>★</span>
                ))}
                <span className="ml-3 text-[1.2rem] font-medium text-[#24211d]">{setting(section, "summaryRating", "4.9/5")}</span>
              </div>
              <p className="mt-2 text-[0.94rem] text-[#6d665f]">{setting(section, "summaryMeta", "From 10,000+ reviews")}</p>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                {items.slice(0, 5).map((item, index) => {
                  const name = blockValue(item, "name", "Customer");
                  const initials = name
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part) => part[0]?.toUpperCase() ?? "")
                    .join("");
                  return (
                    <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#eadfce] bg-[#f4ebe0] text-[0.72rem] font-semibold tracking-[0.08em] text-[#8c7156]" key={`${name}_${index}`}>
                      {initials || "CU"}
                    </div>
                  );
                })}
                <span className="ml-1 rounded-full border border-[#eadfce] bg-white px-3 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-[#7f786f]">
                  verified profiles
                </span>
              </div>
            </div>
            <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {featuredVoices.map((item, index) => {
                const avatar = mediaAssetUrl(site, blockValue(item, "avatarUrl", ""));
                const resultImage = mediaAssetUrl(site, blockValue(item, "resultImageUrl", fallbackHeroImages[index % fallbackHeroImages.length]));
                const rating = Math.max(1, Math.min(5, Number(blockValue(item, "rating", "5")) || 5));
                return (
                  <article className="group flex min-h-[380px] min-w-0 flex-col overflow-hidden rounded-[14px] border border-[#e7dccf] bg-white shadow-[0_22px_58px_-46px_rgba(20,22,26,0.16)]" key={instanceKey(item, index, "testimonial")} {...xfcartBlockAttrs(item, index, "testimonial")}>
                    <div className="flex flex-1 flex-col p-[18px]">
                      <div className="flex items-center gap-3">
                        {avatar ? (
                          <img className="h-14 w-14 rounded-full border-[3px] border-white object-cover shadow-[0_16px_34px_-25px_rgba(20,22,26,0.35)]" src={avatar} alt={blockValue(item, "name", "Customer")} />
                        ) : (
                          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f4ebe0] text-sm font-semibold text-[#8c7156]">
                            {blockValue(item, "name", "Customer").slice(0, 1) || "C"}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-[0.98rem] font-semibold text-[#171b22]">{blockValue(item, "name", "Customer")}</p>
                          <p className="mt-1 text-sm font-medium text-[#8a8d92]">{blockValue(item, "location", "")}</p>
                        </div>
                      </div>
                      <div className="mt-5 flex items-center gap-1 text-[1.02rem] leading-none text-[#d59a4b]">
                        {Array.from({ length: rating }).map((_, starIndex) => (
                          <span key={starIndex}>★</span>
                        ))}
                      </div>
                      <p className="mt-4 text-[0.9rem] leading-6 text-[#1c2026]">{blockValue(item, "quote")}</p>
                    </div>
                    <div className="relative h-[180px] overflow-hidden bg-[#f2e8da]">
                      <img className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]" src={resultImage} alt={`${blockValue(item, "name", "Customer")} photo result`} />
                      <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/38 to-transparent" />
                      <div className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/90 px-3 py-1.5 text-[11px] font-semibold text-[#171514] shadow-[0_10px_24px_-18px_rgba(20,22,26,0.35)] backdrop-blur">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#d59a4b]" />
                        Verified gallery
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (section.type === "faq") {
    const list = settingListBlocks(
      section,
      "items",
      ["Can I review the page before it changes for customers?|Yes. Draft edits can be reviewed first, then published when ready."],
      (item, index) => {
        const [question, answer] = parseFaq(item);
        return { id: `legacy_faq_${index}`, type: "faq_item", settings: { question, answer } };
      }
    );
    const journeyTitles = listLines(setting(section, "journeyTitles", "Upload|Choose Style|AI Generates|Download"));
    const journeyDescriptions = listLines(setting(section, "journeyDescriptions", "Upload your photos.|Pick a package and style.|AI builds your set.|Download from your private gallery."));
    const journeyIcons = [Camera, Globe2, Sparkles, Download];
    return (
      <section className="bg-[#f7f2ea] px-5 py-[4.5rem]" id={sectionAnchor(section, "faq")}>
        <div className="mx-auto grid max-w-[var(--site-content-width)] gap-8 md:grid-cols-[0.56fr_0.44fr]">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8f7d6d]">{setting(section, "eyebrow", "Questions before upload")}</p>
            <h2 className="mt-4 text-4xl font-semibold leading-[1.04] tracking-tight [font-family:var(--site-title-font)] md:text-5xl">{setting(section, "title", "FAQ")}</h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-[#6d665f]">{setting(section, "subtitle", "Answer the objections customers have before they upload private images or subscribe.")}</p>
            <div className="mt-7 grid gap-0 overflow-hidden rounded-[18px] border border-[#e6dccf] bg-white shadow-[0_22px_62px_-50px_rgba(24,24,27,0.12)]">
              {list.map((item, index) => {
                const question = blockValue(item, "question");
                const answer = blockValue(item, "answer");
                return (
                  <details className="group overflow-hidden bg-white data-[separated=true]:border-t data-[separated=true]:border-[#f0e6da]" data-separated={index > 0 ? "true" : "false"} key={instanceKey(item, index, "faq")} {...xfcartBlockAttrs(item, index, "faq")}>
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left">
                      <h3 className="text-[0.95rem] font-semibold text-[#171514]">{question}</h3>
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#eadfce] bg-[#fffaf3] text-lg leading-none text-[#8f7d6d] transition group-open:rotate-45">+</span>
                    </summary>
                    <div className="border-t border-[#f0e6da] bg-[#fffdfa] px-5 py-4">
                      <p className="max-w-[48rem] text-sm leading-7 text-[#6d665f]">{answer}</p>
                    </div>
                  </details>
                );
              })}
            </div>
          </div>
          <div className="border-l border-[#eadfce] bg-[#fffaf3] px-4 py-2 lg:px-8">
            <h3 className="max-w-[14ch] text-[1.75rem] font-semibold leading-[1.04] tracking-tight [font-family:var(--site-title-font)] lg:text-[2.05rem]">
              {setting(section, "journeyTitle", "Your photo flow")}
            </h3>
            <div className="mt-7 grid grid-cols-2 items-start gap-x-3 gap-y-6 sm:grid-cols-4 sm:gap-1">
              {journeyTitles.slice(0, 4).map((title, index) => {
                const Icon = journeyIcons[index] || Sparkles;
                return (
                  <div className="relative text-center" key={`${title}_${index}`}>
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#f4ebe0] text-[#a6723e] lg:h-14 lg:w-14">
                        <Icon className="h-5 w-5" strokeWidth={1.8} />
                    </div>
                    {index < 3 ? <ArrowRight className="absolute left-[calc(100%-0.55rem)] top-5 hidden h-4 w-4 text-[#8f7d6d] sm:block lg:top-6" strokeWidth={1.8} /> : null}
                    <h4 className="mt-4 text-[0.78rem] font-semibold text-[#171514] lg:text-[0.9rem]">{title}</h4>
                    <p className="mx-auto mt-2 max-w-[7.5rem] text-[0.72rem] leading-4 text-[#6d665f] lg:text-[0.78rem] lg:leading-5">{journeyDescriptions[index] || ""}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (section.type === "rich_text") {
    const eyebrow = setting(section, "eyebrow", "");
    const body = stripHtml(setting(section, "body", "Use this page to explain the photo experience, packages, delivery timing, and private customer journey."));
    const image = mediaAssetUrl(site, setting(section, "imageUrl", firstImage(section)));
    const cards = sectionBlocks(section);
    const primaryCta = setting(section, "primaryCta", "");
    const primaryHref = setting(section, "primaryHref", "");
    const secondaryCta = setting(section, "secondaryCta", "");
    const secondaryHref = setting(section, "secondaryHref", "");
    const tone = setting(section, "tone", "warm");
    const layout = setting(section, "layout", "commerce_intro");
    const HeadingTag = setting(section, "headingLevel", "h2") === "h1" ? "h1" : "h2";
    const dark = tone === "dark";
    const compact = layout === "compact";
    return (
      <section className={dark ? "bg-[#101114] px-5 py-16 text-white" : "grid-paper bg-[#f7f3ec] px-5 py-16 text-[#14161a]"} id={sectionAnchor(section, id)}>
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <div className={`grid gap-8 ${image ? "lg:grid-cols-[0.82fr_1.18fr] lg:items-center" : "lg:grid-cols-[0.72fr_1fr] lg:items-end"}`}>
            <div>
              {eyebrow ? <p className={dark ? "font-mono text-xs uppercase tracking-[0.22em] text-white/54" : "font-mono text-xs uppercase tracking-[0.22em] text-[#8a7a6d]"}>{eyebrow}</p> : null}
              <HeadingTag className={`${compact ? "mt-4 max-w-3xl text-3xl md:text-5xl" : "mt-4 max-w-4xl text-4xl md:text-6xl"} font-semibold leading-[1.04] tracking-tight text-balance [font-family:var(--site-title-font)]`}>
                {setting(section, "title", id)}
              </HeadingTag>
              <p className={dark ? "mt-5 max-w-3xl text-base leading-8 text-white/68" : "mt-5 max-w-3xl text-base leading-8 text-[#625d56]"}>{body}</p>
              {primaryCta || secondaryCta ? (
                <div className="mt-7 flex flex-wrap gap-3">
                  {primaryCta ? (
                    <Link className={dark ? "inline-flex items-center gap-2 rounded-[16px] bg-white px-5 py-3 text-sm font-semibold text-[#14161a] transition hover:-translate-y-0.5 active:scale-[0.98]" : "inline-flex items-center gap-2 rounded-[16px] bg-[#14161a] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 active:scale-[0.98]"} href={hrefFor(site, primaryHref || "/login")}>
                      {primaryCta}
                      <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                    </Link>
                  ) : null}
                  {secondaryCta ? (
                    <Link className={dark ? "inline-flex items-center gap-2 rounded-[16px] border border-white/14 bg-white/[0.06] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/[0.1] active:scale-[0.98]" : "inline-flex items-center gap-2 rounded-[16px] border border-[#ded5ca] bg-white/58 px-5 py-3 text-sm font-semibold text-[#14161a] transition hover:-translate-y-0.5 hover:bg-white active:scale-[0.98]"} href={hrefFor(site, secondaryHref || "/pricing")}>
                      {secondaryCta}
                      <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
                    </Link>
                  ) : null}
                </div>
              ) : null}
              {cards.length ? (
                <div className={dark ? "mt-8 grid gap-3 border-t border-white/12 pt-5 sm:grid-cols-2" : "mt-8 grid gap-3 border-t border-[#ddd4c8] pt-5 sm:grid-cols-2"}>
                  {cards.slice(0, 4).map((card, index) => (
                    <article className={dark ? "rounded-[18px] border border-white/10 bg-white/[0.05] p-4" : "rounded-[18px] border border-[#e4dace] bg-white/56 p-4 shadow-[0_18px_48px_-42px_rgba(20,22,26,0.18)]"} key={instanceKey(card, index, "rich_text_card")} {...xfcartBlockAttrs(card, index, "rich_text_card")}>
                      <p className={dark ? "font-mono text-[10px] uppercase tracking-[0.16em] text-white/46" : "font-mono text-[10px] uppercase tracking-[0.16em] text-[#8a7a6d]"}>{blockValue(card, "meta", String(index + 1).padStart(2, "0"))}</p>
                      <h3 className="mt-3 text-lg font-semibold tracking-tight">{blockValue(card, "title", blockValue(card, "label", "Editable item"))}</h3>
                      <p className={dark ? "mt-2 text-sm leading-6 text-white/62" : "mt-2 text-sm leading-6 text-[#625d56]"}>{blockValue(card, "description", blockValue(card, "text", ""))}</p>
                    </article>
                  ))}
                </div>
              ) : null}
            </div>
            {image ? (
              <div className={dark ? "overflow-hidden rounded-[28px] border border-white/10 bg-zinc-900 shadow-[0_32px_92px_-58px_rgba(0,0,0,0.84)]" : "overflow-hidden rounded-[28px] border border-[#ded5ca] bg-[#efe6d9] shadow-[0_28px_90px_-62px_rgba(20,22,26,0.34)]"}>
                <img className="aspect-[16/11] h-full w-full object-cover" src={image} alt={setting(section, "title", id)} />
              </div>
            ) : (
              <div className={dark ? "rounded-[28px] border border-white/10 bg-white/[0.05] p-6" : "rounded-[28px] border border-[#ded5ca] bg-[#fffdf8]/76 p-6 shadow-[0_24px_70px_-58px_rgba(20,22,26,0.22)]"}>
                <p className={dark ? "font-mono text-xs uppercase tracking-[0.18em] text-white/44" : "font-mono text-xs uppercase tracking-[0.18em] text-[#8a7a6d]"}>photo journey</p>
                <div className="mt-5 grid gap-3">
                  {(cards.length
                    ? cards.slice(0, 4).map((card, index) => [
                        blockValue(card, "title", blockValue(card, "label", `Step ${index + 1}`)),
                        blockValue(card, "description", blockValue(card, "text", "A clear step in the private photo pack journey."))
                      ])
                    : [
                        ["Choose a collection", "Compare packages, credits, delivery scope, and the photo style you want to create."],
                        ["Upload privately", "Add source portraits, style references, wardrobe ideas, and scene inspiration inside one account."],
                        ["Receive the album", "Track the request and review delivered lifestyle, portrait, and editorial images in a private gallery."]
                      ]).map(([label, detail]) => (
                    <div className={dark ? "rounded-[18px] border border-white/10 bg-black/18 px-4 py-3" : "rounded-[18px] border border-[#e4dace] bg-white/58 px-4 py-3"} key={label}>
                      <p className="text-sm font-semibold">{label}</p>
                      <p className={dark ? "mt-1 text-xs leading-5 text-white/58" : "mt-1 text-xs leading-5 text-[#706961]"}>{detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  if (section.type === "slide_plus") {
    const slides = sectionBlocks(section, "slide");
    const activeSlide = slides[0];
    const image = mediaAssetUrl(site, activeSlide ? blockValue(activeSlide, "src", fallbackHeroImages[0]) : firstImage(section) || fallbackHeroImages[0]);
    const title = activeSlide ? blockValue(activeSlide, "title", "Hero Banner") : setting(section, "title", id);
    const subtitle = activeSlide ? blockValue(activeSlide, "sub_title", "An introductory") : setting(section, "sub_title", "");
    const cta = activeSlide ? blockValue(activeSlide, "slide_cta", "Shop now") : "Shop now";
    return (
      <section className="relative min-h-[620px] overflow-hidden bg-zinc-950 px-5 text-white">
        <img className="absolute inset-0 h-full w-full object-cover opacity-72" src={image} alt={title} />
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/80 via-zinc-950/30 to-transparent" />
        <div className="relative mx-auto flex min-h-[620px] max-w-[var(--site-content-width)] items-center">
          <div className="max-w-2xl py-20">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-white/58">Featured storefront hero</p>
            <h1 className="mt-5 text-4xl font-semibold leading-none tracking-tight md:text-6xl">{title}</h1>
            <p className="mt-5 max-w-xl text-base leading-8 text-white/72">{subtitle}</p>
            <Link className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-zinc-950" href={hrefFor(site, "/login")}>
              {cta}
              <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (section.type === "collection_list_plus" || section.type === "products_plus") {
    const title = setting(section, "title", setting(section, "name", section.type === "products_plus" ? "Featured collection" : "Collection list"));
    const packs = creativePacks.filter((pack) => pack.status === "active");
    return (
      <section className="px-5 py-16" id={sectionAnchor(section, id)}>
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--site-accent)]">Photo collections</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">{title}</h2>
            </div>
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">{storefrontSectionLabel(section.type)}</span>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {(packs.length ? packs : creativePacks).slice(0, Number(setting(section, "max_count", "4")) || 4).map((pack) => (
              <Link className="group rounded-[1.2rem] border border-black/10 bg-white p-4 transition hover:-translate-y-1" href={hrefFor(site, `/tools/${pack.aiAppSlug}`)} key={pack.id}>
                <div className="aspect-[4/5] overflow-hidden rounded-[0.9rem] bg-zinc-200">
                  <img className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" src={packImages[pack.category] ?? packImages.fashion} alt={pack.name} />
                </div>
                <h3 className="mt-4 font-semibold">{pack.name}</h3>
                <p className="mt-1 text-xs leading-5 text-zinc-500">{pack.outputCount} images / {pack.creditCost} credits</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (section.type === "feature_columns" || section.type === "image_text" || section.type === "two_images" || section.type === "three_images" || section.type === "four_images") {
    const title = setting(section, "title", storefrontSectionLabel(section.type));
    const blocks = sectionBlocks(section);
    return (
      <section className="px-5 py-16">
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--site-accent)]">Photo story section</p>
          <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight md:text-5xl">{title}</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {(blocks.length ? blocks : [{ id: "fallback", type: "text_block", settings: { title: "Story block", text: "Add a focused photo guide, story, or collection detail for this page.", image: "" } }]).map((block, index) => {
              const image = mediaAssetUrl(site, blockValue(block, "image", blockValue(block, "src", packImages.fashion)));
              return (
                <article className="overflow-hidden rounded-[1.25rem] border border-black/10 bg-white" key={instanceKey(block, index, "visual_block")} {...xfcartBlockAttrs(block, index, "visual_block")}>
                  <div className="aspect-[16/11] bg-zinc-200">
                    <img className="h-full w-full object-cover" src={image || packImages.fashion} alt={blockValue(block, "title", storefrontSectionLabel(block.type))} />
                  </div>
                  <div className="p-5">
                    <h3 className="text-lg font-semibold">{blockValue(block, "title", blockValue(block, "name", storefrontSectionLabel(block.type)))}</h3>
                    <p className="mt-2 text-sm leading-6 text-zinc-600">{blockValue(block, "text", "Add a focused photo guide, story, or collection detail for this page.")}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  if (section.type === "logo_bar" || section.type === "reviews" || section.type === "slogan" || section.type === "newsletter") {
    const blocks = sectionBlocks(section);
    return (
      <section className="border-y border-black/10 bg-white px-5 py-12">
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--site-accent)]">Photo storefront</p>
          <h2 className="mt-3 text-2xl font-semibold">{setting(section, "title", setting(section, "name", storefrontSectionLabel(section.type)))}</h2>
          <div className="mt-6 flex flex-wrap gap-3">
            {(blocks.length ? blocks : [{ id: "fallback", type: "item", settings: { title: storefrontSectionLabel(section.type) } }]).map((block, index) => (
              <div className="rounded-full border border-black/10 bg-zinc-50 px-4 py-2 text-sm text-zinc-600" key={instanceKey(block, index, "simple_block")} {...xfcartBlockAttrs(block, index, "simple_block")}>
                {blockValue(block, "title", blockValue(block, "name", `${storefrontSectionLabel(section.type)} ${index + 1}`))}
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (section.type === "footer") return null;

  if (section.type === "header") return null;

  if (section.type === "policy_content") {
    const title = setting(section, "title", "Policy");
    const lastUpdated = setting(section, "lastUpdated", "June 25, 2024");
    const contactEmail = setting(section, "contactEmail", "support@dreamshootai.com");
    const body = setting(section, "body", "Private uploads, account activity, and delivered albums are handled according to this policy.");
    return (
      <section className="bg-[#f6f5f1] px-4 py-8 text-[#16181d] sm:px-5 md:py-12" id={sectionAnchor(section, id)}>
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <div className="max-w-4xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#7a746b]">{setting(section, "eyebrow", "Policy")}</p>
            <h2 className="mt-4 text-[clamp(2.1rem,5vw,4.3rem)] font-semibold leading-[0.98] tracking-[-0.03em] text-balance [font-family:var(--site-title-font)]">
              {title}
            </h2>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[#6f685f]">
              <span>Last updated: {lastUpdated}</span>
              <span>
                Contact:{" "}
                <a className="text-[#14161a] underline decoration-[#14161a]/25 underline-offset-4" href={`mailto:${contactEmail}`}>
                  {contactEmail}
                </a>
              </span>
            </div>
          </div>
          <article className="mt-8 max-w-4xl rounded-[28px] border border-[#e5ddd1] bg-white p-6 shadow-[0_24px_80px_-64px_rgba(18,20,24,0.25)] md:p-8">
            <div
              className="space-y-6 text-[0.97rem] leading-8 text-[#3d3a36] [&_h3]:mt-8 [&_h3]:text-[1.05rem] [&_h3]:font-semibold [&_h3]:tracking-[-0.02em] [&_p]:mt-3 [&_p]:leading-8 [&_a]:text-[#2f6fed] [&_a]:underline [&_a]:decoration-[#2f6fed]/30 [&_a]:underline-offset-4 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6"
              dangerouslySetInnerHTML={richTextHtml(section, "body", body)}
            />
          </article>
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <Link className="rounded-full border border-[#e3dcca] bg-white px-4 py-2 text-[#14161a] transition hover:-translate-y-0.5" href={hrefFor(site, "/privacy-policy")}>
              Privacy Policy
            </Link>
            <Link className="rounded-full border border-[#e3dcca] bg-white px-4 py-2 text-[#14161a] transition hover:-translate-y-0.5" href={hrefFor(site, "/terms-of-service")}>
              Terms of Service
            </Link>
            <Link className="rounded-full border border-[#e3dcca] bg-white px-4 py-2 text-[#14161a] transition hover:-translate-y-0.5" href={hrefFor(site, "/help")}>
              Help center
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (section.type === "blog_list") {
    const guideType = setting(section, "guideType", "AI photo guide");
    return (
      <section className="px-5 py-10">
        <div className="mx-auto max-w-[var(--site-content-width)] rounded-[1.4rem] border border-black/10 bg-white p-6">
          <h2 className="text-2xl font-semibold">{setting(section, "title", "Guides")}</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {["How to choose upload photos", "Credits and album delivery", "Planning a themed AI shoot"].map((title) => (
              <article className="rounded-xl border border-black/10 p-4" key={title}>
                <p className="font-medium">{title}</p>
                <p className="mt-2 text-xs leading-5 text-zinc-500">{guideType}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    );
  }

  const schema = getSectionSchema(section.type);
  const image = mediaAssetUrl(site, firstImage(section));
  return (
    <section className="px-5 py-10">
      <div className="mx-auto grid max-w-[var(--site-content-width)] gap-6 rounded-[1.4rem] border border-black/10 bg-white p-6 md:grid-cols-[0.7fr_1fr]">
        {image ? (
          <div className="aspect-[16/10] overflow-hidden rounded-[1rem] bg-zinc-200">
            <img className="h-full w-full object-cover" src={image} alt={schema.label} />
          </div>
        ) : null}
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">{importedThemeBadge(schema)}</p>
          <h2 className="mt-3 text-2xl font-semibold">{setting(section, "title", setting(section, "name", schema.label))}</h2>
          <p className="mt-2 text-zinc-600">{setting(section, "body", setting(section, "text", schema.description))}</p>
          {sectionBlocks(section).length ? (
            <div className="mt-4 grid gap-2">
              {sectionBlocks(section).slice(0, 6).map((block, index) => (
                <div className="rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-600" key={instanceKey(block, index, "fallback_block")} {...xfcartBlockAttrs(block, index, "fallback_block")}>
                  {block.type}: {blockValue(block, "title", blockValue(block, "label", blockValue(block, "name", "Editable block")))}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
