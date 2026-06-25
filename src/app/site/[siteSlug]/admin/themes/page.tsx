import { AdminShell } from "@/components/admin/admin-shell";
import { DesignWorkspaceTabs } from "@/components/admin/design-workspace-tabs";
import { ErpInfoList, ErpSection, ErpToolbar, ErpToolbarAction, ErpToolbarField } from "@/components/admin/erp-primitives";
import { ThemeManagerPanel } from "@/components/admin/theme-manager-panel";
import type { SiteThemeSummary, ThemeCopySummary, ThemePublicationSummary } from "@/components/admin/theme-manager-panel";
import {
  getSiteAdminData,
  modulePath,
  siteAdminAccount,
  siteAdminModuleLinks,
  siteAdminNav,
  siteAdminWorkspace
} from "../_lib/site-admin-context";
import { getAvailableInternalThemePackageSummaries, getAvailableSaasThemeSummariesForInstall, getSiteSaasThemeRecords } from "@/lib/server-store";
import { getSiteSaasThemeRecordsSummaryRelational } from "@/lib/stores/theme-store";

export default async function SiteThemesPage({ params }: { params: Promise<{ siteSlug: string }> }) {
  const { siteSlug } = await params;
  const data = await getSiteAdminData(siteSlug, { include: ["themeSettings"], summary: false, take: 0 });
  const [records, availableThemes, internalPackages] = await Promise.all([
    getSiteSaasThemeRecordsSummaryRelational(data.site.id).catch(() => getSiteSaasThemeRecords(data.site.id)),
    Promise.resolve(getAvailableSaasThemeSummariesForInstall()),
    Promise.resolve(getAvailableInternalThemePackageSummaries())
  ]);
  const themeRecords = records.themes as SiteThemeSummary[];
  const themeCopies = records.copies as ThemeCopySummary[];
  const themePublications = records.publications as ThemePublicationSummary[];
  const seoReady = Boolean(data.site.themeSettings.draftJson.seo?.siteTitle && data.site.themeSettings.draftJson.seo?.siteDescription);
  const activeThemes = themeRecords.filter((theme) => theme.status === "active").length;
  const latestPublication = themePublications.at(-1);
  const latestPublicationPageCount = latestPublication?.pageCount ?? 0;

  return (
    <AdminShell
      activeModuleCode="design"
      account={siteAdminAccount(data.site, data.current)}
      action={{ label: "打开装修器", href: modulePath(data.site, "/admin/design/workbench") }}
      breadcrumbs={[
        { label: "店铺管理", href: modulePath(data.site, "/admin") },
        { label: "店铺装修", href: modulePath(data.site, "/admin/design") },
        { label: "主题库" }
      ]}
      brand={data.site.branding.logoText}
      eyebrow="theme library"
      moduleLinks={siteAdminModuleLinks}
      nav={siteAdminNav(data.site, data)}
      rightRail={
        <>
          <ErpSection description="展示当前线上主题、主题分支数量和发布状态。" eyebrow="storefront status" title="当前启用主题">
            <ErpInfoList
              items={[
                { label: "Active theme", value: records.active.name, tone: "good" },
                { label: "Status", value: records.active.status, tone: "good" },
                { label: "Theme key", value: records.active.themeKey, tone: "neutral" },
                { label: "Publications", value: String(themePublications.length), tone: themePublications.length ? "good" : "warn" },
                { label: "Copies", value: String(themeCopies.length), tone: themeCopies.length ? "good" : "neutral" }
              ]}
            />
          </ErpSection>

          <ErpSection description="前台站点始终读取最近一次已发布快照。" eyebrow="publication" title="最近一次发布">
            {latestPublication ? (
              <ErpInfoList
                items={[
                  { label: "Version", value: `v${latestPublication.version}`, tone: "good" },
                  { label: "Pages", value: `${latestPublicationPageCount} 个页面`, tone: "good" },
                  { label: "Published", value: new Date(latestPublication.publishedAt).toLocaleString("zh-CN"), tone: "neutral" }
                ]}
              />
            ) : (
              <div className="tixing">还没有发布记录。</div>
            )}
            <div className="mt-3">
              <ErpToolbarAction href={modulePath(data.site, "/admin/design/publications")} label="查看发布历史" primary />
            </div>
          </ErpSection>
        </>
      }
      siteSlug={data.site.slug}
      subtitle="按站点管理主题安装、草稿应用、发布快照和版本复制。主题包、发布记录和草稿状态都在这里统一维护。"
      title="主题库"
      titleBadge={String(themeRecords.length)}
      workspace={siteAdminWorkspace(data, "theme library")}
    >
      <div className="grid gap-3">
        <ErpSection
          action={<ErpToolbarAction href={modulePath(data.site, "/admin/design")} label="进入设计器" primary />}
          description="主题包先进入站点，再应用到草稿，确认无误后通过发布快照切到线上。"
          eyebrow="theme workspace"
          title="主题工作台"
        >
          <ErpToolbar>
            <div className="flex flex-wrap gap-3">
              <ErpToolbarField label="主题总数" value={String(themeRecords.length)} />
              <ErpToolbarField label="线上启用" value={`${activeThemes} 个`} />
              <ErpToolbarField label="导入源" value={`${availableThemes.length + internalPackages.length} 个`} />
              <ErpToolbarField label="排序" value="最近更新" />
            </div>
            <div className="flex flex-wrap gap-2">
              <ErpToolbarAction href={modulePath(data.site, "/admin/design/publications")} label="发布记录" />
              <ErpToolbarAction href={modulePath(data.site, "/admin/media")} label="素材中心" />
            </div>
          </ErpToolbar>
          <div className="mt-3">
            <DesignWorkspaceTabs
              activePath="/admin/themes"
              mediaCount={data.mediaCount}
              pageCount={data.site.pages.length}
              publicationCount={themePublications.length}
              seoReady={seoReady}
              siteSlug={data.site.slug}
            />
          </div>
        </ErpSection>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0">
              <ThemeManagerPanel
                active={records.active}
                availableThemes={availableThemes}
                copies={themeCopies}
                draft={records.draft}
                internalPackages={internalPackages}
                publications={themePublications}
                siteId={data.site.id}
                siteSlug={data.site.slug}
                themes={themeRecords}
              />
          </div>

          <ErpSection description="保证装修配置与真实套餐、工具和发布快照保持一致，避免前后台脱节。" eyebrow="theme rules" title="主题约束">
            <ErpInfoList
              items={[
                { label: "pricing_table", value: "绑定真实套餐", tone: "good" },
                { label: "Draft edits", value: "不影响线上", tone: "good" },
                { label: "Publication", value: "发布后切换前台", tone: "good" },
                { label: "Rollback", value: "快照恢复草稿", tone: "neutral" }
              ]}
            />
          </ErpSection>
          </div>
      </div>
    </AdminShell>
  );
}
