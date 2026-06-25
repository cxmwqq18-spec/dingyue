import { FileClock, FileText, GalleryVerticalEnd, ImageIcon, Layers3, Palette, SearchCode } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { DesignWorkspaceTabs } from "@/components/admin/design-workspace-tabs";
import { ErpInfoList, ErpSection, ErpStatGrid, ErpToolbar, ErpToolbarAction, ErpToolbarField } from "@/components/admin/erp-primitives";
import {
  getSiteAdminData,
  modulePath,
  siteAdminAccount,
  siteAdminModuleLinks,
  siteAdminNav,
  siteAdminStats,
  siteAdminWorkspace
} from "../_lib/site-admin-context";
import { getSiteSaasThemeLabelsRelational, getSiteThemePublicationCountRelational } from "@/lib/stores/theme-store";

export default async function DesignPage({ params }: { params: Promise<{ siteSlug: string }> }) {
  const { siteSlug } = await params;
  const data = await getSiteAdminData(siteSlug, { include: ["themeSettings"], summary: false, take: 0 });
  const [themeLabels, publicationCount] = await Promise.all([
    getSiteSaasThemeLabelsRelational(data.site.id),
    getSiteThemePublicationCountRelational(data.site.id)
  ]);
  const seoReady = Boolean(data.site.themeSettings.draftJson.seo?.siteTitle && data.site.themeSettings.draftJson.seo?.siteDescription);
  const settingsDirty = JSON.stringify(data.site.themeSettings.draftJson) !== JSON.stringify(data.site.themeSettings.publishedJson);
  const pageCount = data.site.pages.length;
  const menuCount = data.site.themeSettings.draftJson.navigation.headerLinks.length + data.site.themeSettings.draftJson.navigation.footerLinks.length;
  const activeTheme = themeLabels.active?.name ?? "未发布主题";
  const draftTheme = themeLabels.draft?.name ?? "当前草稿主题";

  return (
    <AdminShell
      activeModuleCode="design"
      account={siteAdminAccount(data.site, data.current)}
      action={{ label: "打开装修器", href: modulePath(data.site, "/admin/design/workbench") }}
      breadcrumbs={[
        { label: "店铺管理", href: modulePath(data.site, "/admin") },
        { label: "店铺装修" }
      ]}
      brand={data.site.branding.logoText}
      eyebrow="店铺装修"
      moduleLinks={siteAdminModuleLinks}
      nav={siteAdminNav(data.site, data)}
      siteSlug={data.site.slug}
      stats={siteAdminStats(data)}
      subtitle="这里先展示主题、页面、导航、SEO 和发布状态；真正的可视化装修器按需打开，避免切换模块时加载重型编辑器。"
      title="店铺装修"
      titleBadge={`${pageCount} 页`}
      workspace={siteAdminWorkspace(data, "design workspace")}
      rightRailMode="stacked"
      rightRail={
        <ErpSection description="发布后的前台读取线上快照，草稿保存不会影响客户访问。" eyebrow="主题状态" title="当前主题">
          <ErpInfoList
            items={[
              { label: "线上主题", value: activeTheme, tone: themeLabels.active ? "good" : "warn" },
              { label: "草稿主题", value: draftTheme, tone: "neutral" },
              { label: "发布快照", value: String(publicationCount), tone: publicationCount ? "good" : "warn" },
              { label: "SEO", value: seoReady ? "已配置" : "待配置", tone: seoReady ? "good" : "warn" }
            ]}
          />
        </ErpSection>
      }
    >
      <div className="grid gap-4">
        <ErpToolbar>
          <div className="flex flex-wrap gap-3">
            <ErpToolbarField label="页面" value={String(pageCount)} />
            <ErpToolbarField label="导航链接" value={String(menuCount)} />
            <ErpToolbarField label="发布快照" value={String(publicationCount)} />
            <ErpToolbarField label="草稿设置" value={settingsDirty ? "有变更" : "已同步"} />
          </div>
          <div className="flex flex-wrap gap-2">
            <ErpToolbarAction href={modulePath(data.site, "/admin/design/workbench")} label="打开装修器" primary />
            <ErpToolbarAction href={modulePath(data.site, "/admin/design/publications")} label="发布历史" />
          </div>
        </ErpToolbar>

        <DesignWorkspaceTabs
          activePath="/admin/design"
          mediaCount={data.mediaCount}
          pageCount={pageCount}
          publicationCount={publicationCount}
          seoReady={seoReady}
          siteSlug={data.site.slug}
        />

        <ErpStatGrid
          columns={4}
          items={[
            { label: "页面树", value: String(pageCount), detail: "管理页面草稿、页面类型和首屏结构", icon: FileText, tone: pageCount ? "good" : "warn", href: modulePath(data.site, "/admin/design/pages") },
            { label: "导航菜单", value: String(menuCount), detail: "维护页眉、页脚和站内入口", icon: GalleryVerticalEnd, tone: menuCount ? "good" : "neutral", href: modulePath(data.site, "/admin/design/navigation") },
            { label: "发布历史", value: String(publicationCount), detail: "查看发布快照、回滚和发布前检查", icon: FileClock, tone: publicationCount ? "good" : "warn", href: modulePath(data.site, "/admin/design/publications") },
            { label: "SEO 设置", value: seoReady ? "ready" : "setup", detail: "站点标题、描述、OG 图和索引设置", icon: SearchCode, tone: seoReady ? "good" : "warn", href: modulePath(data.site, "/admin/design/seo") }
          ]}
        />

        <ErpSection
          action={<ErpToolbarAction href={modulePath(data.site, "/admin/design/workbench")} label="进入装修器" primary />}
          description="可视化装修器会加载页面 JSON、媒体、套餐和区块编辑器，适合真正编辑时打开；普通模块切换先进入此轻量总览。"
          eyebrow="visual editor"
          title="可视化装修器"
        >
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { label: "装修器", detail: "拖拽区块、编辑主题设置和预览前台。", icon: Palette, href: modulePath(data.site, "/admin/design/workbench") },
              { label: "主题库", detail: "安装主题包、应用草稿和查看主题分支。", icon: Layers3, href: modulePath(data.site, "/admin/themes") },
              { label: "素材库", detail: "管理主题图片、套餐封面和外链资源。", icon: ImageIcon, href: modulePath(data.site, "/admin/media") }
            ].map((item) => (
              <a className="rounded-[8px] border border-[var(--admin-border-soft)] bg-white px-4 py-4 text-[13px] transition hover:border-[var(--admin-accent-soft)] hover:bg-[var(--admin-panel)]" href={item.href} key={item.label}>
                <item.icon className="h-5 w-5 text-[var(--admin-accent)]" strokeWidth={1.8} />
                <p className="mt-3 font-semibold text-[var(--admin-text)]">{item.label}</p>
                <p className="mt-1 leading-5 text-[#667085]">{item.detail}</p>
              </a>
            ))}
          </div>
        </ErpSection>
      </div>
    </AdminShell>
  );
}
