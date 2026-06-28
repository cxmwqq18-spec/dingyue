import { ImageIcon, Layers3, Link2, Palette } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { DesignWorkspaceTabs } from "@/components/admin/design-workspace-tabs";
import { ErpInfoList, ErpSection, ErpStatGrid, ErpToolbar, ErpToolbarAction, ErpToolbarField } from "@/components/admin/erp-primitives";
import { ThemeMediaPanel } from "@/components/admin/theme-media-panel";
import { OpsCard, StatusPill } from "@/components/ui";
import { getSiteMediaSummaryRelational } from "@/lib/stores/site-store";
import {
  getSiteAdminData,
  modulePath,
  siteAdminAccount,
  siteAdminModuleLinks,
  siteAdminNav,
  siteAdminStats
} from "../_lib/site-admin-context";

export default async function SiteMediaPage({ params }: { params: Promise<{ siteSlug: string }> }) {
  const { siteSlug } = await params;
  const data = await getSiteAdminData(siteSlug, { include: ["media"], summary: false, take: 40 });
  const mediaSummary = await getSiteMediaSummaryRelational(data.site.id);
  const themeAssets = mediaSummary.usageCounts.theme ?? 0;
  const packAssets = mediaSummary.usageCounts.pack_cover ?? 0;
  const externalAssets = mediaSummary.sourceCounts.external_url ?? 0;
  const uploadAssets = mediaSummary.sourceCounts.site_upload ?? 0;
  const mediaTotal = mediaSummary.total;
  const seoReady = Boolean(data.site.themeSettings.draftJson.seo?.siteTitle && data.site.themeSettings.draftJson.seo?.siteDescription);
  const publicationCount = data.publicationCount;

  return (
    <AdminShell
      activeModuleCode="design"
      account={siteAdminAccount(data.site, data.current)}
      action={{ label: "打开装修器", href: modulePath(data.site, "/admin/design/workbench") }}
      breadcrumbs={[
        { label: "店铺管理", href: modulePath(data.site, "/admin") },
        { label: "店铺装修", href: modulePath(data.site, "/admin/design") },
        { label: "素材中心" }
      ]}
      brand={data.site.branding.logoText}
      eyebrow="site media operations"
      moduleLinks={siteAdminModuleLinks}
      nav={siteAdminNav(data.site, data)}
      siteSlug={data.site.slug}
      stats={siteAdminStats(data)}
      subtitle="站点级素材库用于服务装修器、套餐封面、政策页图片和品牌资源，不与客户私有上传混用。"
      title="素材中心"
      titleBadge={String(mediaTotal)}
      workspace={{
        label: "media workspace",
        name: `${data.site.name} Theme Assets`,
        meta: `${mediaTotal} records / current site only`,
        statusLabel: mediaTotal ? "ready" : "empty",
        statusTone: mediaTotal ? "good" : "warn"
      }}
      rightRail={
        <>
          <OpsCard className="p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">binding scope</p>
            <h2 className="mt-2 text-lg font-semibold">Designer resource flow</h2>
            <div className="mt-4">
              <ErpInfoList
                items={[
                  { label: "Site media", value: String(mediaTotal), tone: mediaTotal ? "good" : "warn" },
                  { label: "Theme usage", value: String(themeAssets), tone: "good" },
                  { label: "Pack covers", value: String(packAssets), tone: "neutral" },
                  { label: "External refs", value: String(externalAssets), tone: "neutral" }
                ]}
              />
            </div>
          </OpsCard>

          <OpsCard className="p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">storefront note</p>
            <h2 className="mt-2 text-lg font-semibold">Published consumption</h2>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Theme sections now resolve `mediaAssetId`, `storageKey`, `previewUrl`, and `originUrl` against current site assets before falling back to seeded demo art.
            </p>
            <div className="mt-4">
              <StatusPill label="site-scoped media resolution" tone="good" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <ErpToolbarAction href={modulePath(data.site, "/admin/design")} label="区块编辑器" primary />
              <ErpToolbarAction href={modulePath(data.site, "")} label="打开前台" />
            </div>
          </OpsCard>
        </>
      }
    >
      <div className="grid gap-5">
        <DesignWorkspaceTabs
          activePath="/admin/media"
          mediaCount={mediaTotal}
          pageCount={data.site.pages.length}
          publicationCount={publicationCount}
          seoReady={seoReady}
          siteSlug={data.site.slug}
        />

        <ErpStatGrid
          items={[
            { label: "assets", value: String(mediaTotal), detail: "site-scoped media records", icon: ImageIcon, tone: mediaTotal ? "good" : "warn" },
            { label: "theme", value: String(themeAssets), detail: "section and theme assets", icon: Palette, tone: themeAssets ? "good" : "neutral" },
            { label: "pack covers", value: String(packAssets), detail: "creative pack cover assets", icon: Layers3, tone: packAssets ? "good" : "neutral" },
            { label: "external", value: String(externalAssets), detail: `${uploadAssets} uploaded / ${externalAssets} linked`, icon: Link2, tone: externalAssets ? "neutral" : "good" }
          ]}
        />

        <ErpSection
          action={<ErpToolbarAction href={modulePath(data.site, "/admin/design/workbench")} label="打开装修器" primary />}
          description="装修素材、拍摄包封面、政策页图片和品牌资源都在站点级素材库里管理，供 section 字段直接绑定。"
          eyebrow="media workspace"
          title="站点素材库"
        >
          <ErpToolbar>
            <div className="flex flex-wrap gap-3">
              <ErpToolbarField label="总资源" value={String(mediaTotal)} />
              <ErpToolbarField label="主题资源" value={String(themeAssets)} />
              <ErpToolbarField label="站点上传" value={String(uploadAssets)} />
            </div>
            <div className="flex flex-wrap gap-2">
              <ErpToolbarAction href={modulePath(data.site, "/admin/themes")} label="主题库" />
              <ErpToolbarAction href={modulePath(data.site, "")} label="前台预览" />
            </div>
          </ErpToolbar>
          <div className="mt-5">
            <ThemeMediaPanel
              initialTotal={mediaTotal}
              media={data.media}
              site={data.site}
              sourceCounts={mediaSummary.sourceCounts}
              usageCounts={mediaSummary.usageCounts}
            />
          </div>
        </ErpSection>

        <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
          <ErpSection
            description="站点素材和客户私有上传必须分开。这里的资源只服务于装修器、定价页、帮助页和拍摄包展示，不进入客户相册。"
            eyebrow="scope boundary"
            title="资源边界"
          >
            <ErpInfoList
              items={[
                { label: "Theme assets", value: "装修器读取", tone: "good" },
                { label: "Customer uploads", value: "顾客私有隔离", tone: "warn" },
                { label: "Album outputs", value: "客户结果隔离", tone: "warn" },
                { label: "Published pages", value: "只读站点资源", tone: "good" }
              ]}
            />
          </ErpSection>

          <ErpSection
            action={<ErpToolbarAction href={modulePath(data.site, "/admin/themes")} label="主题库" />}
            description="媒体字段不只是图片 URL；它还需要稳定支撑 section schema 里的 `mediaAssetId`、存储路径和 SEO 分享图。"
            eyebrow="theme contract"
            title="主题绑定规则"
          >
            <div className="grid gap-3 md:grid-cols-2">
              {[
                { label: "Hero / banner", value: "theme assets" },
                { label: "Pack cover", value: "pack_cover" },
                { label: "Policy artwork", value: "policy" },
                { label: "Brand mark", value: "brand" }
              ].map((item) => (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm" key={item.label}>
                  <span className="block font-medium text-slate-900">{item.label}</span>
                  <span className="mt-1 block font-mono text-xs text-slate-500">{item.value}</span>
                </div>
              ))}
            </div>
          </ErpSection>
        </div>
      </div>
    </AdminShell>
  );
}
