import Link from "next/link";
import { ExternalLink, FileClock, FileText, GalleryVerticalEnd, ImageIcon, Layers3, Palette, SearchCode } from "lucide-react";

type DesignWorkspaceTabsProps = {
  siteSlug: string;
  pageCount: number;
  mediaCount: number;
  publicationCount: number;
  activePath?: string;
  seoReady?: boolean;
  tone?: "light" | "dark";
  compact?: boolean;
};

function tabClass(active: boolean, tone: "light" | "dark") {
  if (tone === "dark") {
    return active
      ? "border-[#3f8cff] bg-[#2f6fed] text-white shadow-[0_10px_22px_-16px_rgba(47,111,237,0.72)]"
      : "border-white/18 bg-white/[0.06] text-white/90 hover:border-white/30 hover:bg-white/[0.1] hover:text-white";
  }
  return active
    ? "border-[var(--admin-accent)] bg-[var(--admin-accent)] text-white shadow-[0_14px_24px_-18px_rgba(27,119,243,0.52)]"
    : "border-[var(--admin-border-soft)] bg-white text-[var(--admin-muted)] hover:border-[var(--admin-accent-soft)] hover:text-[var(--admin-accent)]";
}

export function DesignWorkspaceTabs({
  siteSlug,
  pageCount,
  mediaCount,
  publicationCount,
  activePath = "/admin/design",
  seoReady = false,
  tone = "light",
  compact = false
}: DesignWorkspaceTabsProps) {
  const allItems = [
    { label: "总览", href: `/site/${siteSlug}/admin/design`, icon: Palette, badge: String(pageCount) },
    { label: "页面", href: `/site/${siteSlug}/admin/design/pages`, icon: FileText, badge: String(pageCount) },
    { label: "导航", href: `/site/${siteSlug}/admin/design/navigation`, icon: GalleryVerticalEnd, badge: "menu" },
    { label: "SEO", href: `/site/${siteSlug}/admin/design/seo`, icon: SearchCode, badge: seoReady ? "meta" : "setup" },
    { label: "主题", href: `/site/${siteSlug}/admin/themes`, icon: Layers3, badge: "library" },
    { label: "素材", href: `/site/${siteSlug}/admin/media`, icon: ImageIcon, badge: String(mediaCount) },
    { label: "发布", href: `/site/${siteSlug}/admin/design/publications`, icon: FileClock, badge: String(publicationCount) },
    { label: "装修器", href: `/site/${siteSlug}/admin/design/workbench`, icon: Palette, badge: "edit" },
    { label: "前台", href: `/site/${siteSlug}`, icon: ExternalLink, badge: "live", external: true }
  ];
  const items = compact
    ? allItems.filter((item) => ["总览", "页面", "导航", "SEO", "发布", "装修器", "前台"].includes(item.label))
    : allItems;

  return (
    <div className={`flex overflow-x-auto ${tone === "dark" ? "items-center gap-1.5 pb-1" : "flex-wrap gap-2"}`} data-admin-tabs="saas-design-workspace-tabs">
      {items.map((item) => {
        const active = activePath === item.href.replace(`/site/${siteSlug}`, "");
        return (
          <Link
            className={`inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-[12px] border transition active:scale-[0.98] ${compact ? "min-w-[92px] px-3" : "px-3"} ${tone === "dark" ? "text-[13px] font-semibold" : "text-xs font-medium"} ${tabClass(active, tone)}`}
            href={item.href}
            key={item.href}
            prefetch={false}
            title={item.label}
            target={item.external ? "_blank" : undefined}
            rel={item.external ? "noreferrer" : undefined}
          >
            <item.icon className={tone === "dark" ? "h-4 w-4 shrink-0 opacity-95" : "h-3.5 w-3.5"} strokeWidth={1.8} />
            <span className="whitespace-nowrap">{item.label}</span>
            <span
              className={`${compact ? "hidden xl:inline-flex" : "inline-flex"} ml-auto rounded-[4px] border px-1.5 py-0.5 font-mono text-[10px] leading-none ${
                tone === "dark"
                  ? active
                    ? "border-white/30 bg-white/18 text-white"
                    : "border-white/18 bg-white/14 text-white/78"
                  : active
                    ? "border-white/20 bg-white/15 text-white"
                    : "border-[var(--admin-border-soft)] bg-[var(--admin-panel)] text-[#8a94a6]"
              }`}
            >
              {item.badge}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
