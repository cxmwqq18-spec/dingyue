import { FileText, HelpCircle, Megaphone, Palette, Send } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { ContentDraftEditor } from "@/components/admin/content-draft-editor";
import { ErpInfoList, ErpSection, ErpStatGrid, ErpToolbar, ErpToolbarAction, ErpToolbarField } from "@/components/admin/erp-primitives";
import { OpsCard, StatusPill } from "@/components/ui";
import {
  getSiteAdminData,
  modulePath,
  siteAdminAccount,
  siteAdminCommandActions,
  siteAdminModuleLinks,
  siteAdminNav,
  siteAdminQuickActions,
  siteAdminStats,
  siteAdminWorkspace
} from "../_lib/site-admin-context";

export default async function ContentPage({ params }: { params: Promise<{ siteSlug: string }> }) {
  const { siteSlug } = await params;
  const data = await getSiteAdminData(siteSlug);
  const isContentPage = (page: (typeof data.site.pages)[number]) =>
    ["policy", "faq", "help", "blog", "content"].some((type) => page.slug.includes(type) || page.pageType.includes(type) || page.templateKey?.includes(type));
  const contentEditablePages = data.site.pages.filter((page) =>
    isContentPage(page)
  );
  const policyPages = contentEditablePages.filter(
    (page) => page.slug.includes("policy") || page.pageType.includes("policy") || page.templateKey?.includes("privacy") || page.templateKey?.includes("refund") || page.templateKey?.includes("content")
  );
  const helpPages = contentEditablePages.filter(
    (page) => page.slug.includes("faq") || page.slug.includes("help") || page.pageType.includes("faq") || page.pageType.includes("help")
  );
  const dirtyContentPages = data.site.pages.filter((page) => {
    const isContent = isContentPage(page);
    return isContent && JSON.stringify(page.draftJson) !== JSON.stringify(page.publishedJson);
  });

  return (
    <AdminShell
      activeModuleCode="content"
      account={siteAdminAccount(data.site, data.current)}
      action={{ label: "打开装修器", href: modulePath(data.site, "/admin/design") }}
      breadcrumbs={[
        { label: "店铺管理", href: modulePath(data.site, "/admin") },
        { label: "内容运营" }
      ]}
      brand={data.site.branding.logoText}
      commandActions={siteAdminCommandActions(data.site, data)}
      eyebrow="content operations"
      moduleLinks={siteAdminModuleLinks}
      nav={siteAdminNav(data.site, data)}
      quickActions={siteAdminQuickActions(data.site, data)}
      siteSlug={data.site.slug}
      stats={siteAdminStats(data)}
      subtitle="政策页、帮助中心、FAQ、博客列表和营销区块都通过同一套主题页面装修，不再散落在代码里。"
      title="内容运营"
      titleBadge={String(data.contentPageCount)}
      workspace={siteAdminWorkspace(data, "content workspace")}
      rightRail={
        <>
          <OpsCard className="p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">publish state</p>
            <h2 className="mt-2 text-lg font-semibold">内容发布</h2>
            <div className="mt-4">
              <ErpInfoList
                items={[
                  { label: "Policy pages", value: String(policyPages.length), tone: policyPages.length > 0 ? "good" : "warn" },
                  { label: "Help/FAQ pages", value: String(helpPages.length), tone: helpPages.length > 0 ? "good" : "warn" },
                  { label: "Dirty content drafts", value: String(dirtyContentPages.length), tone: dirtyContentPages.length === 0 ? "good" : "warn" },
                  { label: "Published snapshots", value: String(data.publications.length), tone: data.publications.length > 0 ? "good" : "warn" }
                ]}
              />
            </div>
          </OpsCard>
          <OpsCard className="p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">content modules</p>
            <h2 className="mt-2 text-lg font-semibold">可装修内容模块</h2>
            <div className="mt-4 grid gap-2">
              {["campaign_banner", "how_it_works_video", "pricing_table", "faq_accordion", "blog_list", "policy_content"].map((item) => (
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600" key={item}>
                  {item}
                </div>
              ))}
            </div>
          </OpsCard>
        </>
      }
    >
      <div className="grid gap-5">
        <ErpStatGrid
          items={[
            { label: "pages", value: String(contentEditablePages.length), detail: "content pages managed in this workbench", icon: FileText, tone: contentEditablePages.length ? "good" : "warn" },
            { label: "policies", value: String(policyPages.length), detail: "privacy, refund and content policy pages", icon: HelpCircle, tone: policyPages.length ? "good" : "warn" },
            { label: "help", value: String(helpPages.length), detail: "FAQ and help center templates", icon: Megaphone, tone: helpPages.length ? "good" : "warn" },
            { label: "drafts", value: String(dirtyContentPages.length), detail: "content drafts not yet published", icon: Palette, tone: dirtyContentPages.length ? "warn" : "good" }
          ]}
        />

        <ErpSection
          action={<ErpToolbarAction href={modulePath(data.site, "/admin/design")} label="进入页面装修" primary />}
          description="第一版不单做独立 CMS，先把政策页、FAQ、博客列表和内容页纳入主题页面树，统一保存草稿和发布快照。"
          eyebrow="page tree"
          title="全站内容页"
        >
          <ErpToolbar>
            <div className="flex flex-wrap gap-3">
              <ErpToolbarField label="内容模板" value={String(data.contentPageCount)} />
              <ErpToolbarField label="草稿差异" value={String(dirtyContentPages.length)} />
              <ErpToolbarField label="发布快照" value={String(data.publications.length)} />
            </div>
            <div className="flex flex-wrap gap-2">
              <ErpToolbarAction href={modulePath(data.site, "/admin/design/pages")} label="页面树" />
              <ErpToolbarAction href={modulePath(data.site, "/admin/design/publications")} label="发布历史" />
            </div>
          </ErpToolbar>
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="grid gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 md:grid-cols-[1fr_0.35fr_0.45fr_0.35fr]">
              <span>页面</span>
              <span>类型</span>
              <span>区块数</span>
              <span>状态</span>
            </div>
            {contentEditablePages.map((page) => {
              const dirty = JSON.stringify(page.draftJson) !== JSON.stringify(page.publishedJson);
              return (
                <div className="grid gap-3 border-b border-slate-100 px-4 py-4 text-sm last:border-b-0 md:grid-cols-[1fr_0.35fr_0.45fr_0.35fr]" key={page.id}>
                  <span>
                    <span className="block font-medium text-slate-900">{page.title}</span>
                    <span className="font-mono text-xs text-slate-500">{page.slug}</span>
                  </span>
                  <span className="font-mono text-xs text-slate-500">{page.pageType}</span>
                  <span className="font-mono text-xs text-slate-500">{page.draftJson.sectionsOrder.length} sections</span>
                  <StatusPill label={dirty ? "draft" : "published"} tone={dirty ? "warn" : "good"} />
                </div>
              );
            })}
            {!contentEditablePages.length ? <div className="px-4 py-6 text-sm text-slate-500">当前站点还没有纳入内容运营的页面模板。</div> : null}
          </div>
        </ErpSection>

        <ErpSection
          action={<ErpToolbarAction href={modulePath(data.site, "/admin/design/seo")} label="SEO 草稿" />}
          description="内容运营不再只是页面统计。这里可以直接编辑内容页的 section 草稿，保存后仍需走整站发布流才能上线。"
          eyebrow="content drafts"
          title="内容草稿编辑"
        >
          <ErpToolbar>
            <div className="flex flex-wrap gap-3">
              <ErpToolbarField label="可编辑内容页" value={String(contentEditablePages.length)} />
              <ErpToolbarField label="脏草稿页" value={String(dirtyContentPages.length)} />
              <ErpToolbarField label="发布快照" value={String(data.publications.length)} />
            </div>
            <div className="flex flex-wrap gap-2">
              <ErpToolbarAction href={modulePath(data.site, "/admin/design/publications")} label="发布记录" />
              <ErpToolbarAction href={modulePath(data.site, "/admin/design")} label="全站装修器" />
            </div>
          </ErpToolbar>
          <div className="mt-5">
            <ContentDraftEditor
              creativePacks={data.packs}
              allPages={data.site.pages}
              editablePages={contentEditablePages}
              mediaAssets={data.media}
              products={data.products}
              site={data.site}
              siteAiApps={data.apps}
            />
          </div>
        </ErpSection>

        <div className="grid gap-5 xl:grid-cols-[1fr_0.95fr]">
          <ErpSection
            description="内容装修也必须服从整站发布流，避免政策页、帮助页和前台模块出现线上线下不一致。"
            eyebrow="publishing guardrails"
            title="发布约束"
          >
            <ErpInfoList
              items={[
                { label: "Draft save", value: "仅写 draft_json", tone: "warn" },
                { label: "Publish", value: "写入 theme_publications", tone: "good" },
                { label: "Frontend read", value: "只读 published snapshot", tone: "good" },
                { label: "Rollback", value: "恢复历史线上版本", tone: "neutral" }
              ]}
            />
          </ErpSection>

          <ErpSection
            action={<ErpToolbarAction href={modulePath(data.site, "/admin/design/publications")} label="去发布" />}
            description="DreamShoot 风格活动条、套餐墙、FAQ、政策正文和博客列表都应该被后台模块直接驱动，而不是散落在手写模板里。"
            eyebrow="section catalog"
            title="内容模块覆盖"
          >
            <div className="grid gap-3 md:grid-cols-2">
              {["campaign_banner", "how_it_works_video", "pricing_table", "faq_accordion", "blog_list", "policy_content"].map((item) => (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700" key={item}>
                  {item}
                </div>
              ))}
            </div>
          </ErpSection>
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          {[
            { title: "政策页", detail: "隐私政策、退款政策、内容政策必须可由站点后台编辑和发布。", count: policyPages.length },
            { title: "帮助中心", detail: "FAQ、教程和上传要求适合用 rich_text、faq 和 media_banner section。", count: helpPages.length },
            { title: "营销运营", detail: "DreamShoot 风格活动条、套餐墙、信任条和案例区块由装修器控制。", count: data.packs.length }
          ].map((item) => (
            <ErpSection className="h-full" description={item.detail} eyebrow="operating lane" key={item.title} title={item.title}>
              <div className="flex items-end justify-between gap-3">
                <p className="text-3xl font-semibold tracking-tight text-slate-950">{item.count}</p>
                <Send className="h-4 w-4 text-slate-300" strokeWidth={1.8} />
              </div>
            </ErpSection>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
