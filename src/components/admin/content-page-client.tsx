"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BookOpenCheck, FileText, HelpCircle, Megaphone, Newspaper, Palette, Send } from "lucide-react";
import { fetchAdminJson } from "@/components/admin/admin-api-client";
import { ContentDraftEditorLazy } from "@/components/admin/content-draft-editor-lazy";
import { ErpInfoList, ErpSection, ErpStatGrid, ErpToolbar, ErpToolbarAction, ErpToolbarField } from "@/components/admin/erp-primitives";
import { StatusPill } from "@/components/ui";
import type { CreativePack, MediaAsset, Product, Site, SiteAiApp, ThemePage, ThemePublication } from "@/lib/types";

type BlogSummaryArticle = {
  id: string;
  slug: string;
  title: string;
  author: string;
  publishedAt: string;
  readMinutes: string;
  draftStatus: "dirty" | "live";
  seoStatus: "ready" | "needs_review";
};

type BlogSummary = {
  homeSlug: string;
  articleCount: number;
  footerLinkPresent: boolean;
  articles: BlogSummaryArticle[];
};

type ContentPagePayload = {
  ok?: boolean;
  site: Site;
  blogSummary?: BlogSummary;
  publicationCount?: number;
  publications: ThemePublication[];
  packs?: CreativePack[];
  media?: MediaAsset[];
  products?: Product[];
  apps?: SiteAiApp[];
  error?: string;
};

type ContentEditorResources = {
  ok?: boolean;
  packs: CreativePack[];
  media: MediaAsset[];
  products: Product[];
  apps: SiteAiApp[];
  error?: string;
};

type ContentPublicationSummary = {
  ok?: boolean;
  publicationCount?: number;
  publications?: ThemePublication[];
  error?: string;
};

type SectionState<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
};

type ContentPageClientProps = {
  siteId: string;
  siteSlug: string;
};

function readPage(value: string | null): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function modulePath(siteSlug: string, path: string): string {
  return `/site/${siteSlug}${path}`;
}

function pageHref(page: number): string {
  return `?contentPage=${page}#content-page-tree`;
}

const contentModules = [
  { key: "campaign_banner", label: "活动横幅" },
  { key: "how_it_works_video", label: "使用流程视频" },
  { key: "pricing_table", label: "价格表" },
  { key: "faq_accordion", label: "FAQ 折叠面板" },
  { key: "blog_list", label: "博客列表" },
  { key: "blog_article", label: "博客文章" },
  { key: "policy_content", label: "政策正文" }
];

const contentPageTypeLabels: Record<string, string> = {
  policy: "政策页",
  help: "帮助页",
  faq: "FAQ 页",
  blog: "博客列表",
  article: "博客文章",
  content: "内容页"
};

function contentPageTypeLabel(type: string) {
  return contentPageTypeLabels[type.toLowerCase()] ?? type;
}

function isContentPage(page: ThemePage) {
  return ["policy", "faq", "help", "blog", "content"].some((type) => page.slug.includes(type) || page.pageType.includes(type) || page.templateKey?.includes(type));
}

function ContentPageSkeleton() {
  return (
    <div className="grid gap-5">
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div className="rounded-[8px] border border-[var(--admin-border-soft)] bg-white p-5" key={index}>
            <div className="h-3 w-20 animate-pulse rounded bg-[#e8edf5]" />
            <div className="mt-7 h-8 w-16 animate-pulse rounded bg-[#e8edf5]" />
            <div className="mt-4 h-3 w-28 animate-pulse rounded bg-[#eef2f7]" />
          </div>
        ))}
      </div>
      <div className="rounded-[8px] border border-[var(--admin-border-soft)] bg-white p-5">
        <div className="h-5 w-40 animate-pulse rounded bg-[#e8edf5]" />
        <div className="mt-5 grid gap-3 xl:grid-cols-2">
          <div className="h-40 animate-pulse rounded bg-[#eef2f7]" />
          <div className="h-40 animate-pulse rounded bg-[#eef2f7]" />
        </div>
      </div>
      <div className="rounded-[8px] border border-[var(--admin-border-soft)] bg-white p-5">
        <div className="h-5 w-36 animate-pulse rounded bg-[#e8edf5]" />
        <div className="mt-5 h-56 animate-pulse rounded bg-[#eef2f7]" />
      </div>
    </div>
  );
}

export function ContentPageClient({ siteId, siteSlug }: ContentPageClientProps) {
  const searchParams = useSearchParams();
  const editorEnabled = searchParams.get("editor") === "1" || searchParams.get("editor") === "true";
  const requestedContentPage = readPage(searchParams.get("contentPage"));
  const [payload, setPayload] = useState<ContentPagePayload | null>(null);
  const [editorResources, setEditorResources] = useState<ContentEditorResources | null>(null);
  const [editorResourcesLoading, setEditorResourcesLoading] = useState(false);
  const [editorResourcesError, setEditorResourcesError] = useState<string | null>(null);
  const [publicationSection, setPublicationSection] = useState<SectionState<ContentPublicationSummary>>({ data: null, error: null, loading: false });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function loadContentPage() {
      try {
        setError(null);
        setPayload(null);
        const suffix = editorEnabled ? "?section=core&editor=1" : "?section=core";
        const response = await fetchAdminJson<ContentPagePayload>(`/api/sites/${siteId}/admin/content-page${suffix}`, { init: { signal: controller.signal } });
        const result = response.data;
        if (!active) return;
        if (!response.ok) {
          setError(result.error ?? "内容运营数据加载失败。");
          return;
        }
        setPayload(result);
      } catch (error) {
        if (!active || controller.signal.aborted) return;
        setError(error instanceof Error ? error.message : "内容运营数据加载失败。");
      }
    }
    void loadContentPage();
    return () => {
      active = false;
      controller.abort();
    };
  }, [editorEnabled, siteId]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function loadPublicationSummary() {
      setPublicationSection({ data: null, error: null, loading: true });
      try {
        const response = await fetchAdminJson<ContentPublicationSummary>(`/api/sites/${siteId}/admin/content-page?section=publication`, { init: { signal: controller.signal } });
        const result = response.data;
        if (!active) return;
        if (!response.ok) {
          setPublicationSection({ data: null, error: result.error ?? "发布摘要加载失败。", loading: false });
          return;
        }
        setPublicationSection({ data: result, error: null, loading: false });
      } catch (error) {
        if (!active || controller.signal.aborted) return;
        setPublicationSection({ data: null, error: error instanceof Error ? error.message : "发布摘要加载失败。", loading: false });
      }
    }
    void loadPublicationSummary();
    return () => {
      active = false;
      controller.abort();
    };
  }, [siteId]);

  useEffect(() => {
    if (!editorEnabled) {
      setEditorResources(null);
      setEditorResourcesError(null);
      setEditorResourcesLoading(false);
      return;
    }
    let active = true;
    const controller = new AbortController();
    async function loadEditorResources() {
      try {
        setEditorResourcesLoading(true);
        setEditorResourcesError(null);
        setEditorResources(null);
        const response = await fetchAdminJson<ContentEditorResources>(`/api/sites/${siteId}/admin/content-page?section=editor`, { init: { signal: controller.signal } });
        const result = response.data;
        if (!active) return;
        if (!response.ok) {
          setEditorResourcesError(result.error ?? "编辑器资源加载失败。");
          return;
        }
        setEditorResources(result);
      } catch (error) {
        if (!active || controller.signal.aborted) return;
        setEditorResourcesError(error instanceof Error ? error.message : "编辑器资源加载失败。");
      } finally {
        if (active) setEditorResourcesLoading(false);
      }
    }
    void loadEditorResources();
    return () => {
      active = false;
      controller.abort();
    };
  }, [editorEnabled, siteId]);

  const derived = useMemo(() => {
    const site = payload?.site;
    const contentEditablePages = site?.pages.filter((page) => isContentPage(page)) ?? [];
    const policyPages = contentEditablePages.filter(
      (page) => page.slug.includes("policy") || page.pageType.includes("policy") || page.templateKey?.includes("privacy") || page.templateKey?.includes("refund") || page.templateKey?.includes("content")
    );
    const helpPages = contentEditablePages.filter(
      (page) => page.slug.includes("faq") || page.slug.includes("help") || page.pageType.includes("faq") || page.pageType.includes("help")
    );
    const dirtyPageIds = new Set<string>();
    const dirtyContentPages = contentEditablePages.filter((page) => {
      const dirty = JSON.stringify(page.draftJson) !== JSON.stringify(page.publishedJson);
      if (dirty) dirtyPageIds.add(page.id);
      return dirty;
    });
    const contentPageSize = 10;
    const contentPageCount = Math.max(1, Math.ceil(contentEditablePages.length / contentPageSize));
    const contentPage = Math.min(requestedContentPage, contentPageCount);
    const contentPageStart = (contentPage - 1) * contentPageSize;
    const visibleContentPages = contentEditablePages.slice(contentPageStart, contentPageStart + contentPageSize);
    return {
      contentEditablePages,
      contentPage,
      contentPageCount,
      contentPageSize,
      contentPageStart,
      dirtyContentPages,
      dirtyPageIds,
      helpPages,
      policyPages,
      visibleContentPages
    };
  }, [payload, requestedContentPage]);

  const manualSteps = [
    {
      title: "确认内容范围",
      detail: "先查看政策页、帮助页、FAQ、博客列表和营销内容区块，判断哪些页面属于本次运营更新。"
    },
    {
      title: "编辑草稿",
      detail: "在内容草稿编辑区选择页面，修改区块文案、媒体、FAQ 或模块配置。保存只进入草稿区，不会直接影响线上。"
    },
    {
      title: "发布前检查",
      detail: "检查草稿差异、SEO、导航入口和内容模块绑定。政策页、套餐说明和 FAQ 需要和当前业务规则一致。"
    },
    {
      title: "发布或回滚",
      detail: "确认无误后进入发布历史发布整站快照。线上异常时从发布历史恢复旧版本，再重新编辑草稿。"
    }
  ];

  if (error) {
    return (
      <div className="rounded-[8px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!payload) {
    return <ContentPageSkeleton />;
  }
  const publicationCount = publicationSection.data?.publicationCount ?? payload.publicationCount ?? payload.publications.length;
  const latestPublicationVersion = publicationSection.data?.publications?.[0]?.version ?? payload.publications[0]?.version;
  const publicationCountValue = publicationSection.loading && !publicationSection.data ? "加载中" : String(publicationCount);
  const blogSummary: BlogSummary = payload.blogSummary ?? { homeSlug: "", articleCount: 0, footerLinkPresent: false, articles: [] };
  const blogSeoReadyCount = blogSummary.articles.filter((article) => article.seoStatus === "ready").length;
  const blogDirtyCount = blogSummary.articles.filter((article) => article.draftStatus === "dirty").length;

  return (
    <div className="grid gap-5">
      <ErpStatGrid
        columns={6}
        items={[
          { label: "内容页", value: String(derived.contentEditablePages.length), detail: "当前工作台管理的内容页", icon: FileText, tone: derived.contentEditablePages.length ? "good" : "warn" },
          { label: "政策页", value: String(derived.policyPages.length), detail: "隐私、退款和内容政策页", icon: HelpCircle, tone: derived.policyPages.length ? "good" : "warn" },
          { label: "帮助页", value: String(derived.helpPages.length), detail: "FAQ 与帮助中心模板", icon: Megaphone, tone: derived.helpPages.length ? "good" : "warn" },
          { label: "博客文章", value: String(blogSummary.articleCount), detail: blogSummary.footerLinkPresent ? "底部入口已连接" : "底部入口待检查", icon: Newspaper, tone: blogSummary.articleCount >= 3 && blogSummary.footerLinkPresent ? "good" : "warn" },
          { label: "待发布草稿", value: String(derived.dirtyContentPages.length), detail: "尚未发布上线的内容草稿", icon: Palette, tone: derived.dirtyContentPages.length ? "warn" : "good" },
          { label: "发布快照", value: publicationCountValue, detail: publicationSection.error ? "发布摘要加载失败" : "可用于回滚的已发布版本", icon: Send, tone: publicationCount ? "good" : publicationSection.error ? "warn" : "neutral" },
          { label: "内容模块", value: String(contentModules.length), detail: "编辑器中可用的内容区块", icon: BookOpenCheck, tone: "good" }
        ]}
      />

      <ErpSection
        description="内容运营用于维护站点的长期文字资产和营销内容：政策页、帮助中心、FAQ、博客列表、活动条、套餐说明和可复用内容区块。运维人员在这里看状态、改草稿、检查发布，并把最终内容通过整站快照上线。"
        eyebrow="操作手册"
        title="内容运营操作手册"
      >
        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <div className="grid gap-3">
            {manualSteps.map((item, index) => (
              <div className="rounded-[8px] border border-[var(--admin-border-soft)] bg-[var(--admin-panel)] px-4 py-3" key={item.title}>
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-white font-mono text-[11px] font-semibold text-[var(--admin-accent)] shadow-[inset_0_0_0_1px_var(--admin-border-soft)]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-[var(--admin-text)]">{item.title}</span>
                    <span className="mt-1 block text-[12px] leading-5 text-[#667085]">{item.detail}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="grid gap-3">
            <ErpInfoList
              items={[
                { label: "政策页", value: String(derived.policyPages.length), tone: derived.policyPages.length > 0 ? "good" : "warn" },
                { label: "帮助/FAQ 页", value: String(derived.helpPages.length), tone: derived.helpPages.length > 0 ? "good" : "warn" },
                { label: "有变更的内容草稿", value: String(derived.dirtyContentPages.length), tone: derived.dirtyContentPages.length === 0 ? "good" : "warn" },
                { label: "已发布快照", value: String(publicationCount), tone: publicationCount > 0 ? "good" : "warn" }
              ]}
            />
            <div className="rounded-[8px] border border-[var(--admin-border-soft)] bg-white p-4">
              <div className="text-[12px] font-semibold text-[var(--admin-text)]">可装修内容模块</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {contentModules.map((item) => (
                  <span className="inline-flex min-h-[30px] items-center whitespace-nowrap rounded-[8px] border border-slate-200 bg-slate-50 px-3 text-[12px] text-slate-600" key={item.key}>
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </ErpSection>

      <ErpSection
        action={<ErpToolbarAction href={modulePath(siteSlug, "/admin/content?editor=1#content-editor")} label="打开博客编辑" primary />}
        description="博客内容仍然复用主题页面草稿和发布体系。这里集中查看博客首页、文章元信息、SEO 状态、底部导航入口和发布差异。"
        eyebrow="博客专区"
        title="博客内容状态"
      >
        <ErpToolbar>
          <div className="flex flex-wrap gap-3">
            <ErpToolbarField label="博客首页" value={blogSummary.homeSlug || "缺失"} />
            <ErpToolbarField label="文章数量" value={String(blogSummary.articleCount)} />
            <ErpToolbarField label="底部入口" value={blogSummary.footerLinkPresent ? "已连接" : "待补齐"} />
            <ErpToolbarField label="SEO 就绪" value={`${blogSeoReadyCount}/${blogSummary.articleCount}`} />
            <ErpToolbarField label="草稿待发" value={String(blogDirtyCount)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <ErpToolbarAction href={modulePath(siteSlug, blogSummary.homeSlug || "/blog")} label="查看博客首页" />
            <ErpToolbarAction href={modulePath(siteSlug, "/admin/design/pages")} label="页面树" />
          </div>
        </ErpToolbar>
        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="grid gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 md:grid-cols-[minmax(0,1fr)_0.45fr_0.34fr_0.34fr_0.42fr]">
            <span>文章</span>
            <span>元信息</span>
            <span>发布</span>
            <span>SEO</span>
            <span>操作</span>
          </div>
          {blogSummary.articles.map((article) => (
            <div className="grid gap-3 border-b border-slate-100 px-4 py-4 text-sm last:border-b-0 md:grid-cols-[minmax(0,1fr)_0.45fr_0.34fr_0.34fr_0.42fr]" key={article.id}>
              <span className="min-w-0">
                <span className="block break-words font-medium text-slate-900">{article.title}</span>
                <span className="font-mono text-xs text-slate-500">{article.slug}</span>
              </span>
              <span className="text-xs leading-5 text-slate-600">
                <span className="block">{article.author || "未填写作者"}</span>
                <span className="block font-mono">{article.publishedAt || "未填写日期"} · {article.readMinutes || "未填写阅读时长"}</span>
              </span>
              <StatusPill label={article.draftStatus === "dirty" ? "草稿待发布" : "已发布"} tone={article.draftStatus === "dirty" ? "warn" : "good"} />
              <StatusPill label={article.seoStatus === "ready" ? "SEO 就绪" : "待补 SEO"} tone={article.seoStatus === "ready" ? "good" : "warn"} />
              <span className="flex flex-wrap gap-2">
                <ErpToolbarAction href={modulePath(siteSlug, article.slug)} label="前台" />
                <ErpToolbarAction href={modulePath(siteSlug, "/admin/content?editor=1#content-editor")} label="编辑" />
              </span>
            </div>
          ))}
          {!blogSummary.articles.length ? <div className="px-4 py-6 text-sm text-slate-500">当前站点还没有博客文章页，请先在页面树中添加 /blog/* 内容页。</div> : null}
        </div>
      </ErpSection>

      <ErpSection
        action={<ErpToolbarAction href={modulePath(siteSlug, "/admin/design")} label="进入页面装修" primary />}
        description="第一版不单做独立 CMS，先把政策页、FAQ、博客列表和内容页纳入主题页面树，统一保存草稿和发布快照。"
        eyebrow="页面树"
        id="content-page-tree"
        title="全站内容页"
      >
        <ErpToolbar>
          <div className="flex flex-wrap gap-3">
            <ErpToolbarField label="内容模板" value={String(derived.contentEditablePages.length)} />
            <ErpToolbarField label="草稿差异" value={String(derived.dirtyContentPages.length)} />
            <ErpToolbarField label="发布快照" value={String(publicationCount)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <ErpToolbarAction href={modulePath(siteSlug, "/admin/design/pages")} label="页面树" />
            <ErpToolbarAction href={modulePath(siteSlug, "/admin/design/publications")} label="发布历史" />
          </div>
        </ErpToolbar>
        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="grid gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 md:grid-cols-[1fr_0.35fr_0.45fr_0.35fr]">
            <span>页面</span>
            <span>类型</span>
            <span>区块数</span>
            <span>状态</span>
          </div>
          {derived.visibleContentPages.map((page) => {
            const dirty = derived.dirtyPageIds.has(page.id);
            return (
              <div className="grid gap-3 border-b border-slate-100 px-4 py-4 text-sm last:border-b-0 md:grid-cols-[1fr_0.35fr_0.45fr_0.35fr]" key={page.id}>
                <span>
                  <span className="block font-medium text-slate-900">{page.title}</span>
                  <span className="font-mono text-xs text-slate-500">{page.slug}</span>
                </span>
                <span className="text-xs text-slate-600">{contentPageTypeLabel(page.pageType)}</span>
                <span className="text-xs text-slate-600">{page.draftJson.sectionsOrder.length} 个区块</span>
                <StatusPill label={dirty ? "草稿待发布" : "已发布"} tone={dirty ? "warn" : "good"} />
              </div>
            );
          })}
          {!derived.contentEditablePages.length ? <div className="px-4 py-6 text-sm text-slate-500">当前站点还没有纳入内容运营的页面模板。</div> : null}
        </div>
        {derived.contentEditablePages.length > derived.contentPageSize ? (
          <div className="mt-3 flex flex-col gap-2 rounded-[8px] border border-[var(--admin-border-soft)] bg-white px-3 py-2 text-[12px] text-[#667085] sm:flex-row sm:items-center sm:justify-between">
            <span className="whitespace-nowrap">
              显示 {derived.contentPageStart + 1}-{Math.min(derived.contentEditablePages.length, derived.contentPageStart + derived.contentPageSize)} / 共 {derived.contentEditablePages.length} 条
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {derived.contentPage > 1 ? (
                <ErpToolbarAction href={pageHref(derived.contentPage - 1)} label="上一页" />
              ) : (
                <span className="admin_btn inline-flex h-[30px] items-center justify-center whitespace-nowrap px-3 opacity-50">上一页</span>
              )}
              <span className="whitespace-nowrap font-mono text-[var(--admin-text)]">{derived.contentPage} / {derived.contentPageCount}</span>
              {derived.contentPage < derived.contentPageCount ? (
                <ErpToolbarAction href={pageHref(derived.contentPage + 1)} label="下一页" />
              ) : (
                <span className="admin_btn inline-flex h-[30px] items-center justify-center whitespace-nowrap px-3 opacity-50">下一页</span>
              )}
            </div>
          </div>
        ) : null}
      </ErpSection>

      <ErpSection
        action={<ErpToolbarAction href={modulePath(siteSlug, "/admin/design/seo")} label="SEO 草稿" />}
        description="内容运营不再只是页面统计。这里可以直接编辑内容页的区块草稿，保存后仍需走整站发布流才能上线。"
        eyebrow="内容草稿"
        title="内容草稿编辑"
      >
        <ErpToolbar>
          <div className="flex flex-wrap gap-3">
            <ErpToolbarField label="可编辑内容页" value={String(derived.contentEditablePages.length)} />
            <ErpToolbarField label="脏草稿页" value={String(derived.dirtyContentPages.length)} />
            <ErpToolbarField label="发布快照" value={String(publicationCount)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <ErpToolbarAction href={modulePath(siteSlug, "/admin/design/publications")} label="发布记录" />
            <ErpToolbarAction href={modulePath(siteSlug, editorEnabled ? "/admin/design" : "/admin/content?editor=1#content-editor")} label={editorEnabled ? "全站装修器" : "打开编辑器"} primary={!editorEnabled} />
          </div>
        </ErpToolbar>
        <div className="mt-5" id="content-editor">
          {!editorEnabled ? (
            <div className="rounded-[8px] border border-dashed border-[var(--admin-border-soft)] bg-white px-4 py-6 text-[13px] leading-6 text-[#667085]">
              已先加载内容运营概览和页面树。需要编辑区块草稿时再打开编辑器，系统会在当前页面内加载商品、媒体和 AI 工具选项。
            </div>
          ) : (
            editorResourcesError ? (
              <div className="rounded-[8px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">{editorResourcesError}</div>
            ) : !editorResources || editorResourcesLoading ? (
              <div className="rounded-[8px] border border-[var(--admin-border-soft)] bg-white p-4 text-[13px] text-[#667085]">
                正在加载媒体、商品、AI 工具和创意包，概览与页面树已可先查看。
              </div>
            ) : (
              <ContentDraftEditorLazy
                creativePacks={editorResources.packs}
                allPages={payload.site.pages}
                editablePages={derived.contentEditablePages}
                mediaAssets={editorResources.media}
                publicationCount={publicationCount}
                latestPublicationVersion={latestPublicationVersion}
                products={editorResources.products}
                site={payload.site}
                siteAiApps={editorResources.apps}
              />
            )
          )}
        </div>
      </ErpSection>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.95fr]">
        <ErpSection
          description="内容运营和店铺装修共用同一套整站发布快照。保存草稿不会上线；发布整站快照时，会把内容页草稿、装修草稿、主题设置一起写入前台可读取版本。"
          eyebrow="发布规则"
          title="发布约束"
        >
          <ErpInfoList
            items={[
              { label: "保存草稿", value: "仅写入草稿数据", tone: "warn" },
              { label: "发布整站", value: "写入发布快照", tone: "good" },
              { label: "前台读取", value: "只读取已发布快照", tone: "good" },
              { label: "回滚恢复", value: "恢复历史线上版本", tone: "neutral" }
            ]}
          />
        </ErpSection>

        <ErpSection
          action={<ErpToolbarAction href={modulePath(siteSlug, "/admin/design/publications")} label="查看发布历史" />}
          description="这里展示可由后台维护的前台内容区块。最终上线入口和店铺装修一致，都会进入同一个整站发布历史，方便统一回滚。"
          eyebrow="内容区块"
          title="内容模块覆盖"
        >
          <div className="grid gap-3 md:grid-cols-2">
            {contentModules.map((item) => (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700" key={item.key}>
                {item.label}
              </div>
            ))}
          </div>
        </ErpSection>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        {[
          { title: "政策页", detail: "隐私政策、退款政策、内容政策必须可由站点后台编辑和发布。", count: derived.policyPages.length },
          { title: "帮助中心", detail: "FAQ、教程和上传要求适合用富文本、问答和媒体横幅区块维护。", count: derived.helpPages.length },
          { title: "营销运营", detail: "DreamShoot 风格活动条、套餐墙、信任条和案例区块由装修器控制。", count: editorResources?.packs.length ?? 0 }
        ].map((item) => (
          <ErpSection className="h-full" description={item.detail} eyebrow="运营范围" key={item.title} title={item.title}>
            <div className="flex items-end justify-between gap-3">
              <p className="text-3xl font-semibold tracking-tight text-slate-950">{item.count}</p>
              <Send className="h-4 w-4 text-slate-300" strokeWidth={1.8} />
            </div>
          </ErpSection>
        ))}
      </div>
    </div>
  );
}
